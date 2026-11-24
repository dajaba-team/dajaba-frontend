import { useId } from "react"
import Icon from "./Icon"
export default function DashboardHero({ description, onAction, actionLabel, replay = 0 }) {
	const id = useId().replaceAll(":", "")
	return (
		<header className="dashboard-hero">
			<div className="hero-copy">
				<h1>
					흐름을 읽고, <span>위험을 발견하다.</span>
				</h1>
				<p>{description}</p>
				<div className="hero-actions">
					<button className="hero-action" onClick={onAction}>
						{actionLabel}
						<Icon name="arrow" size={17} />
					</button>
					<span className="hero-caption">복잡한 거래 속, 명확한 판단.</span>
				</div>
				<div className="hero-process">
					<span>
						<b>01</b> 탐지
					</span>
					<i />
					<span>
						<b>02</b> 조사
					</span>
					<i />
					<span>
						<b>03</b> 보고
					</span>
				</div>
			</div>
			<div className="hero-art" aria-hidden="true" key={replay}>
				<div className="hero-orbit-glow" />
				<svg viewBox="0 0 440 300" className="hero-orbits" fill="none">
					<defs>
						<linearGradient
							id={`${id}-orbit`}
							x1="30"
							y1="40"
							x2="400"
							y2="280"
							gradientUnits="userSpaceOnUse"
						>
							<stop stopColor="#8cd2f5" stopOpacity=".1" />
							<stop offset=".5" stopColor="#8cd2f5" />
							<stop offset="1" stopColor="#2878f5" stopOpacity=".1" />
						</linearGradient>
					</defs>
					<g stroke={`url(#${id}-orbit)`}>
						<ellipse
							cx="220"
							cy="150"
							rx="181"
							ry="104"
							transform="rotate(-24 220 150)"
						/>
						<ellipse
							cx="220"
							cy="150"
							rx="153"
							ry="84"
							transform="rotate(28 220 150)"
						/>
						<circle cx="220" cy="150" r="113" strokeDasharray="2 8" />
					</g>
					<path
						className="hero-signal-path"
						d="M48 181 L103 181 L126 133 L157 210 L191 95 L224 160 L258 160 L281 130 L309 155 L392 155"
						stroke="#8cd2f5"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<g fill="#b9e8ff">
						<circle cx="58" cy="112" r="4" />
						<circle cx="361" cy="83" r="3" />
						<circle cx="340" cy="240" r="4" />
						<circle cx="125" cy="252" r="2" />
					</g>
				</svg>
				<div className="hero-core">
					<Icon name="chart" size={30} />
					<strong>DAJAVA</strong>
				</div>
				<div className="hero-node hero-node-detect">
					<strong>이상 흐름 탐지</strong>
				</div>
				<div className="hero-node hero-node-decide">
					<strong>근거를 연결하다</strong>
				</div>
			</div>
		</header>
	)
}
