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
		assignee: { loginId: "inv01", displayName: "조사역" },
	},
	{ caseNo: "CASE-ZERO", status: "REVIEWING", score: 0, scoreBand: "LOW", assignee: null },
]
function show(items = sample, props = {}) {
	return render(
		<MemoryRouter>
			<DashboardView
				items={items}
				total={items.length}
				description="테스트 업무"
				onStart={() => {}}
				{...props}
			/>
		</MemoryRouter>,
	)
}
const kpiCards = () =>
	within(screen.getByRole("region", { name: "업무 현황 요약" })).getAllByRole("article")
const titles = (cards) =>
	cards.map((card) => card.querySelector(".metric-title").firstChild.textContent)

describe("일반 대시보드의 데이터 범위", () => {
	it("조사역은 내 담당 기준 — 조사 중·보완할 초안·승인 대기, 미산출을 고위험이나 0점으로 바꾸지 않는다", () => {
		show(sample, { mine: true })
		const cards = kpiCards()
		expect(cards[0]).toHaveTextContent("3건")
		expect(cards[1]).toHaveTextContent("1건") // 조사 중(REVIEWING) 1건 — 접수·승인 대기는 빼요
		expect(cards[2]).toHaveTextContent("0건")
		expect(cards[3]).toHaveTextContent("1건")
		// 카드는 제목·건수·아이콘만, 뜻은 제목 옆 ⓘ 툴팁(버튼 설명)으로, 카드 안 이동 링크 없음(SCRUM-345)
		expect(titles(cards)).toEqual(["내 담당 케이스", "조사 중", "보완할 초안", "승인 대기"])
		expect(cards.every((card) => card.querySelector(":scope > p") === null)).toBe(true)
		const tips = [
			["내 담당 케이스", "나에게 배정된 케이스 수"],
			[
				"조사 중",
				"내 담당 중 아직 조사하고 있는 케이스 수(조사 중·에스컬레이션·초안 작성됨)",
			],
			[
				"보완할 초안",
				"보완 요청으로 반려된 직후의 초안 수 — 본문을 고쳐 저장하기 시작하면 빠져요",
			],
			["승인 대기", "승인 요청을 올려 승인자 검토를 기다리는 케이스 수"],
		]
		tips.forEach(([name, tip], index) => {
			const info = within(cards[index]).getByRole("button", { name: `${name} 설명` })
			expect(info).toHaveAccessibleDescription(tip)
		})
		expect(screen.queryByRole("link", { name: /케이스에서 확인/ })).toBeNull()
		expect(screen.getByRole("heading", { name: "위험 등급 분포" })).toBeInTheDocument()
		expect(screen.getByText("내 담당 케이스 기준")).toBeInTheDocument()
		expect(
			screen.getByRole("button", { name: "위험 등급 분포 설명" }),
		).toHaveAccessibleDescription("위험 점수는 범죄 확률이 아닌 조사 우선순위 지표입니다.")
		expect(
			screen.getByRole("img", {
				name: /높음 · HIGH 1건.*낮음 · LOW 1건.*미산출·등급 없음 1건/,
			}),
		).toBeInTheDocument()
		// 도넛: 건수가 있는 등급만 조각(HIGH·LOW·미산출), 가운데는 전체 케이스 수
		const segments = [...document.querySelectorAll(".risk-donut-segment")]
		expect(segments.map((segment) => segment.dataset.band)).toEqual(["0", "2", "3"])
		expect(document.querySelector(".risk-donut-center")).not.toHaveAttribute("data-long")
		expect(document.querySelector(".risk-donut-center .count-up")).toHaveAttribute(
			"aria-label",
			"3",
		)
		expect(document.querySelector(".risk-donut-center")).not.toHaveTextContent("전체 케이스")
		expect(screen.getByRole("heading", { name: "조사 진행 현황" })).toBeInTheDocument()
		expect(screen.getByText("케이스의 조사 단계별 진행 현황을 확인하세요.")).toBeInTheDocument()
		expect(
			screen.getByRole("heading", { name: "지금 바로 확인해야 할 케이스" }),
		).toBeInTheDocument()
		expect(
			screen.getByText("위험 점수가 가장 높은 케이스예요. 지금 바로 열어 확인해 주세요."),
		).toBeInTheDocument()
		expect(screen.getByRole("link", { name: /내 담당 케이스/ })).toHaveAttribute(
			"href",
			"/cases?mine=1",
		)
		expect(screen.queryByText(/카드와 차트는 현재 계정이/)).toBeNull()
		// 확인할 케이스 줄: 점수 있는 케이스만 등급 배지, 미산출은 배지·등급색 없음
		const rows = document.querySelectorAll(".focus-case")
		expect(rows[0]).toHaveAttribute("data-band", "HIGH")
		expect(within(rows[0]).getByText("HIGH")).toBeInTheDocument()
		expect(within(rows[0]).getByText("0.94")).toBeInTheDocument() // 둘째 자리 (SCRUM-392)
		expect(within(rows[2]).getByText("0.00")).toBeInTheDocument()
		expect(rows[1]).toHaveAttribute("data-band", "NONE")
		expect(rows[1].querySelector(".band-badge")).toBeNull()
		expect(rows[2]).toHaveAttribute("data-band", "LOW")
		expect(screen.getByRole("link", { name: "CASE-HIGH" })).toHaveAttribute(
			"href",
			"/cases/CASE-HIGH",
		)
	})

	it("승인자는 전체 기준 같은 단계 — 조사 중·보완 중·승인 대기, 보고 안 함 반려는 보완이 아니다", () => {
		show([
			...sample,
			{
				caseNo: "CASE-REV",
				status: "REJECTED",
				rejectionReasonCode: "NEED_REVISION",
				score: 0.8,
			},
			{
				caseNo: "CASE-NR",
				status: "REJECTED",
				rejectionReasonCode: "NOT_REPORTABLE",
				score: 0.8,
			},
		])
		const cards = kpiCards()
		expect(titles(cards)).toEqual(["전체 조회 케이스", "조사 중", "보완 중", "승인 대기"])
		expect(cards[0]).toHaveTextContent("5건")
		expect(cards[1]).toHaveTextContent("1건")
		expect(cards[2]).toHaveTextContent("1건")
		expect(cards[3]).toHaveTextContent("1건")
	})

	it("관리자는 경보 기준 — 탐지 경보·고위험 경보(케이스 전환 포함)와 경보 위험 등급 도넛", () => {
		show(sample, {
			role: "ADMIN",
			me: "admin",
			alertStats: {
				date: "2022-09-08",
				total: 1630,
				scored: 1624,
				bands: { high: 35, medium: 17, low: 1572 },
				unscored: 4,
				failed: 2,
				caseOpened: 35,
				policyVersion: "v1",
			},
		})
		const cards = kpiCards()
		// 고위험 경보 = 케이스 전환(정책상 같은 수)이라 한 카드로, 빈자리는 승인 대기
		expect(titles(cards)).toEqual(["탐지 경보", "고위험 경보", "미배정 케이스", "승인 대기"])
		expect(cards[0]).toHaveTextContent("1,630건")
		expect(cards[1]).toHaveTextContent("35건")
		expect(cards[2]).toHaveTextContent("2건")
		expect(cards[3]).toHaveTextContent("1건")
		expect(
			within(cards[1]).getByRole("button", { name: "고위험 경보 설명" }),
		).toHaveAccessibleDescription(
			"운영 경계값 기준 HIGH 경보 수 — 이 경보만 케이스로 전환돼요(전환 35건)",
		)
		expect(
			within(cards[0]).getByRole("button", { name: "탐지 경보 설명" }),
		).toHaveAccessibleDescription("기준일 2022-09-08에 룰 스캔이 탐지한 경보 수")
		expect(screen.getByRole("heading", { name: "경보 위험 등급 분포" })).toBeInTheDocument()
		expect(screen.getByText("기준일 2022-09-08 탐지 경보 기준")).toBeInTheDocument()
		expect(
			screen.getByRole("img", {
				name: "높음 · HIGH 35건, 중간 · MEDIUM 17건, 낮음 · LOW 1572건, 점수 대기·실패 6건",
			}),
		).toBeInTheDocument()
		expect(document.querySelector(".risk-donut-center .count-up")).toHaveAttribute(
			"aria-label",
			"1,630",
		)
		expect(screen.getByText("1,572")).toBeInTheDocument() // 범례는 천 단위 쉼표
		// 네 자리 이상 가운데 숫자는 작게(data-long)
		expect(document.querySelector(".risk-donut-center")).toHaveAttribute("data-long")
	})

	it("관리자 — 운영 경계값이 없으면 고위험 경보는 —, 도넛은 등급 없이 전체 건수만", () => {
		show(sample, {
			role: "ADMIN",
			alertStats: {
				date: null,
				total: 10,
				scored: 4,
				bands: null,
				unscored: 6,
				failed: 0,
				caseOpened: 0,
				policyVersion: null,
			},
		})
		const cards = kpiCards()
		expect(cards[1]).toHaveTextContent("—")
		expect(cards[1]).not.toHaveTextContent("건")
		expect(screen.getByText("전체 기간 탐지 경보 기준")).toBeInTheDocument()
		expect(
			screen.getByRole("img", { name: /등급 없음\(경계값 미설정\) 10건/ }),
		).toBeInTheDocument()
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
