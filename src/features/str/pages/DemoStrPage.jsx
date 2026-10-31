import { useSearchParams } from "react-router"
import Modal from "../../../shared/ui/dashboard/Modal"
import "../styles/dashboard-demo.css"
import { useState } from "react"
import { useEffect } from "react"
import PageHeading from "../../../shared/ui/dashboard/PageHeading.jsx"
import Empty from "../../../shared/ui/dashboard/Empty.jsx"
import { statusKo } from "../../../shared/demo/labels.js"
import Badge from "../../../shared/ui/dashboard/Badge.jsx"
import Icon from "../../../shared/ui/dashboard/Icon.jsx"
import { sectionKo } from "../../../shared/demo/labels.js"
import Button from "../../../shared/ui/dashboard/Button.jsx"
import { useDashboardDemo } from "../../../shared/demo/useDashboardDemo.js"
function StrEditor({ draft, isCurrent }) {
	const { db, role, action } = useDashboardDemo()
	const item = db.cases[0]
	const [texts, setTexts] = useState(() =>
		Object.fromEntries(draft?.sections.map((section) => [section.section, section.text]) ?? []),
	)
	const [historyOpen, setHistoryOpen] = useState(false)
	const [evidenceId, setEvidenceId] = useState(null)
	const evidence = db.transactions.find((tx) => tx.transaction_id === evidenceId)

	const changed = draft
		? Object.fromEntries(
				Object.entries(texts).filter(
					([key, value]) => draft.sections.find((s) => s.section === key)?.text !== value,
				),
			)
		: {}
	const dirty = Object.keys(changed).length > 0
	useEffect(() => {
		const warn = (event) => {
			if (dirty) {
				event.preventDefault()
				event.returnValue = ""
			}
		}
		window.addEventListener("beforeunload", warn)
		return () => window.removeEventListener("beforeunload", warn)
	}, [dirty])
	if (!draft)
		return (
			<main className="page">
				<PageHeading
					title="STR 보고서"
					description="목록 API가 없어 케이스 데이터로 구성한 데모 ViewModel입니다."
				/>
				<section className="panel">
					<Empty
						title="현재 초안이 없습니다"
						text="케이스를 에스컬레이션한 뒤 별도 버튼으로 STR 초안을 생성하세요."
					/>
				</section>
			</main>
		)
	const verification = draft.latest_verification
	const editable =
		isCurrent &&
		draft.status === "ACTIVE" &&
		role === "INVESTIGATOR" &&
		item.assignee_id === "inv01" &&
		!["PENDING_APPROVAL", "APPROVED"].includes(item.status)
	const submitReason = !isCurrent
		? "이전 초안은 읽기 전용입니다."
		: dirty
			? "본문 저장 필요"
			: item.status !== "DRAFTED"
				? "허용되지 않는 케이스 상태"
				: !verification
					? "검증 필요"
					: !verification.passed
						? "검증 불통과"
						: !verification.is_current
							? "이전 수정본 검증"
							: null
	return (
		<main className="page editor-page">
			<PageHeading
				eyebrow={`${item.case_no} · ${draft.draft_id}`}
				title="STR 보고서 편집"
				description={`케이스 ${statusKo[item.status]} · 초안 ${draft.status} · draft v${draft.version} · revision ${draft.revision_no ?? "AI 원문"}`}
				action={
					<div className="heading-actions">
						<Badge tone={draft.status === "LOCKED" ? "green" : "purple"}>
							{draft.status}
						</Badge>
						<Badge>{draft.generated_model}</Badge>
					</div>
				}
			/>
			{["PENDING_APPROVAL", "APPROVED"].includes(item.status) && (
				<div className="callout success">
					<Icon name="lock" />
					<span>
						<strong>
							{item.status === "APPROVED"
								? "승인 완료 · 문서 잠금"
								: "승인 대기 · 편집 잠금"}
						</strong>
						{item.status === "PENDING_APPROVAL"
							? "승인 대기 중에는 본문을 수정할 수 없습니다. 반려 후 보완할 수 있습니다."
							: `결정자 apr01 · 검증 ID ${draft.submitted_verification_id}`}
					</span>
				</div>
			)}
			<div className="editor-layout">
				<section className="document panel">
					<div className="facts">
						<h2>읽기 전용 facts</h2>
						<div>
							<span>거래</span>
							<strong>{draft.facts.transaction_count}건</strong>
							<span>계좌</span>
							<strong>{draft.facts.account_count}개</strong>
							<span>유입</span>
							<strong>
								{draft.facts.currency} {draft.facts.inbound_total.toLocaleString()}
							</strong>
							<span>유출</span>
							<strong>
								{draft.facts.currency} {draft.facts.outbound_total.toLocaleString()}
							</strong>
						</div>
						<p>facts와 evidence_ids는 수정 요청에 포함하지 않습니다.</p>
					</div>
					<div className="document-body">
						{draft.sections.map((section) => (
							<div
								className={`narrative-field ${verification?.code_checks.some((c) => c.section === section.section && c.result === "FAIL") ? "has-error" : ""}`}
								key={section.section}
							>
								<div className="field-label">
									<label htmlFor={`demo-section-${section.section}`}>
										{sectionKo[section.section] ?? section.section}
									</label>
									<code>{section.section}</code>
									<span>{(texts[section.section] ?? "").length} / 5,000</span>
								</div>
								<textarea
									id={`demo-section-${section.section}`}
									maxLength={5000}
									value={texts[section.section] ?? ""}
									onChange={(e) =>
										setTexts({
											...texts,
											[section.section]: e.target.value,
										})
									}
									disabled={!editable}
								/>
								<div className="evidence-row">
									<span>단락 근거</span>
									{section.evidence_ids.map((id) => (
										<button
											key={id}
											title="원본 근거 보기"
											onClick={() => setEvidenceId(id)}
										>
											{id}
										</button>
									))}
								</div>
							</div>
						))}
						<div className="checklist">
							<h3>5W1H 완전성 보조 체크리스트</h3>
							<p>
								서버가 정확히 6개 section을 반환한다고 가정하지 않습니다. 공식 제출
								서식 적합성 검증 화면이 아닙니다.
							</p>
							<div>
								{["WHO", "WHEN", "WHERE", "WHAT", "WHY", "HOW"].map((code) => (
									<Badge
										key={code}
										tone={
											draft.sections.some((s) => s.section === code)
												? "green"
												: "amber"
										}
									>
										{code}{" "}
										{draft.sections.some((s) => s.section === code)
											? "있음"
											: "확인 필요"}
									</Badge>
								))}
							</div>
						</div>
					</div>
				</section>
				<aside className="validation panel">
					<div className="section-head">
						<div>
							<h2>저장된 본문 검증</h2>
							<p>코드 대조 및 LLM 평가 결과</p>
						</div>
						{verification ? (
							<Badge
								tone={
									verification.passed && verification.is_current ? "green" : "red"
								}
							>
								{verification.is_current
									? verification.passed
										? "통과"
										: "불통과"
									: "과거 수정본"}
							</Badge>
						) : (
							<Badge>검증 없음</Badge>
						)}
					</div>
					{!verification ? (
						<Empty
							title="검증 결과 없음"
							text="초안은 저장되었으며 검증을 다시 실행해야 합니다."
						/>
					) : (
						<div className="verification-body">
							<div className="verification-meta">
								<span>verification_id</span>
								<code>{verification.verification_id}</code>
								<span>revision_no</span>
								<code>{verification.revision_no ?? "AI 원문"}</code>
								<span>verifier</span>
								<code>{verification.verifier_version}</code>
								<span>produced_at</span>
								<code>{verification.produced_at}</code>
							</div>
							{!verification.is_current && (
								<div className="callout warning">
									<Icon name="warning" />
									검증 중 본문이 변경되어 현재 본문에 사용할 수 없습니다.
								</div>
							)}
							<h3>코드 검사</h3>
							{verification.code_checks.map((check) => (
								<button
									onClick={() =>
										document
											.getElementById(`demo-section-${check.section}`)
											?.focus()
									}
									className={`check-item ${check.result.toLowerCase()}`}
									key={check.id}
								>
									<Icon name={check.result === "PASS" ? "check" : "warning"} />
									<span>
										<strong>
											{check.id} · {check.section}
										</strong>
										{check.message}
									</span>
								</button>
							))}
							<h3>LLM 평가</h3>
							{verification.llm_checks.map((check) => (
								<div
									className={`check-item ${check.result.toLowerCase()}`}
									key={check.id}
								>
									<Icon name={check.result === "PASS" ? "check" : "warning"} />
									<span>
										<strong>{check.id}</strong>
										{check.message}
									</span>
								</div>
							))}
						</div>
					)}
					<div className="history-toggle">
						<Button variant="ghost" onClick={() => setHistoryOpen(!historyOpen)}>
							수정 이력 {historyOpen ? "접기" : "보기"}
						</Button>
						{historyOpen && (
							<div className="revision-list">
								<div>
									<strong>AI 원문</strong>
									<small>revision_no=null · 본문 없음이 아님</small>
								</div>
								{db.revisions.map((revision) => (
									<details key={revision.revision_no}>
										<summary>
											수정 #{revision.revision_no} ·{" "}
											{revision.changed_sections.join(", ")}
										</summary>
										{revision.changed_sections.map((section) => (
											<div className="diff" key={section}>
												<code>{section}</code>
												<del>{revision.before[section]}</del>
												<ins>{revision.after[section]}</ins>
											</div>
										))}
									</details>
								))}
							</div>
						)}
					</div>
				</aside>
			</div>
			<div className="editor-footer">
				<span className={dirty ? "unsaved" : "saved"}>
					{dirty ? "미저장 변경사항" : "서버 저장본과 일치"}
				</span>
				<Button
					variant="secondary"
					onClick={() => action("revise", JSON.stringify(changed))}
					disabled={!dirty || !editable}
				>
					변경 단락 저장
				</Button>
				<Button
					variant="purple"
					onClick={() => action("verify")}
					disabled={dirty || !editable}
					title={dirty ? "먼저 본문을 저장하세요." : ""}
				>
					저장된 본문 검증
				</Button>
				<Button
					onClick={() => action("submit")}
					disabled={Boolean(submitReason) || !editable}
					title={submitReason ?? ""}
				>
					책임자 승인 요청
				</Button>
				{submitReason && <small>{submitReason}</small>}
			</div>
			{evidenceId && (
				<Modal title={`단락 근거 · ${evidenceId}`} onClose={() => setEvidenceId(null)}>
					{evidence ? (
						<dl>
							<dt>거래 시각</dt>
							<dd>{evidence.transaction_ts}</dd>
							<dt>송금 → 수취 계좌</dt>
							<dd>
								{evidence.from_account_key} → {evidence.to_account_key}
							</dd>
							<dt>금액</dt>
							<dd>
								{evidence.currency} {evidence.amount.toLocaleString()}
							</dd>
						</dl>
					) : (
						<p>이 시연 데이터에는 해당 거래의 상세 정보가 없습니다.</p>
					)}
				</Modal>
			)}
		</main>
	)
}

// 저장 성공으로 수정본이 바뀌면 새 저장본으로 편집기를 시작합니다. 검증만 바뀔 때는 입력을 유지합니다.
export default function DemoStrPage() {
	const { db } = useDashboardDemo()
	const [params, setParams] = useSearchParams()
	const selectedId = params.get("draft") || db.cases[0].current_draft_id
	const draft = db.drafts.find((entry) => entry.draft_id === selectedId)
	const isCurrent = selectedId === db.cases[0].current_draft_id
	return (
		<>
			{db.drafts.length > 0 && (
				<div className="demo-draft-switcher">
					<label>
						초안 버전{" "}
						<select
							value={selectedId}
							onChange={(event) => {
								const next = new URLSearchParams(params)
								next.set("draft", event.target.value)
								setParams(next)
							}}
						>
							{db.drafts.map((entry) => (
								<option key={entry.draft_id} value={entry.draft_id}>
									{entry.draft_id} · {entry.status}
								</option>
							))}
						</select>
					</label>
				</div>
			)}
			<StrEditor
				key={`${draft?.draft_id || "empty"}:${draft?.version ?? 0}`}
				draft={draft}
				isCurrent={isCurrent}
			/>
		</>
	)
}
