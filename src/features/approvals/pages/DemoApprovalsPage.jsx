import "../styles/dashboard-demo.css"
import { useState } from "react"
import PageHeading from "../../../shared/ui/dashboard/PageHeading.jsx"
import Empty from "../../../shared/ui/dashboard/Empty.jsx"
import { statusKo } from "../../../shared/demo/labels.js"
import Badge from "../../../shared/ui/dashboard/Badge.jsx"
import { sectionKo } from "../../../shared/demo/labels.js"
import Button from "../../../shared/ui/dashboard/Button.jsx"
import Modal from "../../../shared/ui/dashboard/Modal.jsx"
import { useDashboardDemo } from "../../../shared/demo/useDashboardDemo.js"
export default function Approvals() {
	const { db, role, action } = useDashboardDemo()
	const item = db.cases[0]
	const draft = db.drafts.find((entry) => entry.draft_id === item.current_draft_id)
	const [modal, setModal] = useState(null)
	const [comment, setComment] = useState("")
	return (
		<main className="page">
			<PageHeading
				eyebrow="APPROVER"
				title="승인함"
				description="GET /api/v1/cases?status=PENDING_APPROVAL 기반으로 구성한 승인 대기 목록입니다."
			/>
			{item.status !== "PENDING_APPROVAL" ? (
				<section className="panel">
					<Empty
						title="승인 대기 건이 없습니다"
						text={`대표 케이스 현재 상태: ${statusKo[item.status]}`}
					/>
				</section>
			) : (
				<>
					<section className="panel approval-summary">
						<div>
							<span>케이스</span>
							<strong className="mono">{item.case_no}</strong>
						</div>
						<div>
							<span>담당 조사역</span>
							<strong>{item.assignee_id}</strong>
						</div>
						<div>
							<span>제출 초안</span>
							<strong className="mono">{draft?.draft_id}</strong>
						</div>
						<div>
							<span>수정본</span>
							<strong>#{item.submitted_revision_no ?? "AI 원문"}</strong>
						</div>
						<div>
							<span>검증</span>
							<Badge tone="green">통과 · {draft?.submitted_verification_id}</Badge>
						</div>
					</section>
					<div className="approval-layout">
						<section className="panel document">
							<div className="section-head">
								<div>
									<h2>제출 STR 본문</h2>
									<p>읽기 전용 · 제출 수정본 고정</p>
								</div>
							</div>
							<div className="document-body">
								{draft?.sections.map((section) => (
									<article className="readonly-section" key={section.section}>
										<code>{section.section}</code>
										<h3>{sectionKo[section.section] ?? section.section}</h3>
										<p>{section.text}</p>
										<div className="evidence-row">
											{section.evidence_ids.map((id) => (
												<code key={id}>{id}</code>
											))}
										</div>
									</article>
								))}
							</div>
						</section>
						<aside className="panel decision-card">
							<h2>책임자 결정</h2>
							<p>
								승인 전 현재 초안·수정본·검증 ID를 확인하세요. 승인 요청은 감독기관
								제출이 아닙니다.
							</p>
							<div className="stack">
								<Button
									onClick={() => setModal("approve")}
									disabled={role !== "APPROVER"}
								>
									승인 확인
								</Button>
								<Button
									variant="danger"
									onClick={() => setModal("reject")}
									disabled={role !== "APPROVER"}
								>
									보완 요청으로 반려
								</Button>
							</div>
						</aside>
					</div>
				</>
			)}
			{modal === "approve" && (
				<Modal
					title="STR 승인 확인"
					onClose={() => setModal(null)}
					footer={
						<>
							<Button variant="secondary" onClick={() => setModal(null)}>
								취소
							</Button>
							<Button
								onClick={async () => {
									if (await action("approve")) setModal(null)
								}}
							>
								승인 및 잠금
							</Button>
						</>
					}
				>
					<p>
						<strong>{item.case_no}</strong>의 제출 수정본과 검증 결과를 확인했습니다.
						승인하면 초안은 LOCKED 상태가 됩니다.
					</p>
				</Modal>
			)}
			{modal === "reject" && (
				<Modal
					title="보완 요청으로 반려"
					onClose={() => setModal(null)}
					footer={
						<>
							<Button variant="secondary" onClick={() => setModal(null)}>
								취소
							</Button>
							<Button
								variant="danger"
								onClick={async () => {
									if (await action("reject", comment)) setModal(null)
								}}
								disabled={!comment.trim()}
							>
								반려
							</Button>
						</>
					}
				>
					<label className="field">
						구체적인 보완 요청
						<textarea
							maxLength={2000}
							value={comment}
							onChange={(e) => setComment(e.target.value)}
							autoFocus
						/>
					</label>
					<p className="helper">{comment.length} / 2,000 · 필수</p>
				</Modal>
			)}
		</main>
	)
}
