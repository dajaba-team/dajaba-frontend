import "../styles/dashboard-demo.css"
import PageHeading from "../../../../shared/ui/dashboard/PageHeading.jsx"
import Badge from "../../../../shared/ui/dashboard/Badge.jsx"
import Button from "../../../../shared/ui/dashboard/Button.jsx"
import { statusKo } from "../../../../shared/demo/labels.js"
import Icon from "../../../../shared/ui/dashboard/Icon.jsx"
import { useDashboardDemo } from "../../../../shared/demo/useDashboardDemo.js"
import { formatSystemTime } from "../../../../shared/format/time"
export default function BatchOperations() {
	const { db, runBatch: run } = useDashboardDemo()
	const completed = (type) => db.batches.some((b) => b.type === type && b.status === "SUCCEEDED")
	const steps = [
		{
			type: "LOAD",
			label: "① 데이터 적재",
			api: "POST /api/v1/admin/batches/load",
			note: "202 접수 후 batch_run_id 조회",
			disabled: completed("LOAD"),
		},
		{
			type: "RULE_SCAN",
			label: "② 날짜별 룰 스캔",
			api: "POST /api/v1/admin/batches/rule-scan?date=",
			note: "동기 응답",
			disabled: !completed("LOAD") || completed("RULE_SCAN"),
		},
		{
			type: "SCORE",
			label: "③ AI 점수 요청",
			api: "POST /api/v1/admin/batches/score?date=",
			note: "동기 응답 · 경보별 실패 분리",
			disabled: !completed("RULE_SCAN") || completed("SCORE"),
		},
		{
			type: "SCORE_RETRY",
			label: "④ 실패 점수 재처리",
			api: "POST /api/v1/admin/batches/score/retry?date=",
			note: "실패 대상만 재요청",
			disabled: !completed("SCORE") || !db.alerts.some((a) => a.score_status === "FAILED"),
		},
		{
			type: "OPEN_CASES",
			label: "⑤ HIGH 경보 케이스 생성",
			api: "POST /api/v1/admin/batches/open-cases?date=",
			note: "동기 응답 · 시연 데이터만 변경",
			disabled: !completed("SCORE") || completed("OPEN_CASES"),
		},
	]
	return (
		<main className="page">
			<PageHeading
				eyebrow="ADMIN"
				title="데이터·배치 운영"
				description="서버 사전 배치 파일 적재부터 HIGH 경보 케이스 생성까지 순서대로 실행합니다."
				action={
					<label className="date-control">
						배치 날짜 (시연 고정)
						<input type="date" value={db.selected_date} readOnly />
					</label>
				}
			/>
			<section className="step-grid">
				{steps.map((step) => (
					<div className="step-card panel" key={step.type}>
						<div>
							<Badge tone={completed(step.type) ? "green" : "neutral"}>
								{completed(step.type) ? "완료" : "대기"}
							</Badge>
							<h2>{step.label}</h2>
							<code>
								{step.api}
								{step.api.endsWith("=") ? db.selected_date : ""}
							</code>
							<p>{step.note}</p>
						</div>
						<Button
							onClick={() => run(step.type)}
							disabled={step.disabled}
							title={
								step.disabled ? "선행 단계가 필요하거나 이미 완료되었습니다." : ""
							}
						>
							{completed(step.type) ? "실행 완료" : "실행"}
						</Button>
					</div>
				))}
			</section>
			<section className="panel table-card">
				<div className="section-head">
					<div>
						<h2>실행 이력</h2>
						<p>진행률 계약이 없어 상태·경과 시간만 표시합니다.</p>
					</div>
				</div>
				<div className="table-scroll">
					<table>
						<thead>
							<tr>
								<th>배치 ID</th>
								<th>유형</th>
								<th>상태</th>
								<th>시작 / 종료</th>
								<th>입력</th>
								<th>출력</th>
								<th>실패</th>
								<th>오류 메시지</th>
							</tr>
						</thead>
						<tbody>
							{db.batches.map((batch) => (
								<tr key={batch.batch_run_id}>
									<td className="mono">{batch.batch_run_id}</td>
									<td>{batch.type}</td>
									<td>
										<Badge
											tone={batch.status === "SUCCEEDED" ? "green" : "red"}
										>
											{statusKo[batch.status]}
										</Badge>
									</td>
									<td>
										{formatSystemTime(batch.started_at)}
										<small>
											{batch.ended_at
												? formatSystemTime(batch.ended_at)
												: "처리 중"}
										</small>
									</td>
									<td>{batch.input_count.toLocaleString()}</td>
									<td>{batch.output_count.toLocaleString()}</td>
									<td>{batch.failed_count}</td>
									<td>{batch.error_message ?? "—"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
			<section className="source-grid">
				{[
					"transactions · 거래 원장",
					"accounts · 계좌",
					"entities · 법인",
					"customer_attributes · 합성 보강",
				].map((name) => (
					<div className="panel source-card" key={name}>
						<Icon name="database" />
						<strong>{name}</strong>
						<p>읽기 전용 구조 · 미리보기는 데모 데이터</p>
						<Badge>조회 API 계약 없음</Badge>
					</div>
				))}
			</section>
		</main>
	)
}
