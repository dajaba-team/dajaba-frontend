import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import OpenCasesCard from "../features/admin/batches/components/OpenCasesCard"
import { server } from "../mocks/server"

// [케이스 생성] 카드 (SCRUM-180) — B4 open-cases 202 → B5 상태 확인 → 카드 안 결과.
const USERS = {
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
}

function renderApp(who = "admin") {
	resetCases(USERS[who])
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={["/admin/batches"]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return userEvent.setup()
}

async function runFor(user, date = "2022-09-02") {
	const card = await screen.findByRole("region", { name: "케이스 생성" })
	await user.type(within(card).getByLabelText("경보 배치 기준일"), date)
	await user.click(within(card).getByRole("button", { name: "케이스 생성" }))
	const dialog = await screen.findByRole("dialog", { name: "케이스 생성" })
	expect(dialog).toHaveTextContent(`${date} 경보 중 HIGH만`)
	await user.click(within(dialog).getByRole("button", { name: "생성" }))
	return card
}

const run = (fields) => ({
	batch_run_id: 7,
	batch_type: "OPEN_CASES",
	batch_date: "2022-09-02",
	status: "SUCCEEDED",
	started_at: "2026-11-02T03:00:00Z",
	finished_at: "2026-11-02T03:00:05Z",
	rows_in: 2,
	rows_out: 1,
	error_message: null,
	...fields,
})

describe("케이스 생성 카드 (SCRUM-180)", () => {
	it("확인창 → 202 → 상태 확인 → 생성 건수와 [케이스 확인·배정]", async () => {
		const dates = []
		server.events.on("request:start", ({ request }) => {
			const url = new URL(request.url)
			if (url.pathname.endsWith("/open-cases")) dates.push(url.searchParams.get("date"))
		})
		const user = renderApp()
		const card = await runFor(user)
		expect(
			await within(card).findByText(/조사 케이스 1건을 생성했어요. 담당자를 배정해 주세요./),
		).toBeInTheDocument()
		expect(within(card).getByRole("link", { name: "케이스 확인·배정" })).toHaveAttribute(
			"href",
			"/cases?status=OPEN",
		)
		expect(dates).toEqual(["2022-09-02"])
		server.events.removeAllListeners()
	})
	it("RUNNING 이면 끝날 때까지 다시 불러요", async () => {
		let calls = 0
		server.use(
			http.post("*/api/v1/admin/batches/open-cases", () =>
				HttpResponse.json(run({ status: "RUNNING", rows_in: null, rows_out: null }), {
					status: 202,
				}),
			),
			http.get("*/api/v1/admin/batches/7", () => {
				calls += 1
				return HttpResponse.json(
					calls < 2
						? run({ status: "RUNNING", rows_in: null, rows_out: null })
						: run({ rows_out: 3 }),
				)
			}),
		)
		const user = renderApp()
		const card = await runFor(user)
		expect(await within(card).findByText(/만드는 중이에요/)).toBeInTheDocument()
		expect(
			await within(card).findByText(/조사 케이스 3건을 생성했어요/, {}, { timeout: 5000 }),
		).toBeInTheDocument()
	})
	it("만들 케이스가 없으면 그렇게 알리고, 실패는 카드 안에만", async () => {
		server.use(
			http.post("*/api/v1/admin/batches/open-cases", () =>
				HttpResponse.json(run({ status: "RUNNING" }), { status: 202 }),
			),
			http.get("*/api/v1/admin/batches/7", () =>
				HttpResponse.json(run({ rows_in: 4, rows_out: 0 })),
			),
		)
		const user = renderApp()
		const card = await runFor(user)
		expect(
			await within(card).findByText(/만들 케이스가 없어요. .*4건 중 HIGH 없음/),
		).toBeInTheDocument()

		server.use(
			http.post("*/api/v1/admin/batches/open-cases", () =>
				HttpResponse.json(run({ batch_run_id: 8, status: "RUNNING" }), { status: 202 }),
			),
			http.get("*/api/v1/admin/batches/8", () =>
				HttpResponse.json(
					run({
						batch_run_id: 8,
						status: "FAILED",
						error_message: "대상 4 · 생성 2 · HIGH 아님 1 · 이미 있음 0 · 실패 1",
					}),
				),
			),
		)
		await user.clear(within(card).getByLabelText("경보 배치 기준일"))
		await runFor(user, "2022-09-03")
		expect(await within(card).findByRole("alert")).toHaveTextContent("실패 1")
		expect(screen.getByRole("heading", { name: "데이터·배치 운영" })).toBeInTheDocument()
	})
	it("시작 전 거절(409)은 확인창에 안내하고 입력을 남긴다", async () => {
		server.use(
			http.post("*/api/v1/admin/batches/open-cases", () =>
				HttpResponse.json(
					{
						error: {
							code: "POLICY_NOT_CONFIGURED",
							message: "운영 등급 기준이 설정되지 않았습니다",
							details: {},
						},
					},
					{ status: 409 },
				),
			),
		)
		const user = renderApp()
		const card = await runFor(user)
		const dialog = screen.getByRole("dialog", { name: "케이스 생성" })
		expect(await within(dialog).findByRole("alert")).toHaveTextContent(
			"운영 등급 기준이 설정되지 않았습니다",
		)
		await user.click(within(dialog).getByRole("button", { name: "취소" }))
		expect(within(card).getByLabelText("경보 배치 기준일")).toHaveValue("2022-09-02")
	})
	it("관리자가 아니면 화면을 볼 수 없다", async () => {
		renderApp("inv01")
		expect(await screen.findByRole("heading", { name: "권한이 없어요" })).toBeInTheDocument()
		expect(screen.queryByRole("region", { name: "케이스 생성" })).not.toBeInTheDocument()
	})
	it("자동 상태 조회는 상한(계약서 5.6 10분)을 넘으면 멈추고 [상태 다시 확인]으로 직접 부른다", async () => {
		let calls = 0
		let done = false
		server.use(
			http.post("*/api/v1/admin/batches/open-cases", () =>
				HttpResponse.json(run({ status: "RUNNING", rows_in: null, rows_out: null }), {
					status: 202,
				}),
			),
			http.get("*/api/v1/admin/batches/7", () => {
				calls += 1
				return HttpResponse.json(
					done
						? run({ rows_out: 2 })
						: run({ status: "RUNNING", rows_in: null, rows_out: null }),
				)
			}),
		)
		resetCases(USERS.admin)
		render(
			<QueryClientProvider client={createQueryClient()}>
				<MemoryRouter>
					<OpenCasesCard maxPollMs={50} />
				</MemoryRouter>
			</QueryClientProvider>,
		)
		const user = userEvent.setup()
		const card = await runFor(user)
		expect(
			await within(card).findByText(/10분이 지나도 끝나지 않아 자동 확인을 멈췄어요/),
		).toBeInTheDocument()
		const callsAtStop = calls
		await new Promise((resolve) => setTimeout(resolve, 2500))
		expect(calls).toBe(callsAtStop) // 상한 뒤에는 저절로 다시 부르지 않아요
		done = true
		await user.click(within(card).getByRole("button", { name: "상태 다시 확인" }))
		expect(await within(card).findByText(/조사 케이스 2건을 생성했어요/)).toBeInTheDocument()
		expect(
			within(card).queryByRole("button", { name: "상태 다시 확인" }),
		).not.toBeInTheDocument()
	}, 10000)
})
