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

// 감사 기록 화면 (SCRUM-170, ADM-05). AI 호출 기록은 계약서 5.9 그대로, 접근 기록은 SCRUM-168 전 가정 모양.
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
		await user.selectOptions(within(form).getByLabelText("결과"), "FAILURE")
		await user.selectOptions(within(form).getByLabelText("대상 종류"), "DRAFT")
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

describe("접근 기록 탭", () => {
	it("탭을 바꾸면 접근 기록을 부르고, 동작·사용자 필터가 된다", async () => {
		const urls = recordUrls("/api/v1/admin/access-logs")
		const user = renderApp()
		await user.click(await screen.findByRole("tab", { name: "접근 기록" }))
		const list = await rows("접근 기록")
		expect(list).toHaveLength(5)
		expect(within(list[0]).getByText("역할 변경")).toBeInTheDocument()
		expect(within(list[0]).getByText("계정 2")).toBeInTheDocument()
		const form = screen.getByRole("form", { name: "접근 기록 필터" })
		await user.selectOptions(within(form).getByLabelText("동작"), "LOGIN_FAIL")
		await user.click(within(form).getByRole("button", { name: "조회" }))
		await waitFor(async () => expect(await rows("접근 기록")).toHaveLength(1))
		expect(within((await rows("접근 기록"))[0]).getByText("nobody")).toBeInTheDocument()
		expect(urls.at(-1).searchParams.get("action")).toBe("LOGIN_FAIL")
		server.events.removeAllListeners()
	})
	it("관리자가 아니면 화면을 볼 수 없다", async () => {
		renderApp("/admin/audit", "inv01")
		expect(await screen.findByRole("heading", { name: "권한이 없어요" })).toBeInTheDocument()
	})
})
