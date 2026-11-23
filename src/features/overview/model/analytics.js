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
// 담당 조사역이 처리 중인 상태(BE 계정 목록 open_case_count 와 같은 기준) — 진행 중은 여기에 접수(OPEN)까지
export const ASSIGNED_ACTIVE = ["REVIEWING", "ESCALATED", "DRAFTED", "PENDING_APPROVAL", "REJECTED"]
export const IN_PROGRESS = ["OPEN", ...ASSIGNED_ACTIVE]
// Presentation-only synthetic daily volumes; never used by the live overview.
export const demoTrend = [1240, 1680, 1490, 2150, 1830, 2420, 1760, 2120, 1660, 2070]
