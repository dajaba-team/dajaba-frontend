import { describe, expect, it } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { http, HttpResponse } from "msw"
import { server } from "../mocks/server"
import { resetCases } from "../mocks/handlers"
import OverviewPage from "../features/overview/pages/OverviewPage"

function show(role = "INVESTIGATOR") {
	resetCases({ id: 1, login_id: "inv01", display_name: "테스트", role })
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

function serve(rows, { failSecond = () => false, totalForPage = () => rows.length } = {}) {
	const pages = []
	server.use(
		http.get("*/api/v1/cases", ({ request }) => {
			const params = new URL(request.url).searchParams
			const page = Number(params.get("page"))
			const size = Number(params.get("size"))
			pages.push(page)
			expect(size).toBeLessThanOrEqual(100)
			expect(params.get("sort")).toBe("score,desc")
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
	it.each(["INVESTIGATOR", "APPROVER"])(
		"%s: 28번째 승인 대기를 카드와 차트에 포함한다",
		async (role) => {
			serve(fixture(28))
			show(role)
			const summary = await cards()
			expectCount(summary[0], 28)
			expectCount(summary[1], 27)
			expectCount(summary[2], 1)
			expectCount(summary[3], 1)
			expect(screen.getByRole("img", { name: /승인 대기: 1/ })).toBeInTheDocument()
			expect(
				screen.getByRole("img", { name: /높음 · HIGH 27건.*중간 · MEDIUM 1건/ }),
			).toBeInTheDocument()
			expect(document.querySelectorAll(".focus-case")).toHaveLength(3)
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
		show()
		expectCount((await cards())[3], 0)
		expect(pages).toEqual([0])
		expect(screen.getByText("조회 가능한 케이스가 없습니다.")).toBeInTheDocument()
	})
})
