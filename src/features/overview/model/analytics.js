export const riskNames = ["높음 · HIGH", "중간 · MEDIUM", "낮음 · LOW", "미산출·등급 없음"]
export const riskColors = ["--risk-high", "--brand-primary", "--brand-light", "--chart-neutral"]
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
// Presentation-only synthetic daily volumes; never used by the live overview.
export const demoTrend = [1240, 1680, 1490, 2150, 1830, 2420, 1760, 2120, 1660, 2070]
