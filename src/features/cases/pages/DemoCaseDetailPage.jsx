import "../styles/dashboard-demo.css"
import { useState } from "react"
import PageHeading from "../../../shared/ui/dashboard/PageHeading.jsx"
import Badge from "../../../shared/ui/dashboard/Badge.jsx"
import { statusKo } from "../../../shared/demo/labels.js"
import Icon from "../../../shared/ui/dashboard/Icon.jsx"
import FlowGraph from "../components/DemoFlowGraph.jsx"
import Empty from "../../../shared/ui/dashboard/Empty.jsx"
import Button from "../../../shared/ui/dashboard/Button.jsx"
import Modal from "../../../shared/ui/dashboard/Modal.jsx"
import { useDashboardDemo } from "../../../shared/demo/useDashboardDemo.js"
import { formatDataTime } from "../../../shared/format/time"
export default function CaseDetail() {
	const { db, role, go, action } = useDashboardDemo()
	const item = db.cases[0]
	const owner = role === "INVESTIGATOR" && item.assignee_id === "inv01"
	const [note, setNote] = useState(item.note)
	const [modal, setModal] = useState(null)
	const [comment, setComment] = useState("")

	return (
		<main className="page">
			<button className="back-link" onClick={() => go("cases")}>
				← 케이스 목록
			</button>
			<PageHeading
				eyebrow={`CASE v${item.version}`}
				title={item.case_no}
				description={`${item.masked_account_no} · 연결 경보 ${item.alert_no} · 거래 시간 창 ${item.transaction_window}`}
				action={
					<div className="heading-actions">
						<Badge
							tone={
								item.status === "REJECTED"
									? "amber"
									: item.status === "APPROVED"
										? "green"
										: "blue"
							}
						>
							{statusKo[item.status]}
						</Badge>
						<Badge>{item.assignee_id ?? "미배정"}</Badge>
					</div>
				}
			/>
			{item.rejection_comment && (
				<div className="callout warning">
					<Icon name="warning" />
					<span>
						<strong>책임자 반려 사유</strong>
						{item.rejection_comment}
						<small>
							기존 본문 보완 후 DRAFTED 복귀는 mock adapter · HTTP 계약 확인 필요
						</small>
					</span>
				</div>
			)}
			<div className="case-layout">
				<div className="case-main">
					<div className="metric-grid">
						<div className="metric-card">
							<span>유입 합계</span>
							<strong>USD 320,482</strong>
							<small>47건 전체 집계 · 잔액 아님</small>
						</div>
						<div className="metric-card">
							<span>유출 합계</span>
							<strong>USD 309,200</strong>
							<small>환산 없이 통화별 집계</small>
						</div>
						<div className="metric-card">
							<span>환산 모델 점수</span>
							<strong>94 / 100</strong>
							<small>score 0.94 · 범죄 확률 아님</small>
						</div>
					</div>
					<FlowGraph db={db} />
					<section className="panel table-card">
						<div className="section-head">
							<div>
								<h2>관련 거래</h2>
								<p>미리보기 5건 · 전체 합계와 구분</p>
							</div>
						</div>
						<div className="table-scroll">
							<table>
								<thead>
									<tr>
										<th>거래 ID</th>
										<th>원천 시각</th>
										<th>송금 계좌</th>
										<th>수취 계좌</th>
										<th>방향</th>
										<th>송금액</th>
										<th>통화</th>
									</tr>
								</thead>
								<tbody>
									{db.transactions.map((tx) => (
										<tr key={tx.transaction_id}>
											<td className="mono link">{tx.transaction_id}</td>
											<td>{formatDataTime(tx.transaction_ts)}</td>
											<td className="mono">{tx.from_masked_account_no}</td>
											<td className="mono">{tx.to_masked_account_no}</td>
											<td>
												{tx.direction === "IN"
													? "대상 계좌 유입"
													: "대상 계좌 유출"}
											</td>
											<td className="mono">{tx.amount.toLocaleString()}</td>
											<td>{tx.currency}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
				<aside className="case-aside">
					<section className="panel aside-card">
						<div className="ai-label">
							<Icon name="sparkle" />
							AI 조사 요약
						</div>
						{item.summary ? (
							<>
								<p>{item.summary}</p>
								<small>모델 {item.summary_model} · 거래 근거 5건 미리보기</small>
							</>
						) : (
							<Empty
								title="생성된 요약 없음"
								text="요약은 STR 생성이나 상태 변경을 실행하지 않습니다."
							/>
						)}
						<Button
							variant="purple"
							icon="refresh"
							onClick={() => action("summary")}
							disabled={!owner || item.status !== "REVIEWING"}
						>
							{item.summary ? "요약 갱신" : "요약 생성"}
						</Button>
					</section>
					<section className="panel aside-card">
						<div className="section-head compact">
							<div>
								<h2>조사 메모</h2>
								<p>{note === item.note ? "저장된 내용" : "미저장 변경사항"}</p>
							</div>
						</div>
						<textarea
							maxLength={10000}
							aria-label="시연 조사 메모"
							value={note}
							onChange={(e) => setNote(e.target.value)}
							disabled={!owner || item.status !== "REVIEWING"}
							placeholder="고객 관계와 거래 목적 등 추가 확인 사항"
						/>
						<div className="field-footer">
							<span>{note.length.toLocaleString()} / 10,000</span>
							<Button
								onClick={() => action("note", note)}
								disabled={note === item.note || !owner}
							>
								명시적으로 저장
							</Button>
						</div>
					</section>
					<section className="panel aside-card">
						<h2>상태별 다음 작업</h2>
						<div className="next-actions">
							{item.status === "OPEN" && (
								<p>목록에서 담당 조사역에게 배정해야 합니다.</p>
							)}
							{item.status === "REVIEWING" && (
								<Button
									onClick={() => setModal("escalate")}
									disabled={!owner}
									title={!owner ? "담당 조사역만 실행 가능" : ""}
								>
									에스컬레이션
								</Button>
							)}
							{item.status === "ESCALATED" && (
								<Button
									variant="purple"
									icon="sparkle"
									onClick={() => setModal("draft")}
									disabled={!owner}
								>
									STR 초안 생성
								</Button>
							)}
							{["DRAFTED", "REJECTED", "PENDING_APPROVAL", "APPROVED"].includes(
								item.status,
							) && <Button onClick={() => go("str")}>현재 STR 열기</Button>}
						</div>
					</section>
					<section className="panel aside-card">
						<h2>최근 상태 이력</h2>
						<div className="timeline">
							{db.histories
								.filter((h) => h.category === "CASE")
								.slice(0, 5)
								.map((h) => (
									<div key={h.id}>
										<i />
										<span>
											<strong>{h.title}</strong>
											<small>
												{h.detail} · {h.actor}
											</small>
										</span>
									</div>
								))}
						</div>
					</section>
				</aside>
			</div>
			{modal === "escalate" && (
				<Modal
					title="케이스 에스컬레이션"
					onClose={() => setModal(null)}
					footer={
						<>
							<Button variant="secondary" onClick={() => setModal(null)}>
								취소
							</Button>
							<Button
								onClick={async () => {
									if (await action("escalate", comment)) setModal(null)
								}}
								disabled={!comment.trim()}
							>
								에스컬레이션만 실행
							</Button>
						</>
					}
				>
					<p>성공해도 AI 호출이나 STR 초안 생성은 자동 실행되지 않습니다.</p>
					<label className="field">
						상신 사유
						<textarea
							value={comment}
							onChange={(e) => setComment(e.target.value)}
							autoFocus
						/>
					</label>
				</Modal>
			)}
			{modal === "draft" && (
				<Modal
					title="STR 초안 생성"
					onClose={() => setModal(null)}
					footer={
						<>
							<Button variant="secondary" onClick={() => setModal(null)}>
								취소
							</Button>
							<Button
								variant="purple"
								onClick={async () => {
									if (await action("draft")) setModal(null)
								}}
							>
								생성 시작
							</Button>
						</>
					}
				>
					<div className="callout purple">
						<Icon name="sparkle" />
						<span>
							<strong>초안 생성</strong>AI 생성에 시간이 걸릴 수 있습니다. 단계별 진행
							계약이 없어 가짜 진행률은 표시하지 않습니다.
						</span>
					</div>
					<p>
						이 화면은 가상 데이터로만 실행합니다. 생성 실패 시 ESCALATED 상태와 기존
						데이터를 유지합니다.
					</p>
				</Modal>
			)}
		</main>
	)
}
