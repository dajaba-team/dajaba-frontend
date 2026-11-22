import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"
import LoadDatasetCard from "../features/admin/batches/components/LoadDatasetCard"

// 데이터·배치 운영 틀 + 원천 적재·룰 스캔 (SCRUM-220) — 계약서 B1·B2·B5, 화면 설계서 ADM-01·ADM-01-E.
const ADMIN = { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" }
const conflict = (code, message) =>
	HttpResponse.json({ error: { code, message, details: {} } }, { status: 409 })

function renderPage() {
	resetCases(ADMIN)
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={["/admin/batches"]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return userEvent.setup()
}

async function load(user) {
	const card = await screen.findByRole("region", { name: "원천 적재" })
	await user.click(within(card).getByRole("button", { name: "실행" }))
	const dialog = await screen.findByRole("dialog", { name: "원천 적재" })
	expect(dialog).toHaveTextContent("최초 한 번만")
	await user.click(within(dialog).getByRole("button", { name: "적재" }))
	return card
}

async function scan(user, date = "2022-09-02") {
	await user.type(await screen.findByLabelText("분석 날짜"), date)
	const card = screen.getByRole("region", { name: "룰 스캔" })
	await user.click(within(card).getByRole("button", { name: "실행" }))
	const dialog = await screen.findByRole("dialog", { name: "룰 스캔" })
	expect(dialog).toHaveTextContent(
		`${date} 룰 스캔을 실행할까요? 성공한 날짜는 다시 스캔할 수 없습니다.`,
	)
	await user.click(within(dialog).getByRole("button", { name: "실행" }))
}

describe("데이터·배치 운영 — 원천 적재·룰 스캔 (SCRUM-220)", () => {
	it("적재 202 → 상태 확인 → 완료, 날짜를 골라 룰 스캔 → 룰별 경보 수, 실행 결과 표 두 줄", async () => {
		const user = renderPage()
		const loadCard = await load(user)
		expect(await within(loadCard).findByText(/거래 1건을 적재했어요/)).toBeInTheDocument()
		expect(within(loadCard).getByRole("button", { name: "완료됨" })).toBeDisabled()
		expect(within(loadCard).getByText("완료")).toBeInTheDocument() // 상태 배지

		await scan(user)
		const scanCard = screen.getByRole("region", { name: "룰 스캔" })
		expect(
			await within(scanCard).findByText(/2022-09-02 경보 3건을 만들었어요/),
		).toBeInTheDocument()
		expect(within(scanCard).getByText("R02 집중 입금 · 3건")).toHaveAttribute(
			"title",
			"R02_FAN_IN 버전 1",
		)

		const table = within(screen.getByRole("region", { name: "실행 결과" })).getByRole("table")
		expect(within(table).getAllByRole("row")).toHaveLength(3) // 머리 + 적재 + 룰 스캔
		expect(table).toHaveTextContent("원천 적재완료거래 1건룰 스캔")
		expect(table).toHaveTextContent("룰 스캔완료2022-09-02 경보 3건점수 산출")
	})

	it("날짜를 고르기 전엔 룰 스캔을 못 누르고, 경보 0건도 정상 결과로 보여 준다", async () => {
		server.use(
			http.post("*/api/v1/admin/batches/rule-scan", () =>
				HttpResponse.json({
					batch_run_id: 9,
					batch_type: "RULE_SCAN",
					batch_date: "2022-09-03",
					status: "SUCCEEDED",
					rows_in: 50,
					rows_out: 0,
					alerts_by_rule: [{ rule_id: "R02_FAN_IN", rule_version: 1, alert_count: 0 }],
					started_at: "2026-11-12T03:00:00Z",
					finished_at: "2026-11-12T03:00:02Z",
				}),
			),
		)
		const user = renderPage()
		const card = await screen.findByRole("region", { name: "룰 스캔" })
		expect(within(card).getByRole("button", { name: "실행" })).toBeDisabled()
		expect(within(card).getByText("대기")).toBeInTheDocument() // 상태 배지
		expect(
			within(screen.getByRole("region", { name: "실행 결과" })).getByText(
				/아직 실행한 작업이 없어요/,
			),
		).toBeInTheDocument()
		await scan(user, "2022-09-03")
		expect(await screen.findByText(/조건에 맞는 경보가 없어요/)).toBeInTheDocument()
	})

	it("이미 적재된 DB면 다음 단계로 안내하고, 이미 스캔한 날짜(409)는 확인창 안에 알리고 날짜를 남긴다", async () => {
		server.use(
			http.post("*/api/v1/admin/batches/load", () =>
				conflict("BATCH_ALREADY_DONE", "LOAD_DATASET 2026-11-12 는 이미 성공한 배치입니다"),
			),
			http.post("*/api/v1/admin/batches/rule-scan", () =>
				conflict("BATCH_ALREADY_DONE", "RULE_SCAN 2022-09-02 는 이미 성공한 배치입니다"),
			),
		)
		const user = renderPage()
		const loadCard = await load(user)
		expect(
			await within(loadCard).findByText(
				"이미 적재된 데이터가 있어요. 룰 스캔으로 넘어가 주세요.",
			),
		).toBeInTheDocument()
		expect(screen.queryByRole("dialog", { name: "원천 적재" })).not.toBeInTheDocument()

		await scan(user)
		const dialog = screen.getByRole("dialog", { name: "룰 스캔" })
		expect(await within(dialog).findByRole("alert")).toHaveTextContent("이미 성공한 배치입니다")
		await user.click(within(dialog).getByRole("button", { name: "취소" }))
		expect(screen.getByLabelText("분석 날짜")).toHaveValue("2022-09-02")
	})

	it("이미 적재된 DB면 화면을 열 때부터 원천 적재가 완료이고 룰 스캔 버튼이 진하다 (SCRUM-344)", async () => {
		server.use(
			http.get("*/api/v1/admin/batches", ({ request }) => {
				const url = new URL(request.url)
				expect(url.searchParams.get("type")).toBe("LOAD_DATASET")
				expect(url.searchParams.get("status")).toBe("SUCCEEDED")
				return HttpResponse.json({
					items: [
						{
							batch_run_id: 1,
							batch_type: "LOAD_DATASET",
							batch_date: "2026-11-12",
							status: "SUCCEEDED",
							rows_in: 5078345,
							rows_out: 5078345,
							started_at: "2026-11-12T03:00:00Z",
							finished_at: "2026-11-12T03:05:00Z",
						},
					],
					page: 0,
					size: 1,
					total: 1,
				})
			}),
		)
		const user = renderPage()
		const loadCard = await screen.findByRole("region", { name: "원천 적재" })
		expect(
			await within(loadCard).findByText(/이미 적재돼 있어요 — 거래 5,078,345건 \(실행 /),
		).toBeInTheDocument()
		expect(within(loadCard).getByRole("button", { name: "완료됨" })).toBeDisabled()
		expect(within(loadCard).getByText("완료")).toBeInTheDocument() // 상태 배지
		expect(screen.getByRole("region", { name: "실행 결과" })).toHaveTextContent(
			"원천 적재완료이미 적재됨 · 거래 5,078,345건룰 스캔",
		)

		await user.type(screen.getByLabelText("분석 날짜"), "2022-09-02")
		expect(
			within(screen.getByRole("region", { name: "룰 스캔" })).getByRole("button", {
				name: "실행",
			}),
		).toHaveAttribute("data-primary", "true")
	})

	it("케이스 생성은 위 분석 날짜를 쓰는 4번 카드이고, 결과가 실행 결과 표에 줄로 남는다 (SCRUM-344)", async () => {
		const user = renderPage()
		await load(user)
		await scan(user)
		await screen.findByText(/경보 3건을 만들었어요/)
		const card = screen.getByRole("region", { name: "케이스 생성" })
		expect(within(card).queryByLabelText("경보 배치 기준일")).not.toBeInTheDocument()
		expect(within(card).getByText("대기")).toBeInTheDocument()
		await user.click(within(card).getByRole("button", { name: "케이스 생성" }))
		const dialog = await screen.findByRole("dialog", { name: "케이스 생성" })
		expect(dialog).toHaveTextContent("2022-09-02 경보 중 HIGH만")
		await user.click(within(dialog).getByRole("button", { name: "생성" }))
		expect(
			await within(card).findByText(/조사 케이스 1건을 생성했어요. .*\(실행 /),
		).toBeInTheDocument()
		expect(within(card).getByText("완료")).toBeInTheDocument()

		const table = within(screen.getByRole("region", { name: "실행 결과" })).getByRole("table")
		expect(within(table).getAllByRole("row")).toHaveLength(4) // 머리 + 적재 + 룰 스캔 + 케이스 생성
		expect(table).toHaveTextContent(
			"케이스 생성완료2022-09-02 케이스 1건조사 케이스에서 담당자 배정",
		)
	})

	it("적재 상태 자동 조회는 상한을 넘으면 멈추고 [상태 다시 확인]으로 직접 부른다", async () => {
		let done = false
		server.use(
			http.get("*/api/v1/admin/batches/:id", ({ params }) =>
				HttpResponse.json({
					batch_run_id: Number(params.id),
					batch_type: "LOAD_DATASET",
					batch_date: "2026-11-12",
					status: done ? "SUCCEEDED" : "RUNNING",
					rows_in: done ? 5078345 : null,
					rows_out: done ? 5078345 : null,
				}),
			),
		)
		resetCases(ADMIN)
		render(
			<QueryClientProvider client={createQueryClient()}>
				<LoadDatasetCard maxPollMs={50} />
			</QueryClientProvider>,
		)
		const user = userEvent.setup()
		const card = await load(user)
		expect(
			await within(card).findByText(/10분이 지나도 끝나지 않아 자동 확인을 멈췄어요/),
		).toBeInTheDocument()
		done = true
		await user.click(within(card).getByRole("button", { name: "상태 다시 확인" }))
		expect(await within(card).findByText(/거래 5,078,345건을 적재했어요/)).toBeInTheDocument()
	})
})
