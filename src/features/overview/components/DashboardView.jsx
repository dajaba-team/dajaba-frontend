import { useMemo, useState } from "react"
import { Link } from "react-router"
import AnalyticsChart from "../../../shared/ui/charts/AnalyticsChart"
import RiskDonut from "./RiskDonut"
import DashboardHero from "../../../shared/ui/dashboard/DashboardHero"
import CountUp from "../../../shared/ui/dashboard/CountUp"
import Icon from "../../../shared/ui/dashboard/Icon"
import InfoTip from "../../../shared/ui/InfoTip"
import { STATUS_LABELS } from "../../cases/labels"
import { riskCounts, riskNames, riskColors, INVESTIGATING, demoTrend } from "../model/analytics"
import { formatScore } from "../../../shared/format/score"

// 마지막 갱신 시각 — 브라우저 시간대의 시:분:초(SCRUM-345)
const CLOCK = new Intl.DateTimeFormat("ko-KR", {
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hour12: false,
})
const clockOf = (ms) => CLOCK.format(new Date(ms))

// KPI 카드 제목 옆 ⓘ 툴팁은 공통 InfoTip(shared/ui) — 데이터·배치 운영 카드도 같이 써요(SCRUM-345).

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
	onRefresh = null, // 업무 화면: 서버에서 다시 불러오기(Promise). 시연 화면은 없음 → 효과만 다시
	refreshing = false,
	updatedAt = 0, // 마지막으로 받아 온 시각(ms) — 0이면 표시 안 함
	alertStats = null, // 관리자: 경보 통계(BE SCRUM-360) — 있으면 경보 기준 카드·도넛
	// 우선 목록 자리를 바꿔 끼울 때(승인자 — 승인 대기 보고서, SCRUM-336). 없으면 점수 높은 케이스
	focusPanel = null,
}) {
	const [period, setPeriod] = useState(10)
	const [replay, setReplay] = useState(0)
	// 새로고침 — 다시 불러온 뒤 숫자·차트 효과를 다시 재생해요(SCRUM-345)
	async function refresh() {
		await onRefresh?.()
		setReplay((v) => v + 1)
	}
	const counts = useMemo(() => riskCounts(items), [items])
	// 역할별 카드(SCRUM-345) — 카드에는 제목·건수·아이콘만, 뜻은 제목 옆 ⓘ 툴팁으로.
	// 케이스는 HIGH 경보로만 만들어져 "고위험 케이스"는 전체 케이스와 늘 같아서, 관리자는 경보 기준으로,
	// 조사역·승인자는 조사 단계별(조사 중 → 보완 → 승인 대기)로 바꿨어요. 관리자의 고위험 경보는 케이스 전환 수와 정책상 같아 한 카드로 합쳤어요.
	// 시연 화면은 합성 데이터라 기존 그대로.
	const unassigned = [
		"미배정 케이스",
		items.filter((i) => !i.assignee).length,
		"담당 조사역이 배정되지 않은 케이스 수",
		"user",
	]
	const pending = [
		"승인 대기",
		items.filter((i) => i.status === "PENDING_APPROVAL").length,
		"승인자 검토가 필요한 케이스 수",
		"approval",
	]
	// 목록 링크도 집계와 같은 범위로 — 조사역은 내 담당 목록(SCRUM-337)
	const scopedListPath = mine ? `${listPath}?mine=1` : listPath
	const investigating = items.filter((i) => INVESTIGATING.includes(i.status)).length
	// 보완 요청으로 반려된 직후 — 본문을 고쳐 저장하기 시작하면 빠져요(SCRUM-339)
	const needRevision = items.filter((i) => i.rejectionReasonCode === "NEED_REVISION").length
	const alertScope = alertStats?.date ? `기준일 ${alertStats.date}` : "전체 기간"
	let cards
	if (alertStats)
		cards = [
			["탐지 경보", alertStats.total, `${alertScope}에 룰 스캔이 탐지한 경보 수`, "alert"],
			[
				"고위험 경보",
				alertStats.bands?.high ?? null,
				alertStats.bands
					? `운영 경계값 기준 HIGH 경보 수 — 이 경보만 케이스로 전환돼요(전환 ${alertStats.caseOpened.toLocaleString("ko-KR")}건)`
					: "운영 등급 경계값이 아직 없어 나눌 수 없어요",
				"warning",
			],
			unassigned,
			pending,
		]
	else if (demo)
		cards = [
			["시연 케이스", total, "시연용 합성 데이터의 케이스 수", "case"],
			["고위험 케이스", counts[0], "위험 등급이 HIGH인 케이스 수", "alert"],
			unassigned,
			pending,
		]
	else if (mine)
		// 조사역 — 내 담당 기준. 2·3·4번은 조사 → 보완 → 승인 대기 단계라 서로 겹치지 않아요
		cards = [
			["내 담당 케이스", total, "나에게 배정된 케이스 수", "case"],
			[
				"조사 중",
				investigating,
				"내 담당 중 아직 조사하고 있는 케이스 수(조사 중·에스컬레이션·초안 작성됨)",
				"clock",
			],
			[
				"보완할 초안",
				needRevision,
				"보완 요청으로 반려된 직후의 초안 수 — 본문을 고쳐 저장하기 시작하면 빠져요",
				"user",
			],
			[
				"승인 대기",
				pending[1],
				"승인 요청을 올려 승인자 검토를 기다리는 케이스 수",
				"approval",
			],
		]
	else
		// 승인자 — 전체 기준, 조사역과 같은 단계 틀
		cards = [
			["전체 조회 케이스", total, "조회 가능한 전체 케이스 수", "case"],
			[
				"조사 중",
				investigating,
				"아직 조사 단계라 곧 승인 요청이 올라올 케이스 수(조사 중·에스컬레이션·초안 작성됨)",
				"clock",
			],
			[
				"보완 중",
				needRevision,
				"보완 요청으로 반려돼 조사역이 고치고 있는 케이스 수",
				"user",
			],
			pending,
		]
	// 오른쪽 도넛 — 관리자는 경보 위험 등급, 그 밖은 케이스 위험 등급
	const SCORE_NOTE = "위험 점수는 범죄 확률이 아닌 조사 우선순위 지표입니다."
	let donut
	if (alertStats)
		donut = {
			title: "경보 위험 등급 분포",
			note: `케이스 생성과 같은 운영 경계값으로 나눈 경보 등급입니다. ${SCORE_NOTE}`,
			scope: `${alertScope} 탐지 경보 기준`,
			names: [
				...riskNames.slice(0, 3),
				alertStats.bands ? "점수 대기·실패" : "등급 없음(경계값 미설정)",
			],
			counts: alertStats.bands
				? [
						alertStats.bands.high,
						alertStats.bands.medium,
						alertStats.bands.low,
						alertStats.unscored + alertStats.failed,
					]
				: [0, 0, 0, alertStats.total],
		}
	else
		donut = {
			title: "위험 등급 분포",
			note: SCORE_NOTE,
			scope: demo
				? "현재 시연 케이스 기준"
				: mine
					? "내 담당 케이스 기준"
					: "조회 가능한 전체 케이스 기준",
			names: riskNames,
			counts,
		}
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
							{/* 제목은 낱말 사이에서만 꺾이고, ⓘ 는 마지막 낱말에 붙어 다녀요(SCRUM-390) */}
							<span className="metric-title">
								<span className="metric-title-text">{name}</span>
								<InfoTip label={name} text={note} />
							</span>
							<Icon name={icon} size={18} />
						</div>
						<strong>
							{value == null ? (
								<b className="count-up" aria-label="없음">
									—
								</b>
							) : (
								<>
									<CountUp value={value} replay={replay} />
									<small>건</small>
								</>
							)}
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
								<h2>{donut.title}</h2>
								<InfoTip label={donut.title} text={donut.note} />
							</div>
							<p>{donut.scope}</p>
						</div>
					</div>
					<RiskDonut
						counts={donut.counts}
						replay={replay}
						label={donut.names.map((n, i) => `${n} ${donut.counts[i]}건`).join(", ")}
					/>
					<div className="risk-legend">
						{donut.names.map((n, i) => (
							<div key={n}>
								<i style={{ background: `var(${riskColors[i]})` }} />
								<span>{n}</span>
								<strong>
									{donut.counts[i].toLocaleString("ko-KR")}
									<small>건</small>
								</strong>
							</div>
						))}
					</div>
				</section>
			</div>
			{/* 승인자는 이 자리에 승인 대기 보고서(focusPanel, SCRUM-336) */}
			{focusPanel ?? (
				<section className="analytics-panel focus-panel">
					<div className="analytics-head">
						<div>
							<h2>지금 바로 확인해야 할 케이스</h2>
							<p>위험 점수가 가장 높은 케이스예요. 지금 바로 열어 확인해 주세요.</p>
						</div>
						<Link className="text-link" to={scopedListPath}>
							{mine ? "내 담당 케이스" : "전체 케이스"}{" "}
							<Icon name="arrow" size={14} />
						</Link>
					</div>
					{items.length ? (
						items.slice(0, 3).map((item) => {
							// 점수가 없으면 등급도 보이지 않게 — 미산출을 고위험처럼 칠하지 않는다.
							const band =
								item.score != null &&
								["HIGH", "MEDIUM", "LOW"].includes(item.scoreBand)
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
											<strong>{formatScore(item.score) ?? "미산출"}</strong>
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
							<p>
								{mine
									? "나에게 배정된 케이스가 없습니다."
									: "현재 확인할 케이스가 없습니다."}
							</p>
						</div>
					)}
				</section>
			)}
			{/* 업무 화면의 맨 아래 안내는 뺐어요 — 점수 뜻은 위험 등급 분포 ⓘ 로(SCRUM-345). 시연 화면은 합성 데이터 표시만 */}
			{demo && (
				<p className="analytics-footnote">
					시연용 합성 데이터 · 실제 운영 실적이 아닙니다.
				</p>
			)}
		</section>
	)
}
