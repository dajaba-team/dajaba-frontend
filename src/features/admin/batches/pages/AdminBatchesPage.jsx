import { useCallback, useState } from "react"
import { Link } from "react-router"
import { formatCount } from "../formatCount"
import { ruleLabel } from "../ruleLabels"
import { scanningText } from "../batchText"
import { latestOf, useBatchRunsForDate } from "../hooks/useBatchRunsForDate"
import { useSession } from "../../../auth/hooks/useSession"
import { batchDateKey, isBatchDate, readBatchDate, writeBatchDate } from "../batchDate"
import "../../../cases/styles/cases.css"
import "../styles/batches.css"
import LoadDatasetCard from "../components/LoadDatasetCard"
import BatchRunCard from "../components/BatchRunCard"
import RuleScanCard from "../components/RuleScanCard"
import ScoreCard from "../components/ScoreCard"
import OpenCasesCard from "../components/OpenCasesCard"

// 데이터·배치 운영(ADM-01, SCRUM-220·221·345) — 위: 직접 실행하는 원천 적재·분석 일괄 실행. 아래: 자동 처리 현황
// (룰 스캔 → 점수 산출 → 케이스 생성, 배치 자동 연쇄 BE SCRUM-356) → 실행 결과 표. 단계 칸은 상태만 짧게, 자세한 결과는 표의 비고로.
// 실행 결과 표: 원천 적재는 이 화면 결과(또는 이미 적재됨), 나머지는 그 날짜 서버 실행 목록의 단계별 최신 실행 — 새로고침해도 남아요.
// 그 날짜에 실행 중인 단계가 있으면 목록을 2초마다 다시 읽어 지금 어느 단계인지 보여 줘요.
const STEPS = [
	{ key: "load", label: "원천 적재" },
	{ key: "scan", label: "룰 스캔", type: "RULE_SCAN" },
	{ key: "score", label: "점수 산출", type: "SCORE_REQUEST" },
	{ key: "open", label: "케이스 생성", type: "OPEN_CASES" },
]
const STATUS_LABEL = { RUNNING: "실행 중", SUCCEEDED: "완료", FAILED: "실패" }

// 서버 실행 한 줄 → 표의 처리 결과 칸(건수 하나). 날짜는 자동 처리 현황 제목 옆 기준일로 대신해요
function summaryOf(key, run) {
	const s = run.summary
	if (run.status === "RUNNING") {
		if (key === "scan") return scanningText(run.progress)
		return key === "score"
			? "AI 점수 기다리는 중"
			: key === "open"
				? "케이스 만드는 중"
				: "실행 중"
	}
	if (key === "scan")
		return run.status === "SUCCEEDED"
			? `생성 경보 ${formatCount(run.rowsOut)}건`
			: "실패 — 경보는 되돌림"
	if (key === "score") {
		if (!s) return run.status === "SUCCEEDED" ? "완료" : "실패"
		return run.status === "SUCCEEDED"
			? `성공 ${formatCount(s.scored)} · 실패 ${formatCount(s.failed)}`
			: `다시 보낼 실패 ${formatCount(s.retryable)}건`
	}
	return run.status === "SUCCEEDED"
		? `생성 ${formatCount(run.rowsOut)}건`
		: "실패 — 다시 실행하면 남은 경보만"
}

// 룰별 경보 건수(R01~R06) — [룰별 결과 보기]를 눌러야 펼쳐져요(표 한 줄이 길어지지 않게)
function RuleBreakdown({ rules }) {
	const [open, setOpen] = useState(false)
	if (!rules.length) return null
	return (
		<>
			<button
				type="button"
				className="batch-link-button"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
			>
				{open ? "룰별 결과 접기" : "룰별 결과 보기"}
			</button>
			{open && (
				<ul className="batch-rule-list">
					{rules.map((rule) => (
						<li key={rule.ruleId} title={`${rule.ruleId} 버전 ${rule.ruleVersion}`}>
							{ruleLabel(rule.ruleId)} · {formatCount(rule.alertCount)}건
						</li>
					))}
				</ul>
			)}
		</>
	)
}

// 서버 실행 한 줄 → 표의 상세 칸 — 단계 칸에서 뺀 자세한 결과(분석 거래 수·룰별 건수·모델·실패 사유·케이스 확인 링크)
function detailOf(key, run) {
	const s = run.summary
	if (run.status === "RUNNING") return null
	if (run.status === "FAILED" && !(key === "score" && s))
		return run.errorMessage ?? "실패 사유 없음"
	if (key === "scan")
		return (
			<>
				분석 거래 {formatCount(run.rowsIn)}건{" "}
				<RuleBreakdown rules={s?.alertsByRule ?? []} />
			</>
		)
	if (key === "score") {
		if (run.status === "FAILED")
			return `성공 ${formatCount(s.scored)} · 실패 ${formatCount(s.failed)} — [점수 재처리]로 남은 것만 다시 보내요`
		const permanent = (s?.failed ?? 0) - (s?.retryable ?? 0)
		return [
			s?.modelVersions.length ? `모델 ${s.modelVersions.join(", ")}` : null,
			permanent > 0
				? `다시 보내도 같은 실패 ${formatCount(permanent)}건(경보 점검에서 원인 확인)`
				: null,
		]
			.filter(Boolean)
			.join(" · ")
	}
	if (!run.rowsOut) return "새로 만들 HIGH 경보 없음"
	return <Link to="/cases?status=OPEN">케이스 확인·배정</Link>
}

export default function AdminBatchesPage() {
	// 마지막으로 고른 분석 날짜는 이 탭에 기억해요(사용자별) — 다른 메뉴에 갔다 오거나 새로고침해도 그 날짜의 서버 실행 기록으로
	// 자동 처리 현황·실행 결과를 다시 그려요. 진행 중인 단계는 목록 조회가 2초 폴링을 이어 가요(SCRUM-345).
	const { data: me } = useSession()
	const dateKey = batchDateKey(me?.loginId)
	const [date, setDateState] = useState(() => readBatchDate(dateKey))
	const setDate = useCallback(
		(value) => {
			setDateState(value)
			writeBatchDate(dateKey, value)
		},
		[dateKey],
	)
	const [load, setLoad] = useState(null)
	const runs = useBatchRunsForDate(date)
	const onLoad = useCallback((row) => setLoad(row), [])
	const rowOf = (step) => {
		if (step.key === "load") return load
		const run = latestOf(runs.data, step.type)
		if (!run) return null
		const partial = step.key === "score" && run.status === "FAILED" && run.summary?.scored > 0
		return {
			status: run.status,
			statusLabel: partial ? "일부 실패" : STATUS_LABEL[run.status],
			summary: summaryOf(step.key, run),
			note: detailOf(step.key, run),
		}
	}
	const rows = STEPS.map((step) => ({ step, row: rowOf(step) })).filter(({ row }) => row)
	return (
		<>
			<header className="case-page-heading">
				<h1>데이터·배치 운영</h1>
				<p>원천 데이터 적재부터 이상거래 탐지 및 케이스 생성까지 관리합니다.</p>
			</header>
			{/* 위: 사용자가 직접 실행하는 작업 두 개. 아래: 자동으로 이어지는 ②→③→④ 단계와 상태(SCRUM-345) */}
			<div className="batch-actions">
				<LoadDatasetCard onResult={onLoad} primary={load?.status !== "SUCCEEDED"} />
				<BatchRunCard
					date={date}
					onDateChange={setDate}
					primary={load?.status === "SUCCEEDED"}
					ready={load?.status === "SUCCEEDED"}
				/>
			</div>
			<section className="case-panel batch-flow-panel" aria-labelledby="batch-flow-title">
				<div className="batch-flow-head">
					<div className="batch-flow-title">
						<h2 id="batch-flow-title">자동 처리 현황</h2>
						{/* 기준일은 단계마다 반복하지 않고 여기 한 번 */}
						{isBatchDate(date) && (
							<span className="batch-step-date">기준일 {date}</span>
						)}
					</div>
				</div>
				<ol className="batch-flow">
					<li>
						<RuleScanCard date={date} />
					</li>
					<li>
						<ScoreCard date={date} />
					</li>
					<li>
						<OpenCasesCard date={date} />
					</li>
				</ol>
			</section>
			<section className="case-panel batch-results" aria-labelledby="batch-results-title">
				<h2 id="batch-results-title">실행 결과</h2>
				{rows.length === 0 ? (
					<p>아직 실행한 작업이 없어요. 원천 적재부터 시작해 주세요.</p>
				) : (
					<div className="case-table-scroll">
						<table className="case-table">
							<thead>
								<tr>
									<th>작업</th>
									<th>상태</th>
									<th>처리 결과</th>
									<th>상세</th>
								</tr>
							</thead>
							<tbody>
								{rows.map(({ step, row }) => (
									<tr key={step.key}>
										<td>{step.label}</td>
										<td>
											{row.statusLabel ??
												STATUS_LABEL[row.status] ??
												row.status}
										</td>
										<td>{row.summary}</td>
										<td className="batch-note">{row.note}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</>
	)
}
