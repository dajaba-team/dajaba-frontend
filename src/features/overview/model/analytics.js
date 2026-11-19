export const riskNames = ["높음 · HIGH", "중간 · MEDIUM", "낮음 · LOW", "미산출·등급 없음"]
export const riskColors = ["--risk-high", "--brand-primary", "--brand-light", "--chart-neutral"]
// 우선순위 막대 색 — 4단계만 쓴다. 빨강(--risk-high)→회색(--chart-fade) 8단계 중
// 1·2·7·8번째 색을 골라, 순위를 4묶음으로 나눠 위는 붉게·아래는 회색으로 칠한다.
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
const RANK_STEPS = [0, 1 / 7, 6 / 7, 1]
export const rankColors = (count, from = "#f04452", to = "#c5cbd5") => {
	const palette = RANK_STEPS.map((t) => mixHex(from, to, t))
	return Array.from(
		{ length: count },
		(_, i) => palette[Math.floor((i * palette.length) / count)],
	)
}
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
