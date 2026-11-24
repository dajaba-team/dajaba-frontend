import { describe, expect, it } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"
import { optionValues, pickOption } from "./selectMenu"

// 감사 기록 화면 (SCRUM-170, ADM-05). AI 호출 기록은 계약서 5.9, 접근 기록은 5.10(BE #102, SCRUM-316) 그대로.
const USERS = {
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
}

function renderApp(path = "/admin/audit", who = "admin") {
	resetCases(USERS[who])
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={[path]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return userEvent.setup()
}
function recordUrls(pathname) {
	const urls = []
	server.events.on("request:start", ({ request }) => {
		const url = new URL(request.url)
		if (url.pathname === pathname) urls.push(url)
	})
	return urls
}
const rows = async (name) => {
	const table = await screen.findByLabelText(`${name} 표`)
	return within(table).getAllByRole("row").slice(1)
}

describe("AI 호출 기록 탭", () => {
	it("기본 탭으로 메타만 보이고, 실패·응답 없음·대상 없음을 글자로 구분한다", async () => {
		renderApp()
		expect(await screen.findByRole("tab", { name: "AI 호출 기록" })).toHaveAttribute(
			"aria-selected",
			"true",
		)
		const list = await rows("AI 호출 기록")
		expect(list).toHaveLength(6)
		expect(within(list[0]).getByText("실패 · AI_TIMEOUT")).toBeInTheDocument()
		expect(within(list[0]).getByText("응답 없음")).toBeInTheDocument()
		expect(within(list[0]).getByText("케이스 CASE-2022-001004")).toBeInTheDocument()
		expect(within(list[5]).getByText(/AI 상태 확인/)).toBeInTheDocument()
		expect(within(list[5]).getAllByText("—").length).toBeGreaterThan(0)
	})
	it("필터는 [조회] 때 서버로 보내고 주소에 남는다 — 대상 번호는 대상 종류를 고른 뒤에만", async () => {
		const urls = recordUrls("/api/v1/admin/ai-calls")
		const user = renderApp()
		await rows("AI 호출 기록")
		const form = screen.getByRole("form", { name: "AI 호출 기록 필터" })
		expect(within(form).getByLabelText("대상 번호")).toBeDisabled()
		await pickOption(user, within(form).getByLabelText("결과"), "FAILURE")
		await pickOption(user, within(form).getByLabelText("대상 종류"), "DRAFT")
		await user.type(within(form).getByLabelText("대상 번호"), "DRF-000124")
		await user.click(within(form).getByRole("button", { name: "조회" }))
		await waitFor(async () => expect(await rows("AI 호출 기록")).toHaveLength(1))
		const last = urls.at(-1)
		expect(last.searchParams.get("outcome")).toBe("FAILURE")
		expect(last.searchParams.get("target_type")).toBe("DRAFT")
		expect(last.searchParams.get("target_id")).toBe("DRF-000124")
		expect(last.searchParams.get("page")).toBe("0")
		server.events.removeAllListeners()
	})
	it("기간은 UTC Z 로 보내고(종료일은 다음 날 0시 제외), 시작일 > 종료일이면 조회를 막는다", async () => {
		const urls = recordUrls("/api/v1/admin/ai-calls")
		const user = renderApp("/admin/audit?tab=ai&from=2026-11-02&to=2026-11-02")
		await screen.findByLabelText("AI 호출 기록 표")
		const last = urls.at(-1)
		expect(last.searchParams.get("from")).toMatch(/^2026-11-0[12]T\d{2}:00:00Z$/)
		expect(last.searchParams.get("to")).toMatch(/Z$/)
		expect(
			new Date(last.searchParams.get("to")) - new Date(last.searchParams.get("from")),
		).toBe(24 * 60 * 60 * 1000)
		const form = screen.getByRole("form", { name: "AI 호출 기록 필터" })
		await user.clear(within(form).getByLabelText("종료일"))
		await user.type(within(form).getByLabelText("종료일"), "2026-11-01")
		expect(within(form).getByRole("alert")).toHaveTextContent(
			"시작일은 종료일보다 늦을 수 없어요.",
		)
		expect(within(form).getByRole("button", { name: "조회" })).toBeDisabled()
		server.events.removeAllListeners()
	})
	it("엔드포인트 필터에 질문 답변(/v1/cases/ask)·참고 사례 찾기가 있다 — 계약서 5.9 + SCRUM-309", async () => {
		const user = renderApp()
		const form = await screen.findByRole("form", { name: "AI 호출 기록 필터" })
		const options = await optionValues(user, within(form).getByLabelText("엔드포인트"))
		expect(options).toEqual([
			"",
			"/v1/scores",
			"/v1/str/drafts",
			"/v1/str/verify",
			"/v1/cases/summary",
			"/v1/cases/ask",
			"/v1/health",
			"/v1/references/search",
		])
	})
	it("결과가 없으면 안내와 [필터 초기화]", async () => {
		const user = renderApp("/admin/audit?tab=ai&error_code=NOPE")
		expect(await screen.findByText("조건에 맞는 기록이 없어요.")).toBeInTheDocument()
		await user.click(screen.getAllByRole("button", { name: "필터 초기화" }).at(-1))
		expect(await rows("AI 호출 기록")).toHaveLength(6)
	})
	it("조회가 실패하면 빈 결과가 아니라 실패 안내와 [다시 불러오기]", async () => {
		server.use(
			http.get("*/api/v1/admin/ai-calls", () =>
				HttpResponse.json(
					{ error: { code: "INTERNAL_ERROR", message: "서버 오류", details: {} } },
					{ status: 500 },
				),
			),
		)
		renderApp()
		expect(await screen.findByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "다시 불러오기" })).toBeInTheDocument()
		expect(screen.queryByText("조건에 맞는 기록이 없어요.")).not.toBeInTheDocument()
	})
})

// 상태 배지(SCRUM-332) — 성공·실패를 색(data-tone)과 글자 둘 다로 구분하고, 강조는 상태 칸 배지에만.
const badgesIn = (row) => [...row.querySelectorAll(".status-badge")]
describe("감사 기록 상태 배지 (SCRUM-332)", () => {
	it("AI 호출 결과는 성공 success · 실패 danger 배지 — 글자로도 구분되고 행 전체는 칠하지 않는다", async () => {
		renderApp()
		const list = await rows("AI 호출 기록")
		const failed = badgesIn(list[0])
		expect(failed).toHaveLength(1)
		expect(failed[0]).toHaveAttribute("data-tone", "danger")
		expect(failed[0]).toHaveTextContent("실패 · AI_TIMEOUT")
		const ok = list.flatMap(badgesIn).filter((b) => b.dataset.tone === "success")
		expect(ok.length).toBeGreaterThan(0)
		ok.forEach((b) => expect(b).toHaveTextContent("성공"))
		list.forEach((row) => expect(row).not.toHaveAttribute("data-tone"))
	})
	it("접근 기록은 로그인 성공·실패만 배지, 다른 동작은 글자 그대로", async () => {
		const user = renderApp()
		await user.click(await screen.findByRole("tab", { name: "접근 기록" }))
		const list = await rows("접근 기록")
		const badges = list.flatMap(badgesIn)
		expect(badges.map((b) => [b.dataset.tone, b.textContent])).toEqual([
			["danger", "로그인 실패"],
			["success", "로그인"],
		])
		expect(badgesIn(list[0])).toHaveLength(0)
		expect(within(list[0]).getByText("역할 변경")).toBeInTheDocument()
	})
})

describe("접근 기록 탭", () => {
	it("탭을 바꾸면 접근 기록을 부르고, 동작·사용자 필터가 된다", async () => {
		const urls = recordUrls("/api/v1/admin/access-logs")
		const user = renderApp()
		await user.click(await screen.findByRole("tab", { name: "접근 기록" }))
		const list = await rows("접근 기록")
		expect(list).toHaveLength(5)
		expect(within(list[0]).getByText("역할 변경")).toBeInTheDocument()
		expect(within(list[0]).getByText("계정 inv02")).toBeInTheDocument()
		expect(within(list[0]).getByText("예시 admin")).toBeInTheDocument()
		expect(within(list[2]).getByText("케이스 CASE-2022-001004")).toBeInTheDocument()
		const form = screen.getByRole("form", { name: "접근 기록 필터" })
		await pickOption(user, within(form).getByLabelText("동작"), "LOGIN_FAIL")
		await user.click(within(form).getByRole("button", { name: "조회" }))
		await waitFor(async () => expect(await rows("접근 기록")).toHaveLength(1))
		expect(
			within((await rows("접근 기록"))[0]).getByText("입력한 아이디 nobody"),
		).toBeInTheDocument()
		expect(urls.at(-1).searchParams.get("action")).toBe("LOGIN_FAIL")
		server.events.removeAllListeners()
	})
	it("대상 번호는 대상 종류를 고른 뒤 그 종류의 번호 모양으로 안내하고, 화면 번호 그대로 보낸다", async () => {
		const urls = recordUrls("/api/v1/admin/access-logs")
		const user = renderApp("/admin/audit?tab=access")
		await rows("접근 기록")
		const form = screen.getByRole("form", { name: "접근 기록 필터" })
		expect(within(form).getByLabelText("대상 번호")).toBeDisabled()
		await pickOption(user, within(form).getByLabelText("대상 종류"), "STR_DRAFT")
		expect(within(form).getByLabelText("대상 번호")).toHaveAttribute(
			"placeholder",
			"예: DRF-000123",
		)
		await user.type(within(form).getByLabelText("대상 번호"), "DRF-000124")
		await user.click(within(form).getByRole("button", { name: "조회" }))
		await waitFor(async () => expect(await rows("접근 기록")).toHaveLength(1))
		expect(urls.at(-1).searchParams.get("target_type")).toBe("STR_DRAFT")
		expect(urls.at(-1).searchParams.get("target_id")).toBe("DRF-000124")
		server.events.removeAllListeners()
	})
	it("400 details 는 그 필터 칸 아래에 서버 문구로 — target_id_with_type 은 대상 번호, real_dates 는 시작일", async () => {
		server.use(
			http.get("*/api/v1/admin/access-logs", () =>
				HttpResponse.json(
					{
						error: {
							code: "INVALID_REQUEST",
							message: "요청 값이 올바르지 않습니다",
							details: {
								target_id: "CASE 번호 형식이 아닙니다 (예: CASE-2022-000057)",
								real_dates: "from·to 에 없는 날짜가 있습니다",
							},
						},
					},
					{ status: 400 },
				),
			),
		)
		renderApp("/admin/audit?tab=access&target_type=CASE&target_id=DRF-000001")
		const form = await screen.findByRole("form", { name: "접근 기록 필터" })
		const targetId = within(form).getByLabelText("대상 번호")
		await waitFor(() => expect(targetId).toHaveAttribute("aria-invalid", "true"))
		expect(
			within(form).getByText("CASE 번호 형식이 아닙니다 (예: CASE-2022-000057)"),
		).toBeInTheDocument()
		expect(within(form).getByLabelText("시작일")).toHaveAttribute("aria-invalid", "true")
		expect(within(form).getByText("from·to 에 없는 날짜가 있습니다")).toBeInTheDocument()
		// 입력은 그대로 남아 고쳐서 다시 조회할 수 있다
		expect(targetId).toHaveValue("DRF-000001")
	})
	it("400 details.parameter(쿼리 타입 오류)는 그 값이 가리키는 칸 아래에 '값을 확인해 주세요'", async () => {
		server.use(
			http.get("*/api/v1/admin/access-logs", () =>
				HttpResponse.json(
					{
						error: {
							code: "INVALID_REQUEST",
							message: "요청 파라미터가 올바르지 않습니다",
							details: { parameter: "action" },
						},
					},
					{ status: 400 },
				),
			),
		)
		renderApp("/admin/audit?tab=access&action=NOPE")
		const form = await screen.findByRole("form", { name: "접근 기록 필터" })
		const action = within(form).getByLabelText("동작")
		await waitFor(() => expect(action).toHaveAttribute("aria-invalid", "true"))
		expect(action).toHaveAccessibleDescription("값을 확인해 주세요.")
	})
	it("관리자가 아니면 화면을 볼 수 없다", async () => {
		renderApp("/admin/audit", "inv01")
		expect(await screen.findByRole("heading", { name: "권한이 없어요" })).toBeInTheDocument()
	})
})
