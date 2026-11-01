import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { server } from "../mocks/server"

function renderPage() {
	const queryClient = createQueryClient()
	render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/dev/connection"]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return Object.assign(userEvent.setup(), { queryClient })
}

const row = (name) => screen.getByRole("rowheader", { name }).closest("tr")

describe("백엔드 연동 확인", () => {
	it("로그인 전에도 열리고 서버·API 문서·세션을 차례로 확인한다", async () => {
		const user = renderPage()
		await user.click(await screen.findByRole("button", { name: "전체 확인" }))
		expect(await within(row("현재 세션")).findByText("통과")).toBeInTheDocument()
		expect(within(row("서버 상태")).getByText("UP")).toBeInTheDocument()
		expect(within(row("API 문서")).getByText(/경로 3개/)).toBeInTheDocument()
		expect(within(row("현재 세션")).getByText(/401 정상 응답/)).toBeInTheDocument()
	})

	it("테스트 로그인 뒤 세션을 다시 확인하고 로그아웃으로 쓰기 요청을 확인한다", async () => {
		const user = renderPage()
		await user.selectOptions(await screen.findByLabelText("테스트 계정"), "apr01")
		await user.click(screen.getByRole("button", { name: "테스트 로그인" }))
		expect(
			await within(row("현재 세션")).findByText(/로그인됨 — 예시 apr01 \(apr01\) · APPROVER/),
		).toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: "로그아웃" }))
		expect(await within(row("로그아웃 (CSRF)")).findByText(/204/)).toBeInTheDocument()
		expect(await within(row("현재 세션")).findByText(/401 정상 응답/)).toBeInTheDocument()
	})

	it("서버가 꺼져 있으면 실패를 보여 주고 나머지 항목도 계속 확인한다", async () => {
		server.use(
			http.get("*/actuator/health", () => HttpResponse.error()),
			http.post("*/api/v1/auth/logout", () =>
				HttpResponse.json({ error: { code: "CSRF_INVALID" } }, { status: 403 }),
			),
		)
		const user = renderPage()
		await user.click(await screen.findByRole("button", { name: "전체 확인" }))
		expect(await within(row("현재 세션")).findByText("통과")).toBeInTheDocument()
		expect(within(row("서버 상태")).getByText("실패")).toBeInTheDocument()
		// 기본 API 주소는 같은 출처라 CORS가 아닌 연결 실패 안내가 나옵니다.
		expect(within(row("서버 상태")).getByText(/서버에 연결하지 못했어요/)).toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: "로그아웃" }))
		expect(await within(row("로그아웃 (CSRF)")).findByText(/CSRF_INVALID/)).toBeInTheDocument()
	})
})
