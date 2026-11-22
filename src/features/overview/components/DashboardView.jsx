import { useMemo, useState } from "react"
import { Link } from "react-router"
import AnalyticsChart from "../../../shared/ui/charts/AnalyticsChart"
import RiskGauge from "./RiskGauge"
import DashboardHero from "../../../shared/ui/dashboard/DashboardHero"
import CountUp from "../../../shared/ui/dashboard/CountUp"
import Icon from "../../../shared/ui/dashboard/Icon"
import { STATUS_LABELS } from "../../cases/labels"
import { riskCounts, riskNames, riskColors, demoTrend } from "../model/analytics"

export default function DashboardView({
	items,
	total,
	description,
	onStart,
	casePath = (n) => `/cases/${encodeURIComponent(n)}`,
	listPath = "/cases",
	demo = false,
	// 조사역 대시보드 — 내 담당만 받은 items. 카드·안내 문구를 그 범위로 (SCRUM-337)
	mine = false,
	dark = false,
	hero = null,
}) {
	const [period, setPeriod] = useState(10)
	const [replay, setReplay] = useState(0)
	const counts = useMemo(() => riskCounts(items), [items])
	const scope = demo
		? `현재 시연 케이스 ${items.length}건 기준`
		: mine
			? `내 담당 ${items.length}건 기준`
			: `조회 가능한 전체 ${items.length}건 기준`
	const cards = [
		[
			demo ? "시연 케이스" : mine ? "내 담당 케이스" : "전체 조회 케이스",
			total,
			demo
				? "현재 시연 데이터"
				: mine
					? "나에게 배정된 케이스"
					: "현재 계정의 조회 가능 범위",
			"case",
		],
		["우선 확인 · HIGH", counts[0], scope, "alert"],
		// 조사역은 미배정 케이스를 스스로 맡을 수 없어서(SCRUM-339) 그 자리에 보완할 초안을 세요
		mine
			? [
					"보완할 초안",
					items.filter((i) => i.rejectionReasonCode === "NEED_REVISION").length,
					scope,
					"user",
				]
			: ["미배정 케이스", items.filter((i) => !i.assignee).length, scope, "user"],
		[
			"승인 대기",
			items.filter((i) => i.status === "PENDING_APPROVAL").length,
			scope,
			"approval",
		],
	]
	const trend = useMemo(() => {
		if (demo)
			return {
				labels: Array.from(
					{ length: period },
					(_, i) => `09.${String(11 - period + i).padStart(2, "0")}`,
				),
				datasets: [
					{
						label: "거래 건수 · 합성 예시",
						data: demoTrend.slice(-period),
						borderColor: "--brand-primary",
						backgroundColor: "#0046ff15",
						fill: true,
					},
				],
			}
		return {
			labels: Object.values(STATUS_LABELS),
			datasets: [
				{
					label: "현재 조회 케이스 수",
					data: Object.keys(STATUS_LABELS).map(
						(s) => items.filter((i) => i.status === s).length,
					),
					backgroundColor: [
						"--brand-light",
						"--brand-sky",
						"--brand-royal",
						"--brand-primary",
						"--brand-sky",
						"--brand-light",
						"--brand-royal",
						"--chart-neutral",
						"--chart-neutral",
					],
					maxBarThickness: 32,
				},
			],
		}
	}, [demo, items, period])
	return (
		<section className="intelligence-page" aria-label="업무 대시보드">
			{/* 업무 화면은 역할별 머리말(hero)을, 시연 화면은 기존 큰 배너를 써요. */}
			{hero ?? (
				<DashboardHero
					description={description}
					actionLabel="업무 시작하기"
					onAction={onStart}
					replay={replay}
				/>
			)}
			<div className="dashboard-section-label">
				<button onClick={() => setReplay((v) => v + 1)}>
					<Icon name="refresh" size={13} /> 효과 다시 재생
				</button>
			</div>
			<section className="signal-kpis" aria-label="업무 현황 요약">
				{cards.map(([name, value, note, icon], index) => (
					<article
						className={`signal-kpi ${index === 0 ? "signal-kpi-primary" : ""}`}
						key={name}
					>
						<div className="metric-label">
							{name}
							<Icon name={icon} size={18} />
						</div>
						<strong>
							<CountUp value={value} replay={replay} />
							<small>건</small>
						</strong>
						<p>{note}</p>
						{index === 0 ? (
							<div className="metric-bars" aria-hidden="true">
								{[
									30, 48, 40, 66, 52, 76, 63, 83, 71, 94, 78, 87, 65, 92, 79, 100,
									88, 96, 79, 91, 100, 86, 95, 84,
								].map((h, i) => (
									<i
										key={i}
										style={{ height: `${h}%`, opacity: 0.35 + i / 38 }}
									/>
								))}
							</div>
						) : (
							<Link className="metric-link" to={listPath}>
								케이스에서 확인
								<Icon name="arrow" size={14} />
							</Link>
						)}
					</article>
				))}
			</section>
			<div className="analytics-grid">
				<section className="analytics-panel trend-panel">
					<div className="analytics-head">
						<div>
							<h2>{demo ? "거래 흐름" : "조사 흐름 한눈에 보기"}</h2>
							<p>
								{demo
									? "일별 거래 건수 · 시각화용 합성 예시"
									: `${scope} · 현재 상태별 건수`}
							</p>
						</div>
						{demo && (
							<div className="chart-period" aria-label="차트 표시 선택">
								{[
									[10, "전체 10일"],
									[5, "최근 5일"],
								].map(([v, t]) => (
									<button
										key={v}
										aria-pressed={period === v}
										onClick={() => setPeriod(v)}
									>
										{t}
									</button>
								))}
							</div>
						)}
					</div>
					<div className="trend-summary">
						<strong>
							<CountUp
								value={
									demo
										? demoTrend.slice(-period).reduce((a, b) => a + b, 0)
										: items.length
								}
								replay={replay}
							/>
							<small>건 {demo ? "· 합성 예시" : "조회"}</small>
						</strong>
						{demo && <span>{`2022.09.${11 - period} — 09.10`}</span>}
					</div>
					<div className="trend-canvas chart-transition" key={`${period}-${replay}`}>
						{trend.labels.length ? (
							<AnalyticsChart
								type={demo ? "line" : "bar"}
								data={trend}
								dark={dark}
								replay={replay}
								label={trend.labels
									.map((l, i) => `${l}: ${trend.datasets[0].data[i]}`)
									.join(", ")}
							/>
						) : (
							<p className="dashboard-empty">표시할 데이터가 없습니다.</p>
						)}
					</div>
				</section>
				<section className="analytics-panel risk-panel">
					<div className="analytics-head">
						<div>
							<h2>위험 등급 분포</h2>
							<p>{scope}</p>
						</div>
						<i className="soft-dot" />
					</div>
					<RiskGauge
						counts={counts}
						replay={replay}
						label={riskNames.map((n, i) => `${n} ${counts[i]}건`).join(", ")}
					/>
					<div className="risk-legend">
						{riskNames.map((n, i) => (
							<div key={n}>
								<i style={{ background: `var(${riskColors[i]})` }} />
								<span>{n}</span>
								<strong>
									{counts[i]}
									<small>건</small>
								</strong>
							</div>
						))}
					</div>
				</section>
			</div>
			<section className="analytics-panel focus-panel">
				<div className="analytics-head">
					<div>
						<h2>지금 바로 확인해야 할 케이스</h2>
						<p>위험 점수가 가장 높은 케이스예요. 지금 바로 열어 확인해 주세요.</p>
					</div>
					<Link className="text-link" to={mine ? `${listPath}?mine=1` : listPath}>
						{mine ? "내 담당 케이스" : "전체 케이스"} <Icon name="arrow" size={14} />
					</Link>
				</div>
				{items.length ? (
					items.slice(0, 3).map((item) => {
						// 점수가 없으면 등급도 보이지 않게 — 미산출을 고위험처럼 칠하지 않는다.
						const band =
							item.score != null && ["HIGH", "MEDIUM", "LOW"].includes(item.scoreBand)
								? item.scoreBand
								: null
						return (
							<div
								className="focus-case"
								data-band={band ?? "NONE"}
								key={item.caseNo}
							>
								<div className="case-symbol">
									<Icon name="alert" size={22} />
								</div>
								<div className="case-identity">
									<Link to={casePath(item.caseNo)}>{item.caseNo}</Link>
									<span>
										{item.accountNo ?? "계좌 정보 없음"} ·{" "}
										{item.assignee?.displayName ?? "미배정"}
									</span>
								</div>
								<div className="case-score">
									{band && <em className="band-badge">{band}</em>}
									<div className="case-score-main">
										<strong>
											{item.score == null ? "미산출" : item.score.toFixed(2)}
										</strong>
										<span>{STATUS_LABELS[item.status] ?? item.status}</span>
									</div>
								</div>
								<Link className="case-open" to={casePath(item.caseNo)}>
									지금 확인 <Icon name="arrow" size={14} />
								</Link>
							</div>
						)
					})
				) : (
					<p className="dashboard-empty">
						{mine
							? "나에게 배정된 케이스가 없습니다."
							: "조회 가능한 케이스가 없습니다."}
					</p>
				)}
			</section>
			<p className="analytics-footnote">
				{demo
					? "시연용 합성 데이터 · 실제 운영 실적이 아닙니다."
					: mine
						? "카드와 차트는 나에게 배정된 케이스 기준입니다. 보완할 초안은 보완 요청으로 반려된 직후의 초안만 세요 — 본문을 고쳐 저장하기 시작하면 이 숫자에서 빠져요. 다른 담당자 케이스는 케이스 목록에서 볼 수 있어요. 점수는 조사 우선순위이며 범죄 확률이 아닙니다."
						: "카드와 차트는 현재 계정이 조회 가능한 전체 케이스 기준입니다. 점수는 조사 우선순위이며 범죄 확률이 아닙니다."}
			</p>
		</section>
	)
}
