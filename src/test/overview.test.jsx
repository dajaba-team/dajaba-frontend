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
			<DashboardView
				items={items}
				total={items.length}
				description="테스트 업무"
				onStart={() => {}}
			/>
		</MemoryRouter>,
	)
}
describe("일반 대시보드의 데이터 범위", () => {
	it("전체 조회 범위를 표시하며 미산출을 고위험이나 0점으로 바꾸지 않는다", () => {
		show()
		const cards = within(screen.getByRole("region", { name: "업무 현황 요약" })).getAllByRole(
			"article",
		)
		expect(cards[0]).toHaveTextContent("3건")
		expect(cards[1]).toHaveTextContent("1건")
		// 카드는 제목·건수·아이콘만, 뜻은 제목 옆 ⓘ 툴팁(버튼 설명)으로, 카드 안 이동 링크 없음(SCRUM-345)
		expect(
			cards.map((card) => card.querySelector(".metric-title").firstChild.textContent),
		).toEqual(["전체 케이스", "고위험 케이스", "미배정 케이스", "승인 대기"])
		expect(cards.every((card) => card.querySelector(":scope > p") === null)).toBe(true)
		const tips = [
			["전체 케이스", "조회 가능한 전체 케이스 수"],
			["고위험 케이스", "위험 등급이 HIGH인 케이스 수"],
			["미배정 케이스", "담당 조사역이 배정되지 않은 케이스 수"],
			["승인 대기", "승인자 검토가 필요한 케이스 수"],
		]
		tips.forEach(([name, tip], index) => {
			const info = within(cards[index]).getByRole("button", { name: `${name} 설명` })
			expect(info).toHaveAccessibleDescription(tip)
		})
		expect(screen.queryByRole("link", { name: /케이스에서 확인/ })).toBeNull()
		expect(screen.getByText("조회 가능한 전체 케이스 기준")).toBeInTheDocument() // 위험 등급 분포 설명
		expect(
			screen.getByRole("img", {
				name: /높음 · HIGH 1건.*낮음 · LOW 1건.*미산출·등급 없음 1건/,
			}),
		).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "우선순위", exact: true })).toBeNull()
		expect(screen.getByRole("heading", { name: "조사 진행 현황" })).toBeInTheDocument()
		expect(screen.getByText("케이스의 조사 단계별 진행 현황을 확인하세요.")).toBeInTheDocument()
		expect(
			screen.getByRole("heading", { name: "지금 바로 확인해야 할 케이스" }),
		).toBeInTheDocument()
		expect(screen.getByText("위험도가 높은 케이스를 우선 확인하세요.")).toBeInTheDocument()
		// 맨 아래 안내는 없고, 점수 뜻은 위험 등급 분포 ⓘ 설명으로(SCRUM-345)
		expect(screen.queryByText(/카드와 차트는 현재 계정이/)).toBeNull()
		expect(screen.getByRole("heading", { name: "위험 등급 분포" })).toBeInTheDocument()
		expect(
			screen.getByRole("button", { name: "위험 등급 분포 설명" }),
		).toHaveAccessibleDescription("위험 점수는 범죄 확률이 아닌 조사 우선순위 지표입니다.")
		// 도넛: 건수가 있는 등급만 조각(HIGH·LOW·미산출), 가운데는 전체 케이스 수
		const segments = [...document.querySelectorAll(".risk-donut-segment")]
		expect(segments.map((segment) => segment.dataset.band)).toEqual(["0", "2", "3"])
		expect(document.querySelector(".risk-donut-center .count-up")).toHaveAttribute(
			"aria-label",
			"3",
		)
		expect(document.querySelector(".risk-donut-center")).not.toHaveTextContent("전체 케이스")
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
		expect(screen.getByRole("status")).toHaveTextContent("현재 확인할 케이스가 없습니다.")
		// 도넛은 조각 없이 회색 고리와 가운데 0건
		expect(document.querySelectorAll(".risk-donut-segment")).toHaveLength(0)
		expect(document.querySelector(".risk-donut-track")).not.toBeNull()
		expect(document.querySelector(".risk-donut-center .count-up")).toHaveAttribute(
			"aria-label",
			"0",
		)
		expect(document.querySelector(".risk-donut-center")).not.toHaveTextContent("전체 케이스")
	})
})
