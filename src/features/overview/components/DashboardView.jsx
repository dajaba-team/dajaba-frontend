import { useId, useMemo, useState } from "react"
import { Link } from "react-router"
import AnalyticsChart from "../../../shared/ui/charts/AnalyticsChart"
import RiskDonut from "./RiskDonut"
import DashboardHero from "../../../shared/ui/dashboard/DashboardHero"
import CountUp from "../../../shared/ui/dashboard/CountUp"
import Icon from "../../../shared/ui/dashboard/Icon"
import { STATUS_LABELS } from "../../cases/labels"
import { riskCounts, riskNames, riskColors, demoTrend } from "../model/analytics"

// 마지막 갱신 시각 — 브라우저 시간대의 시:분:초(SCRUM-345)
const CLOCK = new Intl.DateTimeFormat("ko-KR", {
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hour12: false,
})
const clockOf = (ms) => CLOCK.format(new Date(ms))

// KPI 카드 제목 옆 ⓘ — 마우스를 올리거나 키보드로 가면 카드 뜻을 한 줄로 보여 줘요(SCRUM-345).
// 화면 읽기 프로그램에는 버튼 설명(aria-describedby)으로 읽혀요.
function InfoTip({ label, text }) {
	const tipId = useId()
	return (
		<span className="kpi-info">
			<button
				type="button"
				className="kpi-info-button"
				aria-label={`${label} 설명`}
				aria-describedby={tipId}
				// 키보드로 띄운 설명은 Esc 로 닫아요(포커스를 놓으면 사라짐)
				onKeyDown={(event) => event.key === "Escape" && event.currentTarget.blur()}
			>
				<Icon name="info" size={14} />
			</button>
			<span role="tooltip" id={tipId} className="kpi-info-tip">
				{text}
			</span>
		</span>
	)
}

export default function DashboardView({
	items,
	total,
	description,
	onStart,
	casePath = (n) => `/cases/${encodeURIComponent(n)}`,
	listPath = "/cases",
	demo = false,
	dark = false,
	hero = null,
	onRefresh = null, // 업무 화면: 서버에서 다시 불러오기(Promise). 시연 화면은 없음 → 효과만 다시
	refreshing = false,
	updatedAt = 0, // 마지막으로 받아 온 시각(ms) — 0이면 표시 안 함
}) {
	const [period, setPeriod] = useState(10)
	const [replay, setReplay] = useState(0)
	// 새로고침 — 다시 불러온 뒤 숫자·차트 효과를 다시 재생해요(SCRUM-345)
	async function refresh() {
		await onRefresh?.()
		setReplay((v) => v + 1)
	}
	const counts = useMemo(() => riskCounts(items), [items])
	// 카드에는 제목·건수·아이콘만, 뜻은 제목 옆 ⓘ 툴팁으로(SCRUM-345). 시연 화면 첫 카드만 시연 데이터라고 알려요
	const cards = [
		[
			demo ? "시연 케이스" : "전체 케이스",
			total,
			demo ? "시연용 합성 데이터의 케이스 수" : "조회 가능한 전체 케이스 수",
			"case",
		],
		["고위험 케이스", counts[0], "위험 등급이 HIGH인 케이스 수", "alert"],
		[
			"미배정 케이스",
			items.filter((i) => !i.assignee).length,
			"담당 조사역이 배정되지 않은 케이스 수",
			"user",
		],
		[
			"승인 대기",
			items.filter((i) => i.status === "PENDING_APPROVAL").length,
			"승인자 검토가 필요한 케이스 수",
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
				{updatedAt > 0 && (
					<span className="refresh-time">마지막 갱신 {clockOf(updatedAt)}</span>
				)}
				<button type="button" onClick={refresh} disabled={refreshing}>
					<Icon name="refresh" size={13} /> {refreshing ? "새로고침 중…" : "새로고침"}
				</button>
			</div>
			<section className="signal-kpis" aria-label="업무 현황 요약">
				{cards.map(([name, value, note, icon], index) => (
					<article
						className={`signal-kpi ${index === 0 ? "signal-kpi-primary" : ""}`}
						key={name}
					>
						<div className="metric-label">
							<span className="metric-title">
								{name}
								<InfoTip label={name} text={note} />
							</span>
							<Icon name={icon} size={18} />
						</div>
						<strong>
							<CountUp value={value} replay={replay} />
							<small>건</small>
						</strong>
						{index === 0 && (
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
						)}
					</article>
				))}
			</section>
			<div className="analytics-grid">
				<section className="analytics-panel trend-panel">
					<div className="analytics-head">
						<div>
							<h2>{demo ? "거래 흐름" : "조사 진행 현황"}</h2>
							<p>
								{demo
									? "일별 거래 건수 · 시각화용 합성 예시"
									: "케이스의 조사 단계별 진행 현황을 확인하세요."}
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
					{/* 업무 화면은 전체 건수가 위 카드·도넛과 겹쳐서 빼요(SCRUM-345). 시연 화면만 기간 합계 */}
					{demo && (
						<div className="trend-summary">
							<strong>
								<CountUp
									value={demoTrend.slice(-period).reduce((a, b) => a + b, 0)}
									replay={replay}
								/>
								<small>건 · 합성 예시</small>
							</strong>
							<span>{`2022.09.${11 - period} — 09.10`}</span>
						</div>
					)}
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
							{/* ⓘ 는 제목(h2) 밖에 둬요 — 제목 이름에 설명 문구가 섞이지 않게 */}
							<div className="panel-title">
								<h2>위험 등급 분포</h2>
								<InfoTip
									label="위험 등급 분포"
									text="위험 점수는 범죄 확률이 아닌 조사 우선순위 지표입니다."
								/>
							</div>
							<p>{demo ? "현재 시연 케이스 기준" : "조회 가능한 전체 케이스 기준"}</p>
						</div>
						<i className="soft-dot" />
					</div>
					<RiskDonut
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
						<p>위험도가 높은 케이스를 우선 확인하세요.</p>
					</div>
					<Link className="text-link" to={listPath}>
						전체 케이스 <Icon name="arrow" size={14} />
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
					<div className="focus-empty" role="status">
						<span className="focus-empty-icon" aria-hidden="true">
							<Icon name="approval" size={22} />
						</span>
						<p>현재 확인할 케이스가 없습니다.</p>
					</div>
				)}
			</section>
			{/* 업무 화면의 맨 아래 안내는 뺐어요 — 점수 뜻은 위험 등급 분포 ⓘ 로(SCRUM-345). 시연 화면은 합성 데이터 표시만 */}
			{demo && (
				<p className="analytics-footnote">
					시연용 합성 데이터 · 실제 운영 실적이 아닙니다.
				</p>
			)}
		</section>
	)
}
