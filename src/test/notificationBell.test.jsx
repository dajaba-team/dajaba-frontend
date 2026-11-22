import { beforeEach, describe, expect, it } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { server } from "../mocks/server"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { addNotifications } from "../mocks/notifications"
import { seenKey } from "../features/notifications/model/notificationRules"

// 위 띠 종 + 업무 알림 목록 (설계 7.5·7.8절, SCRUM-334). MSW 시드: inv01 6건, apr01 1건, 관리자 빈 목록.
const users = {
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	apr01: { id: 3, login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" },
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}
const UTC_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

function renderApp(who = "inv01", path = "/cases") {
	resetCases(users[who])
	const client = createQueryClient()
	const user = userEvent.setup()
	render(
		<QueryClientProvider client={client}>
			<MemoryRouter initialEntries={[path]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return { user, client }
}

const summary = (name) =>
	screen.findByText(
		(_, element) =>
			element?.tagName === "SUMMARY" && element.getAttribute("aria-label") === name,
	)
const panel = () => screen.getByRole("region", { name: "알림 목록" })

beforeEach(() => {
	localStorage.clear()
})

describe("알림 종 — 숫자", () => {
	it("안 본 알림 수를 보여 주고, 목록을 열면 본 것으로 쳐서 숫자가 사라진다", async () => {
		const { user } = renderApp()
		const button = await summary("알림, 새 알림 6건")
		expect(within(button).getByText("6")).toBeInTheDocument()
		await user.click(button)
		const items = await within(panel()).findAllByRole("listitem")
		expect(items).toHaveLength(6)
		expect(items[0]).toHaveTextContent("CASE-2022-001001 STR이 반려됐어요 · 보완 요청")
		expect(items[0]).toHaveTextContent("예시 apr01")
		expect(within(panel()).getAllByText("새 알림")).toHaveLength(6)
		// 본 시각은 화면 시계가 아니라 응답 server_time(Z) 그대로, 로그인 아이디별
		await waitFor(() => expect(localStorage.getItem(seenKey("inv01"))).toMatch(UTC_Z))
		expect(await summary("알림")).toBeInTheDocument()
		// 닫았다 다시 열면 같은 알림이 남아 있되 "새 알림"은 없어요
		await user.click(await summary("알림"))
		await user.click(await summary("알림"))
		expect(await within(panel()).findAllByRole("listitem")).toHaveLength(6)
		await waitFor(() => expect(within(panel()).queryByText("새 알림")).not.toBeInTheDocument())
	})
	it("total이 99면 99+로 보여 준다", async () => {
		resetCases(users.inv01)
		addNotifications(
			Array.from({ length: 120 }, (_, index) => ({
				recipient: "inv01",
				type: "CASE_ASSIGNED",
				case_no: "CASE-2022-001004",
				actor: { login_id: "admin", display_name: "예시 admin" },
				minutes_ago: 60 + index,
			})),
		)
		const client = createQueryClient()
		render(
			<QueryClientProvider client={client}>
				<MemoryRouter initialEntries={["/cases"]}>
					<App />
				</MemoryRouter>
			</QueryClientProvider>,
		)
		const button = await summary("알림, 새 알림 99+건")
		expect(within(button).getByText("99+")).toBeInTheDocument()
	})
	it("관리자는 숫자 없이, 열면 '새 알림이 없어요'", async () => {
		const { user } = renderApp("admin", "/admin/audit")
		const button = await summary("알림")
		await user.click(button)
		expect(await within(panel()).findByText("새 알림이 없어요.")).toBeInTheDocument()
	})
	it("승인자는 승인 요청을 받고, 누르면 승인함으로 간다", async () => {
		const { user } = renderApp("apr01", "/approvals")
		await user.click(await summary("알림, 새 알림 1건"))
		const link = await within(panel()).findByRole("link", {
			name: /CASE-2022-001001 승인 요청이 왔어요/,
		})
		expect(link).toHaveAttribute("href", "/approvals")
	})
})

describe("알림 종 — 갱신·실패·이동", () => {
	it("로그인 직후 첫 조회엔 토스트가 없고, 다시 불렀을 때 늘었으면 '새 알림 n건' 하나만", async () => {
		const { client } = renderApp()
		await summary("알림, 새 알림 6건")
		expect(screen.queryByText(/^새 알림 \d+건$/)).not.toBeInTheDocument()
		addNotifications([
			{
				recipient: "inv01",
				type: "CASE_ASSIGNED",
				case_no: "CASE-2022-001004",
				actor: { login_id: "admin", display_name: "예시 admin" },
				minutes_ago: 1,
			},
			{
				recipient: "inv01",
				type: "CASE_ASSIGNED",
				case_no: "CASE-2022-001002",
				actor: { login_id: "admin", display_name: "예시 admin" },
				minutes_ago: 2,
			},
		])
		await client.refetchQueries({ queryKey: ["notifications"] })
		expect(await screen.findByText("새 알림 2건")).toBeInTheDocument()
		expect(await summary("알림, 새 알림 8건")).toBeInTheDocument()
	})
	it("조회가 실패하면 숫자는 그대로, 에러 토스트 없음", async () => {
		const { client } = renderApp()
		await summary("알림, 새 알림 6건")
		server.use(
			http.get("*/api/v1/notifications", () =>
				HttpResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 }),
			),
		)
		await client.refetchQueries({ queryKey: ["notifications"] })
		expect(await summary("알림, 새 알림 6건")).toBeInTheDocument()
		expect(screen.queryByRole("alert")).not.toBeInTheDocument()
	})
	it("목록 조회가 실패하면 목록 자리에만 안내 + [다시 불러오기]", async () => {
		const { user } = renderApp()
		const button = await summary("알림, 새 알림 6건")
		server.use(
			http.get("*/api/v1/notifications", ({ request }) =>
				new URL(request.url).searchParams.get("size") === "20"
					? HttpResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 })
					: HttpResponse.json({
							items: [],
							total: 6,
							server_time: "2026-11-22T00:00:00Z",
						}),
			),
		)
		await user.click(button)
		const alert = await within(panel()).findByRole("alert")
		expect(alert).toHaveTextContent("알림을 불러오지 못했어요.")
		expect(within(alert).getByRole("button", { name: "다시 불러오기" })).toBeInTheDocument()
		// 목록을 못 받았으니 본 것으로 치지 않아요
		expect(localStorage.getItem(seenKey("inv01"))).toBeNull()
	})
	it("알림을 누르면 해당 화면으로 가고 목록이 닫힌다", async () => {
		const { user } = renderApp()
		await user.click(await summary("알림, 새 알림 6건"))
		await user.click(
			await within(panel()).findByRole("link", { name: /STR이 반려됐어요 · 보완 요청/ }),
		)
		expect(await screen.findByRole("heading", { name: "STR 보고서 초안" })).toBeInTheDocument()
		expect(
			screen.getByText(
				(_, el) => el?.tagName === "DETAILS" && el.classList.contains("notification-bell"),
			),
		).not.toHaveAttribute("open")
	})
	it("계정마다 본 시각을 따로 기억한다", async () => {
		localStorage.setItem(seenKey("apr01"), "2099-01-01T00:00:00Z")
		renderApp()
		// inv01은 apr01의 본 시각과 상관없이 6건
		expect(await summary("알림, 새 알림 6건")).toBeInTheDocument()
	})
})
