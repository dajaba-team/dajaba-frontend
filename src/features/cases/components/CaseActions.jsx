import { useEffect, useId, useRef, useState } from "react"
import { useCaseCommand } from "../hooks/useCases"
import { CLOSE_REASON_LABELS } from "../labels"
import { getErrorCode, getErrorMessage } from "../../../shared/api/apiClient"
import ReassignDialog from "./ReassignDialog"
import StrGenerateForm from "../../str/components/StrGenerateForm"
import Button from "../../../shared/ui/Button"

const COMMENT_MAX = 2000

// 버튼은 서버가 준 availableActions만 보고 켜요. 누르면 서버가 다시 검사해요(계약서 §4).
// 이 화면이 다루는 것: ASSIGN·REASSIGN·ESCALATE·CLOSE·CLOSE_WITH_DRAFT·GENERATE_DRAFT. 종료는 버튼 하나 — 초안이 있으면 서버가
// CLOSE 대신 CLOSE_WITH_DRAFT를 줘요(SCRUM-112). 초안 생성은 초안이 없을 때만 여기서 — 재생성은 STR 화면에서(미저장 편집 확인).
// request: 판단 요약의 [다음 처리] 주 버튼이 보낸 요청 { key, seq } — 같은 폼을 여기서 열고 이 카드로 옮겨 가요(SCRUM-372).
// primaryKey: 판단 요약에 이미 주 버튼으로 나온 동작 — 여기선 같은 버튼을 또 그리지 않아요(폼·확인창은 여기서 열려요).
export default function CaseActions({ detail, request = null, primaryKey = null }) {
	const [open, setOpen] = useState(null)
	const [reassigning, setReassigning] = useState(false)
	const sectionRef = useRef(null)
	const [seenRequest, setSeenRequest] = useState(request?.seq ?? null)
	if (request && request.seq !== seenRequest) {
		setSeenRequest(request.seq)
		if (request.key === "reassign") setReassigning(true)
		else setOpen(request.key)
	}
	useEffect(() => {
		if (request?.seq == null || request.key === "reassign") return
		const section = sectionRef.current
		section?.scrollIntoView?.({ block: "start", behavior: "smooth" })
		section?.querySelector(".case-action-form")?.focus?.({ preventScroll: true })
	}, [request?.seq, request?.key])
	const actions = detail.availableActions
	const has = (action) => actions.includes(action)
	const showButton = (key) => key !== primaryKey
	const canGenerate = has("GENERATE_DRAFT") && !detail.currentDraftNo
	// 409 뒤 상세를 다시 불러 그 동작이 빠졌으면(예: 다른 사람이 먼저 종료) 열린 폼도 닫아요.
	// open도 같이 비워서, 나중에 그 동작이 다시 생겨도 예전 폼이 저절로 열리지 않게 해요(#12 리뷰).
	// 초안 생성 폼은 성공 뒤 current_draft_no가 생겨도 결과 안내를 보여 주려고 열어 둬요.
	const shown = open === "generate_draft" || (open && has(open.toUpperCase())) ? open : null
	if (open && !shown) setOpen(null)
	const buttons = {
		assign: has("ASSIGN") && showButton("assign"),
		reassign: has("REASSIGN") && showButton("reassign"),
		escalate: has("ESCALATE") && showButton("escalate"),
		generate: canGenerate && showButton("generate_draft"),
		close: has("CLOSE") || has("CLOSE_WITH_DRAFT"),
	}
	const anyButton = Object.values(buttons).some(Boolean)
	if (!anyButton && !shown && !reassigning) return null
	return (
		<section
			ref={sectionRef}
			className="case-panel case-card case-actions"
			aria-labelledby="case-actions-title"
		>
			<h2 id="case-actions-title">처리 작업</h2>
			{anyButton && (
				<div className="case-action-buttons">
					{/* 배정은 관리자만(SCRUM-339) — 서버가 ASSIGN 을 관리자에게만 줘요. */}
					{buttons.assign && (
						<Button onClick={() => setOpen("assign")} disabled={!!shown}>
							담당자 배정
						</Button>
					)}
					{buttons.reassign && (
						<Button onClick={() => setReassigning(true)} disabled={!!shown}>
							담당자 변경
						</Button>
					)}
					{buttons.escalate && (
						<Button onClick={() => setOpen("escalate")} disabled={!!shown}>
							에스컬레이션
						</Button>
					)}
					{buttons.generate && (
						<Button onClick={() => setOpen("generate_draft")} disabled={!!shown}>
							STR 초안 생성
						</Button>
					)}
					{buttons.close && (
						<Button
							variant="danger"
							onClick={() => setOpen(has("CLOSE") ? "close" : "close_with_draft")}
							disabled={!!shown}
						>
							종료
						</Button>
					)}
				</div>
			)}
			{reassigning && has("REASSIGN") && (
				<ReassignDialog
					caseNo={detail.caseNo}
					version={detail.version}
					assignee={detail.assignee}
					onClose={() => setReassigning(false)}
				/>
			)}
			{shown === "assign" && <AssignForm detail={detail} onDone={() => setOpen(null)} />}
			{shown === "escalate" && <EscalateForm detail={detail} onDone={() => setOpen(null)} />}
			{shown === "close" && (
				<CloseForm detail={detail} name="close" onDone={() => setOpen(null)} />
			)}
			{shown === "close_with_draft" && (
				<CloseForm detail={detail} name="closeWithDraft" onDone={() => setOpen(null)} />
			)}
			{shown === "generate_draft" && (
				<StrGenerateForm detail={detail} onDone={() => setOpen(null)} />
			)}
		</section>
	)
}

// 확인 단계가 있는 작업 공통 틀. 실패해도 입력은 남기고 안내만 보여 줘요.
// fieldError 가 있으면 그 칸 옆에 보여 주니 폼 공통 안내는 같이 띄우지 않아요(계약서 3절 "입력칸 옆에").
function ActionForm({
	title,
	submitLabel,
	command,
	onSubmit,
	onDone,
	onSuccess,
	canSubmit,
	fieldError = false,
	// 되돌릴 수 없는 동작(종료)은 파란 주 버튼 대신 빨간 글자·테두리로 — 습관적으로 누르지 않게(#37 리뷰).
	irreversible = false,
	children,
}) {
	const titleId = useId()
	return (
		<form
			className="case-action-form"
			aria-labelledby={titleId}
			tabIndex={-1}
			onSubmit={(event) => {
				event.preventDefault()
				if (command.isPending || !canSubmit) return
				command.mutate(onSubmit(), {
					onSuccess: () => {
						onSuccess?.()
						onDone()
					},
				})
			}}
		>
			<h3 id={titleId}>{title}</h3>
			{children}
			{command.isError && !fieldError && <p role="alert">{getErrorMessage(command.error)}</p>}
			<div className="case-action-buttons">
				<button
					type="submit"
					className={irreversible ? "is-irreversible" : undefined}
					disabled={command.isPending || !canSubmit}
				>
					{command.isPending ? "처리 중…" : submitLabel}
				</button>
				<button type="button" onClick={onDone} disabled={command.isPending}>
					취소
				</button>
			</div>
		</form>
	)
}

function CommentField({ label, value, onChange }) {
	const id = useId()
	return (
		<div className="case-field">
			<label htmlFor={id}>{label}</label>
			<textarea
				id={id}
				value={value}
				maxLength={COMMENT_MAX}
				required
				onChange={(event) => onChange(event.target.value)}
			/>
			<small>
				{value.length.toLocaleString()} / {COMMENT_MAX.toLocaleString()}
			</small>
		</div>
	)
}

// 배정 대상 오류(409 INVALID_ASSIGNEE·404 USER_NOT_FOUND)는 계약서 3절대로 담당자 칸 아래에 — 입력은 남겨요.
const ASSIGNEE_ERRORS = ["INVALID_ASSIGNEE", "USER_NOT_FOUND"]

function AssignForm({ detail, onDone }) {
	const command = useCaseCommand(detail.caseNo, "assign")
	const [assignee, setAssignee] = useState("")
	const inputId = useId()
	const errorId = useId()
	const fieldError =
		command.isError && ASSIGNEE_ERRORS.includes(getErrorCode(command.error))
			? getErrorMessage(command.error)
			: null
	return (
		<ActionForm
			title="담당자 배정"
			submitLabel="배정"
			command={command}
			canSubmit={assignee.trim() !== ""}
			onSubmit={() => ({ version: detail.version, assignee: assignee.trim() })}
			onDone={onDone}
			fieldError={Boolean(fieldError)}
		>
			<div className="case-field">
				<label htmlFor={inputId}>배정할 조사역 아이디</label>
				<input
					id={inputId}
					value={assignee}
					aria-invalid={fieldError ? true : undefined}
					aria-describedby={fieldError ? errorId : undefined}
					onChange={(event) => setAssignee(event.target.value)}
				/>
				{fieldError && (
					<p id={errorId} role="alert">
						{fieldError}
					</p>
				)}
			</div>
		</ActionForm>
	)
}

function EscalateForm({ detail, onDone }) {
	const command = useCaseCommand(detail.caseNo, "escalate")
	const [comment, setComment] = useState("")
	return (
		<ActionForm
			title="에스컬레이션"
			submitLabel="에스컬레이션 실행"
			command={command}
			canSubmit={comment.trim() !== ""}
			onSubmit={() => ({ version: detail.version, comment })}
			onDone={onDone}
		>
			<p>성공해도 STR 초안은 자동으로 만들지 않아요. 초안 생성은 따로 요청해요.</p>
			<CommentField label="에스컬레이션 사유" value={comment} onChange={setComment} />
		</ActionForm>
	)
}

// name: "close"(초안 없음, A5) 또는 "closeWithDraft"(초안 있음, A6). 요청 본문은 같아요.
// STR 화면(초안 있는 종료)에서도 같은 폼을 써요.
export function CloseForm({ detail, name, onDone, onClosed }) {
	const command = useCaseCommand(detail.caseNo, name)
	const [closeReason, setCloseReason] = useState("")
	const [comment, setComment] = useState("")
	return (
		<ActionForm
			title="케이스 종료"
			submitLabel="종료 실행"
			irreversible
			command={command}
			canSubmit={closeReason !== "" && comment.trim() !== ""}
			onSubmit={() => ({ version: detail.version, closeReason, comment })}
			onDone={onDone}
			onSuccess={onClosed}
		>
			<p>종료한 케이스는 다시 열 수 없어요. 종료는 범죄가 없다는 확정이 아니에요.</p>
			{name === "closeWithDraft" && (
				<p className="case-action-note">
					작성한 STR 초안({detail.currentDraftNo})은 대체됨으로 바뀌어 더는 고치거나 승인
					요청할 수 없어요. 초안 내용은 이력으로 남아요.
				</p>
			)}
			{detail.rejectionReasonCode === "NOT_REPORTABLE" && (
				<p className="case-action-note">
					승인자가 &lsquo;보고 안 함&rsquo;으로 반려한 케이스예요. 반려 코드는 이력에 남아
					있으니 종료 사유는 아래에서 골라요(보통 &lsquo;추가 조치 불필요&rsquo;).
				</p>
			)}
			<fieldset className="case-field">
				<legend>종료 사유</legend>
				{Object.entries(CLOSE_REASON_LABELS).map(([value, label]) => (
					<label key={value}>
						<input
							type="radio"
							name="close-reason"
							value={value}
							checked={closeReason === value}
							onChange={() => setCloseReason(value)}
						/>{" "}
						{label}
					</label>
				))}
			</fieldset>
			<CommentField label="종료 설명" value={comment} onChange={setComment} />
		</ActionForm>
	)
}
