import CountUp from "../../../shared/ui/dashboard/CountUp"

// 위험 등급 분포 반원(SCRUM-345, 팀 피드백으로 원 → 반원) — 왼쪽에서 오른쪽으로 등급별 건수 조각, 아래 가운데는 전체 건수.
// 순서·색은 범례와 같아요(HIGH · MEDIUM · LOW · 미산출). 0건이면 회색 빈 반원만. 네 자리 이상이면 숫자를 줄여요.
// 처음 보일 때(replay 가 바뀔 때도) 살짝 커지며 나타나요.
const R = 52
const W = 14
const GAP = 0.01 // 조각 사이 틈(반원 전체 = 1)
// 왼쪽 끝 → 위 → 오른쪽 끝 반원 호
const ARC = `M ${70 - R} 70 A ${R} ${R} 0 0 1 ${70 + R} 70`
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
			<svg viewBox="0 0 140 78" role="img" aria-label={label}>
				<path className="risk-donut-track" d={ARC} strokeWidth={W} />
				<g className="risk-donut-sweep">
					{segments
						.filter((s) => s.count > 0)
						.map(({ index, start, share }) => {
							// 조각이 둘 이상이면 사이에 틈 — 하나뿐이면 꽉 찬 반원
							const length = Math.max(share - (shown > 1 ? GAP : 0), 0.001)
							return (
								<path
									key={index}
									className="risk-donut-segment"
									data-band={index}
									d={ARC}
									pathLength="1"
									strokeWidth={W}
									strokeDasharray={`${length} 2`}
									strokeDashoffset={-start}
									style={{ stroke: `var(${COLORS[index]})` }}
									fill="none"
								/>
							)
						})}
				</g>
			</svg>
			<div className="risk-donut-center" data-long={total >= 1000 || undefined}>
				<strong>
					<CountUp value={total} replay={replay} />
					<small>건</small>
				</strong>
			</div>
		</div>
	)
}
