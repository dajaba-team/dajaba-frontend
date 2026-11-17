export default function CaseOverview({ data }) {
	const items = data.items
	const cards = [
		["조회된 전체 케이스", data.total, "현재 필터 기준"],
		[
			"우선 확인 · HIGH",
			items.filter((i) => i.score != null && i.scoreBand === "HIGH").length,
			`현재 페이지 ${items.length}건 기준`,
		],
		[
			"미배정 케이스",
			items.filter((i) => !i.assignee).length,
			`현재 페이지 ${items.length}건 기준`,
		],
	]
	return (
		<section className="case-overview" aria-label="케이스 현황">
			{cards.map(([label, value, note]) => (
				<article key={label}>
					<span>{label}</span>
					<strong>
						{value.toLocaleString()}
						<small>건</small>
					</strong>
					<small>{note}</small>
				</article>
			))}
		</section>
	)
}
