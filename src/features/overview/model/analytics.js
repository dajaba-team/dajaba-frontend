export const riskNames = ["높음 · HIGH", "중간 · MEDIUM", "낮음 · LOW", "미산출·등급 없음"]
export const riskColors = ["--risk-high", "--risk-medium", "--risk-low", "--chart-neutral"]
export function riskCounts(items) {
	return ["HIGH", "MEDIUM", "LOW", null].map(
		(band) =>
			items.filter((item) =>
				band
					? item.score != null && item.scoreBand === band
					: item.score == null || !["HIGH", "MEDIUM", "LOW"].includes(item.scoreBand),
			).length,
	)
}
// 조사 단계(대시보드 "조사 중" 카드, SCRUM-345) — 승인 대기·반려(보완)는 따로 세서 겹치지 않게
export const INVESTIGATING = ["REVIEWING", "ESCALATED", "DRAFTED"]
// 끝난 케이스 — "지금 바로 확인해야 할 케이스"에서 빼요(SCRUM-410). 개수·도넛 같은 집계에는 그대로 들어가요.
export const FINISHED = ["CLOSED", "REPORTED"]
// Presentation-only synthetic daily volumes; never used by the live overview.
export const demoTrend = [1240, 1680, 1490, 2150, 1830, 2420, 1760, 2120, 1660, 2070]
