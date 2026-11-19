import { useId } from "react"
import CountUp from "../../../shared/ui/dashboard/CountUp"

// 위험 등급 분포를 계기판(반원)으로 — 조각 길이는 등급별 건수, 바늘은 HIGH 비율을 가리켜요.
// 왼쪽부터 HIGH · MEDIUM · LOW · 미산출 순이라, 바늘은 늘 빨간 조각 끝에 서요.
// HIGH 가 많을수록 바늘이 오른쪽으로 더 돌아가요. 처음 보일 때 바늘이 0에서 출렁이며 자리를 잡아요.
const CX = 120
const CY = 116
const R = 96
const W = 12
// 둥근 끝(반지름 W/2)과 조각 사이 틈을 0~1 위치 단위로
const CAP = W / 2 / R / Math.PI
const GAP = 0.012
// counts 순서(HIGH, MEDIUM, LOW, 미산출)와 같은 순서의 [밝은 끝, 진한 끝] 색
const BAND_FILLS = [
	["--risk-high-light", "--risk-high"],
	["--risk-medium-light", "--risk-medium"],
	["--risk-low-light", "--risk-low"],
	["--chart-neutral", "--chart-neutral"],
]
// 0(왼쪽 끝) ~ 1(오른쪽 끝) 위치를 반원 위 좌표로
const point = (t, r = R) => {
	const angle = Math.PI * (1 - t)
	return [CX + r * Math.cos(angle), CY - r * Math.sin(angle)]
}
const arcPath = (from, to, r = R) => {
	const [x1, y1] = point(from, r)
	const [x2, y2] = point(to, r)
	return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

export default function RiskGauge({ counts, label, replay = 0 }) {
	// 한 화면에 계기판이 여럿이어도 SVG 그라데이션·마스크 id 가 겹치지 않게
	const uid = useId().replace(/:/g, "")
	const total = counts.reduce((sum, n) => sum + n, 0)
	const high = counts[0]
	const share = total ? high / total : 0
	const before = (index) => counts.slice(0, index).reduce((sum, n) => sum + n, 0)
	const segments = counts
		.map((count, index) => ({
			index,
			count,
			from: total ? before(index) / total : 0,
			to: total ? before(index + 1) / total : 0,
		}))
		.filter((s) => s.count > 0)
		.map((s) => {
			// 둥근 끝이 이웃 조각과 겹치지 않게 안쪽으로 줄이고, 너무 짧으면 점 하나로
			const from = s.from + (s.from > 0 ? GAP / 2 : 0) + CAP
			const to = s.to - (s.to < 1 ? GAP / 2 : 0) - CAP
			return { ...s, from, to: Math.max(to, from + 0.0001) }
		})
	return (
		<div className="risk-gauge" key={replay}>
			<svg viewBox="0 0 240 124" role="img" aria-label={label}>
				<defs>
					{segments.map(({ index, from, to }) => {
						const [x1, y1] = point(from)
						const [x2, y2] = point(to)
						return (
							<linearGradient
								key={index}
								id={`${uid}-band-${index}`}
								gradientUnits="userSpaceOnUse"
								x1={x1}
								y1={y1}
								x2={x2}
								y2={y2}
							>
								<stop
									offset="0"
									style={{ stopColor: `var(${BAND_FILLS[index][0]})` }}
								/>
								<stop
									offset="1"
									style={{ stopColor: `var(${BAND_FILLS[index][1]})` }}
								/>
							</linearGradient>
						)
					})}
					<mask
						id={`${uid}-sweep`}
						maskUnits="userSpaceOnUse"
						x="0"
						y="0"
						width="240"
						height="124"
					>
						<path
							className="risk-gauge-sweep"
							d={arcPath(0, 1)}
							pathLength="1"
							stroke="#fff"
							strokeWidth={W + 8}
							strokeLinecap="round"
							fill="none"
						/>
					</mask>
				</defs>
				<path className="risk-gauge-track" d={arcPath(CAP, 1 - CAP)} strokeWidth={W} />
				<g mask={`url(#${uid}-sweep)`}>
					{segments.map(({ index, from, to }) => (
						<path
							key={index}
							className={index === 0 ? "risk-gauge-hot" : undefined}
							d={arcPath(from, to)}
							stroke={`url(#${uid}-band-${index})`}
							strokeWidth={W}
							strokeLinecap="round"
							fill="none"
						/>
					))}
				</g>
				{Array.from({ length: 11 }, (_, i) => {
					const [x, y] = point(i / 10, R - W / 2 - 9)
					return (
						<circle
							key={i}
							className={`risk-gauge-tick ${i % 5 === 0 ? "is-major" : ""}`}
							cx={x}
							cy={y}
							r={i % 5 === 0 ? 1.6 : 1}
						/>
					)
				})}
				<g className="risk-gauge-needle" style={{ "--needle": `${share * 180}deg` }}>
					<path
						d={`M${CX} ${CY - 2.6}L${CX - (R - 24)} ${CY - 0.6}Q${CX - (R - 22)} ${CY} ${CX - (R - 24)} ${CY + 0.6}L${CX} ${CY + 2.6}Z`}
					/>
				</g>
				<circle className="risk-gauge-hub" cx={CX} cy={CY} r="6.5" />
				<circle className="risk-gauge-hub-dot" cx={CX} cy={CY} r="2.2" />
			</svg>
			<div className="risk-gauge-readout">
				<span className="risk-gauge-label">
					<i />
					HIGH
				</span>
				<strong>
					<CountUp value={high} replay={replay} />
					<small>건</small>
				</strong>
				<span className="risk-gauge-note">
					조회한 {total}건 중 <b>{Math.round(share * 100)}%</b>
				</span>
			</div>
		</div>
	)
}
