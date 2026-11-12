import { useCallback, useId, useState } from "react"
import "../../../cases/styles/cases.css"
import "../styles/batches.css"
import BatchStep from "../components/BatchStep"
import LoadDatasetCard from "../components/LoadDatasetCard"
import RuleScanCard from "../components/RuleScanCard"
import OpenCasesCard from "../components/OpenCasesCard"

// 데이터·배치 운영(ADM-01, SCRUM-220) — 흐름 데모 v1.4 배치: 분석 날짜 → 4단계 카드 한 줄 → 실행 결과 → 안내.
// 분석 날짜는 위에서 한 번 고르고 룰 스캔(다음 PR 점수 산출)에 써요. [케이스 생성] 카드(SCRUM-180)는 아직 자기 날짜 칸.
// 실행 결과 표는 이 화면에서 실행한 것만 보여 줘요(새로고침하면 비어요 — 서버 기록은 B5).
// 단계 잠금은 하지 않아요 — 새로고침하면 이 화면은 앞 단계 결과를 모르니, 순서는 서버 409가 지켜요. 다음 단계 버튼만 진하게.
const STEPS = [
	{ key: "load", label: "원천 적재", next: "룰 스캔" },
	{ key: "scan", label: "룰 스캔", next: "점수 산출" },
]
const STATUS_LABEL = { RUNNING: "실행 중", SUCCEEDED: "완료", FAILED: "실패" }
const nextAction = (step, row) =>
	row.status === "SUCCEEDED"
		? step.next
		: row.status === "FAILED"
			? "원인 확인 후 다시 실행"
			: "상태 확인 중"

export default function AdminBatchesPage() {
	const dateId = useId()
	const [date, setDate] = useState("")
	const [results, setResults] = useState({})
	const onLoad = useCallback((row) => setResults((prev) => ({ ...prev, load: row })), [])
	const onScan = useCallback((row) => setResults((prev) => ({ ...prev, scan: row })), [])
	const rows = STEPS.filter((step) => results[step.key])
	const next = STEPS.find((step) => results[step.key]?.status !== "SUCCEEDED")?.key
	return (
		<>
			<header className="case-page-heading">
				<h1>데이터·배치 운영</h1>
				<p>데이터를 준비하고 결과를 확인한 뒤 조사 업무로 넘깁니다.</p>
			</header>
			<section className="case-panel batch-target" aria-label="분석 대상">
				<label htmlFor={dateId}>분석 날짜</label>
				<input
					id={dateId}
					type="date"
					value={date}
					onChange={(event) => setDate(event.target.value)}
				/>
				<p>
					IBM 합성 거래 · 원천 적재는 날짜와 상관없이 한 번, 룰 스캔부터 이 날짜로
					실행해요.
				</p>
			</section>
			<div className="batch-steps">
				<LoadDatasetCard onResult={onLoad} primary={next === "load"} />
				<RuleScanCard key={date} date={date} onResult={onScan} primary={next === "scan"} />
				<BatchStep
					id="score-step-title"
					no={3}
					title="점수 산출"
					scope="성공분 유지 · 재처리 가능한 실패만"
				>
					<button type="button" className="batch-run" disabled>
						준비 중
					</button>
					<p>다음 작업(점수 카드)에서 연결해요.</p>
				</BatchStep>
				<OpenCasesCard />
			</div>
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
									<th>결과</th>
									<th>다음 행동</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((step) => {
									const row = results[step.key]
									return (
										<tr key={step.key}>
											<td>{step.label}</td>
											<td>{STATUS_LABEL[row.status] ?? row.status}</td>
											<td>{row.summary}</td>
											<td>{nextAction(step, row)}</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>
			<p className="batch-callout">
				케이스가 생성되면 [조사 케이스]에서 담당자를 배정하세요. 관리자는 조사 메모·STR 본문
				작성·승인을 대신하지 않습니다.
			</p>
		</>
	)
}
