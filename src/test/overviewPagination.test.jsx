import { describe, expect, it } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { http, HttpResponse } from "msw"
import { server } from "../mocks/server"
import { resetCases } from "../mocks/handlers"
import OverviewPage from "../features/overview/pages/OverviewPage"

function show(role = "INVESTIGATOR", options = {}) {
	resetCases(
		{ id: 1, login_id: role === "APPROVER" ? "apr01" : "inv01", display_name: "테스트", role },
		options,
	)
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	render(
		<QueryClientProvider client={client}>
			<MemoryRouter>
				<OverviewPage />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return client
}

function fixture(total) {
	return Array.from({ length: total }, (_, i) => ({
		case_no: `CASE-${i + 1}`,
		status: i === total - 1 ? "PENDING_APPROVAL" : "REVIEWING",
		score: 1 - i / 1000,
		score_band: i === total - 1 ? "MEDIUM" : "HIGH",
		assignee: i === total - 1 ? null : { login_id: "inv01", display_name: "조사역" },
	}))
}

// 요청마다 받은 assignee 파라미터 (SCRUM-337) — pages 배열 모양은 그대로 두려고 따로 모아요
const assignees = []

function serve(rows, { failSecond = () => false, totalForPage = () => rows.length } = {}) {
	const pages = []
	assignees.length = 0
	server.use(
		http.get("*/api/v1/cases", ({ request }) => {
			const params = new URL(request.url).searchParams
			assignees.push(params.get("assignee"))
			const page = Number(params.get("page"))
			const size = Number(params.get("size"))
			pages.push(page)
			expect(size).toBeLessThanOrEqual(100)
			expect(params.get("sort")).toBe("created_at,asc")
			if (page === 1 && failSecond()) return new HttpResponse(null, { status: 500 })
			return HttpResponse.json({
				items: rows.slice(page * size, (page + 1) * size),
				page,
				size,
				total: totalForPage(page),
			})
		}),
	)
	return pages
}

// CountUp 애니메이션 중간값 대신 접근성에 제공하는 실제 집계값을 검증한다.
function expectCount(card, count) {
	expect(card.querySelector(".count-up")).toHaveAttribute("aria-label", String(count))
}

async function cards() {
	return within(await screen.findByRole("region", { name: "업무 현황 요약" })).getAllByRole(
		"article",
	)
}

describe("SCRUM-335 전체 케이스 집계", () => {
	it.each(["APPROVER", "ADMIN"])(
		"%s: 28번째 승인 대기를 카드와 차트에 포함한다",
		async (role) => {
			serve(fixture(28))
			show(role)
			const summary = await cards()
			expectCount(summary[3], 1) // 승인 대기
			expect(screen.getByRole("img", { name: /승인 대기: 1/ })).toBeInTheDocument()
			if (role === "APPROVER") {
				// 승인자: 전체 · 조사 중 · 보완 중 · 승인 대기(SCRUM-345)
				expectCount(summary[0], 28)
				expectCount(summary[1], 27)
				expectCount(summary[2], 0)
				expect(
					screen.getByRole("img", { name: /높음 · HIGH 27건.*중간 · MEDIUM 1건/ }),
				).toBeInTheDocument()
			} else {
				// 관리자: 앞 두 칸은 경보 통계(BE SCRUM-360), 미배정은 케이스 기준
				expect(summary[0]).toHaveTextContent("탐지 경보")
				expectCount(summary[2], 1)
			}
			// 승인자는 우선 목록 자리에 승인 대기 보고서가 와요(SCRUM-336) — 점수 높은 케이스 줄은 관리자만
			if (role === "ADMIN") expect(document.querySelectorAll(".focus-case")).toHaveLength(3)
		},
	)

	it("100건 이후 페이지까지 집계하고 케이스 무효화 때 승인 상태를 갱신한다", async () => {
		const rows = fixture(128)
		const pages = serve(rows)
		const client = show()
		expectCount((await cards())[3], 1)
		expect(pages).toEqual([0, 1])
		rows[127].status = "APPROVED"
		await act(() => client.invalidateQueries({ queryKey: ["cases"] }))
		await waitFor(() =>
			expectCount(screen.getByRole("region", { name: "업무 현황 요약" }).lastElementChild, 0),
		)
		expect(pages).toEqual([0, 1, 0, 1])
	})

	it("[새로고침]을 누르면 케이스를 다시 불러와 바뀐 숫자를 보여 준다 (SCRUM-345)", async () => {
		const rows = fixture(3)
		const pages = serve(rows)
		show()
		expectCount((await cards())[3], 1)
		expect(pages).toEqual([0])
		rows[0].status = "PENDING_APPROVAL"
		await userEvent.setup().click(screen.getByRole("button", { name: "새로고침" }))
		await waitFor(() => expectCount(screen.getAllByRole("article")[3], 2))
		expect(pages).toEqual([0, 0])
		expect(screen.getByRole("button", { name: "새로고침" })).toBeEnabled()
		expect(screen.getByText(/^마지막 갱신 \d{2}:\d{2}:\d{2}$/)).toBeInTheDocument()
		// 조사 진행 현황에는 전체 건수 줄이 없어요(위 카드·도넛과 겹쳐서)
		expect(document.querySelector(".trend-summary")).toBeNull()
	})

	it("뒤 페이지 실패 시 부분 통계를 숨기고 다시 불러오면 전체를 표시한다", async () => {
		let failing = true
		serve(fixture(128), { failSecond: () => failing })
		show()
		await screen.findByRole("alert")
		expect(screen.queryByRole("region", { name: "업무 현황 요약" })).toBeNull()
		failing = false
		await userEvent.setup().click(screen.getByRole("button", { name: "다시 불러오기" }))
		expectCount((await cards())[0], 128)
	})

	it("조회 도중 전체 수가 바뀌면 불완전한 집계를 표시하지 않는다", async () => {
		serve(fixture(128), { totalForPage: (page) => (page ? 129 : 128) })
		show()
		await screen.findByRole("alert")
		expect(screen.queryByRole("region", { name: "업무 현황 요약" })).toBeNull()
	})

	it("빈 목록도 정상적인 전체 0건으로 표시한다", async () => {
		const pages = serve([])
		show("ADMIN")
		expectCount((await cards())[3], 0)
		expect(pages).toEqual([0])
		expect(screen.getByText("현재 확인할 케이스가 없습니다.")).toBeInTheDocument()
	})
})

describe("SCRUM-337 조사역 대시보드는 내 담당만", () => {
	it("조사역은 assignee=me 로 모든 페이지를 부르고, 미배정 대신 보완할 초안을 센다", async () => {
		const rows = fixture(128)
		rows[0].status = "REJECTED"
		rows[0].rejection_reason_code = "NEED_REVISION"
		rows[1].status = "REJECTED"
		rows[1].rejection_reason_code = "NOT_REPORTABLE" // 보고 안 함 반려는 보완 대상 아님
		const pages = serve(rows)
		show("INVESTIGATOR")
		const summary = await cards()
		expect(pages).toEqual([0, 1])
		expect(assignees).toEqual(["me", "me"])
		expect(summary[0]).toHaveTextContent("내 담당 케이스")
		expect(summary[2]).toHaveTextContent("보완할 초안")
		expectCount(summary[2], 1)
		// 2번은 조사 중(조사 중·에스컬레이션·초안) — 반려 2건·승인 대기 1건은 빼요(SCRUM-345)
		expect(summary[1]).toHaveTextContent("조사 중")
		expectCount(summary[1], 125)
		expect(screen.queryByText("미배정 케이스")).toBeNull()
		expect(screen.getByRole("link", { name: "내 담당 케이스", exact: true })).toHaveAttribute(
			"href",
			"/cases?mine=1",
		)
		// 카드 안 링크·맨 아래 안내는 없고(SCRUM-345) 범위는 도넛 설명, 보완할 초안 기준은 ⓘ 로
		expect(screen.queryByRole("link", { name: "케이스에서 확인" })).toBeNull()
		expect(screen.getByText("내 담당 케이스 기준")).toBeInTheDocument()
		expect(
			within(summary[2]).getByRole("button", { name: "보완할 초안 설명" }),
		).toHaveAccessibleDescription(/본문을 고쳐 저장하기 시작하면 빠져요/)
	})

	it.each(["APPROVER", "ADMIN"])("%s는 지금처럼 전체를 센다(assignee 없음)", async (role) => {
		serve(fixture(3))
		show(role)
		const summary = await cards()
		expect(assignees).toEqual([null])
		if (role === "APPROVER") {
			expect(summary[0]).toHaveTextContent("전체 조회 케이스")
			expect(summary[2]).toHaveTextContent("보완 중")
		} else {
			expect(summary[2]).toHaveTextContent("미배정 케이스")
			expect(screen.getByRole("link", { name: /전체 케이스/ })).toHaveAttribute(
				"href",
				"/cases",
			)
		}
	})

	it("조사역에게 배정된 케이스가 없으면 그렇게 안내한다", async () => {
		serve([])
		show("INVESTIGATOR")
		await cards()
		expect(screen.getByText("나에게 배정된 케이스가 없습니다.")).toBeInTheDocument()
	})
})

describe("SCRUM-336 승인자 대시보드는 승인 대기 보고서 중심", () => {
	it("우선 목록에 승인함 P1 줄을 보여 주고 초안 검토 화면으로 보낸다", async () => {
		show("APPROVER", { pendingApproval: true })
		const panel = await screen.findByRole("region", { name: "검토를 기다리는 보고서" })
		const review = await within(panel).findByRole("link", { name: /초안 검토하기/ })
		expect(review).toHaveAttribute("href", "/cases/CASE-2022-001001/str")
		expect(within(panel).getByText(/CASE-2022-001001/)).toBeInTheDocument()
		expect(within(panel).getByRole("link", { name: /승인함 전체 1건/ })).toHaveAttribute(
			"href",
			"/approvals",
		)
		// 점수 높은 미배정·접수 케이스 목록은 승인자 화면에 없다
		expect(screen.queryByRole("heading", { name: "지금 바로 확인해야 할 케이스" })).toBeNull()
	})

	it("승인 대기가 없으면 빈 상태를 보여 준다", async () => {
		show("APPROVER")
		const panel = await screen.findByRole("region", { name: "검토를 기다리는 보고서" })
		expect(
			await within(panel).findByText("검토를 기다리는 보고서가 없습니다."),
		).toBeInTheDocument()
	})

	it("조사역·관리자는 지금처럼 점수 높은 케이스 목록", async () => {
		serve(fixture(3))
		show("ADMIN")
		expect(
			await screen.findByRole("heading", { name: "지금 바로 확인해야 할 케이스" }),
		).toBeInTheDocument()
		expect(screen.queryByRole("region", { name: "검토를 기다리는 보고서" })).toBeNull()
	})
})
