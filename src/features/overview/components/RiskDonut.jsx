import CountUp from "../../../shared/ui/dashboard/CountUp"

// 위험 등급 분포 도넛(SCRUM-345, 계기판 대신) — 조각은 등급별 건수, 가운데는 전체 케이스 수(숫자만 크게).
// 순서·색은 범례와 같아요(HIGH · MEDIUM · LOW · 미산출). 0건이면 회색 빈 고리만.
// 처음 보일 때(replay 가 바뀔 때도) 고리가 살짝 돌며 나타나요.
const R = 52
const W = 14
const GAP = 0.008 // 조각 사이 틈(한 바퀴 = 1)
const COLORS = ["--risk-high", "--risk-medium", "--risk-low", "--chart-neutral"]

export default function RiskDonut({ counts, label, replay = 0 }) {
	const total = counts.reduce((sum, n) => sum + n, 0)
	const shown = counts.filter((n) => n > 0).length
	const segments = counts.map((count, index) => ({
		index,
		count,
		start: total ? counts.slice(0, index).reduce((sum, n) => sum + n, 0) / total : 0,
		share: total ? count / total : 0,
	}))
	return (
		<div className="risk-donut" key={replay}>
			<svg viewBox="0 0 140 140" role="img" aria-label={label}>
				<circle className="risk-donut-track" cx="70" cy="70" r={R} strokeWidth={W} />
				<g className="risk-donut-sweep">
					{segments
						.filter((s) => s.count > 0)
						.map(({ index, start, share }) => {
							// 조각이 둘 이상이면 사이에 틈 — 하나뿐이면 꽉 찬 고리
							const length = Math.max(share - (shown > 1 ? GAP : 0), 0.001)
							return (
								<circle
									key={index}
									className="risk-donut-segment"
									data-band={index}
									cx="70"
									cy="70"
									r={R}
									pathLength="1"
									strokeWidth={W}
									strokeDasharray={`${length} ${1 - length}`}
									strokeDashoffset={-start}
									style={{ stroke: `var(${COLORS[index]})` }}
									fill="none"
								/>
							)
						})}
				</g>
			</svg>
			<div className="risk-donut-center">
				<strong>
					<CountUp value={total} replay={replay} />
					<small>건</small>
				</strong>
			</div>
		</div>
	)
}
