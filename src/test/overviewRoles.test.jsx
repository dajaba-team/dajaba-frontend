import { afterEach, describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { http } from "msw"
import { server } from "../mocks/server"
import { resetCases } from "../mocks/handlers"
import OverviewPage from "../features/overview/pages/OverviewPage"

// 역할별 대시보드(SCRUM-345) — 관리자만 경보 통계(BE SCRUM-360)를 부르고, 날짜 없이 전체 기간 누적.
const USERS = {
	admin: { id: 4, login_id: "admin", display_name: "관리자", role: "ADMIN" },
	inv01: { id: 1, login_id: "inv01", display_name: "조사역", role: "INVESTIGATOR" },
}

function show(who) {
	resetCases(USERS[who])
	const calls = []
	server.events.on("request:start", ({ request }) => {
		const url = new URL(request.url)
		if (url.pathname === "/api/v1/admin/alerts/stats") calls.push(url.searchParams.get("date"))
	})
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	render(
		<QueryClientProvider client={client}>
			<MemoryRouter>
				<OverviewPage />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return calls
}

afterEach(() => {
	sessionStorage.clear()
	server.events.removeAllListeners()
})

describe("역할별 대시보드", () => {
	it("관리자는 전체 기간 누적 경보 통계로 카드·도넛을 그린다 — 배치 화면에서 고른 날짜와 무관", async () => {
		sessionStorage.setItem("dajaba.batches.date.v1.admin", "2022-09-08")
		const calls = show("admin")
		expect(
			await screen.findByRole("heading", { name: "경보 위험 등급 분포" }),
		).toBeInTheDocument()
		expect(calls).toEqual([null]) // date 없이 호출
		expect(screen.getByText("전체 기간 탐지 경보 기준")).toBeInTheDocument()
		expect(screen.getByText("탐지 경보")).toBeInTheDocument()
	})

	it("조사역은 경보 통계를 부르지 않고 케이스 위험 등급 분포를 본다", async () => {
		const calls = show("inv01")
		expect(await screen.findByRole("heading", { name: "위험 등급 분포" })).toBeInTheDocument()
		expect(screen.getByText("보완할 초안")).toBeInTheDocument()
		expect(calls).toEqual([])
	})

	it("경보 통계를 못 불러오면 오류와 다시 불러오기를 보여 준다", async () => {
		server.use(http.get("*/api/v1/admin/alerts/stats", () => Response.error()))
		show("admin")
		expect(await screen.findByRole("alert")).toHaveTextContent("데이터를 불러오지 못했습니다.")
		expect(screen.queryByRole("heading", { name: "경보 위험 등급 분포" })).toBeNull()
	})
})
