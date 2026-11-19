import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import DashboardView from "../features/overview/components/DashboardView"

const sample = [
	{ caseNo: "CASE-HIGH", status: "OPEN", score: 0.94, scoreBand: "HIGH", assignee: null },
	{
		caseNo: "CASE-NONE",
		status: "PENDING_APPROVAL",
		score: null,
		scoreBand: "HIGH",
		assignee: { displayName: "조사역" },
	},
	{ caseNo: "CASE-ZERO", status: "REVIEWING", score: 0, scoreBand: "LOW", assignee: null },
]
function show(items = sample) {
	return render(
		<MemoryRouter>
			<DashboardView items={items} total={123} description="테스트 업무" onStart={() => {}} />
		</MemoryRouter>,
	)
}
describe("일반 대시보드의 데이터 범위", () => {
	it("전체 건수와 조회 범위를 구분하며 미산출을 고위험이나 0점으로 바꾸지 않는다", () => {
		show()
		const cards = within(screen.getByRole("region", { name: "업무 현황 요약" })).getAllByRole(
			"article",
		)
		expect(cards[0]).toHaveTextContent("123")
		expect(cards[1]).toHaveTextContent("1건")
		expect(cards[1]).toHaveTextContent("상위 3건 기준")
		expect(
			screen.getByRole("img", {
				name: /높음 · HIGH 1건.*낮음 · LOW 1건.*미산출·등급 없음 1건/,
			}),
		).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "우선순위", exact: true })).toBeNull()
		expect(screen.getByRole("heading", { name: "조사 흐름 한눈에 보기" })).toBeInTheDocument()
		expect(
			screen.getByRole("heading", { name: "지금 바로 확인해야 할 케이스" }),
		).toBeInTheDocument()
		// 계기판: 바늘은 HIGH 비율(3건 중 1건 → 60도), 읽기 칸은 HIGH 건수
		expect(document.querySelector(".risk-gauge-needle")).toHaveStyle("--needle: 60deg")
		expect(document.querySelector(".risk-gauge-readout")).toHaveTextContent("전체 3건 중 33%")
		// 확인할 케이스 줄: 점수 있는 케이스만 등급 배지, 미산출은 배지·등급색 없음
		const rows = document.querySelectorAll(".focus-case")
		expect(rows[0]).toHaveAttribute("data-band", "HIGH")
		expect(within(rows[0]).getByText("HIGH")).toBeInTheDocument()
		expect(rows[1]).toHaveAttribute("data-band", "NONE")
		expect(rows[1].querySelector(".band-badge")).toBeNull()
		expect(rows[2]).toHaveAttribute("data-band", "LOW")
		expect(screen.getByRole("link", { name: "CASE-HIGH" })).toHaveAttribute(
			"href",
			"/cases/CASE-HIGH",
		)
	})
	it("빈 결과는 케이스·점수 없음 안내를 보여 준다", () => {
		show([])
		expect(screen.getByText("조회 가능한 케이스가 없습니다.")).toBeInTheDocument()
	})
})
