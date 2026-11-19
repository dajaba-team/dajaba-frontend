export const riskNames = ["높음 · HIGH", "중간 · MEDIUM", "낮음 · LOW", "미산출·등급 없음"]
export const riskColors = ["--risk-high", "--brand-primary", "--brand-light", "--chart-neutral"]
// 우선순위 막대 색 — 1위는 빨강(--risk-high), 마지막 순위는 회색(--chart-fade)으로 순위에 따라 옅어짐.
const mixHex = (a, b, t) =>
	`#${[1, 3, 5]
		.map((i) => {
			const x = parseInt(a.slice(i, i + 2), 16)
			const y = parseInt(b.slice(i, i + 2), 16)
			return Math.round(x + (y - x) * t)
				.toString(16)
				.padStart(2, "0")
		})
		.join("")}`
export const rankColors = (count, from = "#f04452", to = "#c5cbd5") =>
	Array.from({ length: count }, (_, i) => mixHex(from, to, count > 1 ? i / (count - 1) : 0))
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
