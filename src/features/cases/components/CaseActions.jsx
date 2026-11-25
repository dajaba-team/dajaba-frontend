import { useId, useState } from "react"
import { useCaseCommand } from "../hooks/useCases"
import { CLOSE_REASON_LABELS } from "../labels"
import { getErrorMessage } from "../../../shared/api/apiClient"
import AssigneeDialog from "./AssigneeDialog"
import StrGenerateForm from "../../str/components/StrGenerateForm"
import Button from "../../../shared/ui/Button"
import ActionDialog from "../../../shared/ui/ActionDialog"

const COMMENT_MAX = 2000

// 버튼은 서버가 준 availableActions만 보고 켜요. 누르면 서버가 다시 검사해요(계약서 §4).
// 이 화면이 다루는 것: ASSIGN·REASSIGN·ESCALATE·CLOSE·CLOSE_WITH_DRAFT·GENERATE_DRAFT. 종료는 버튼 하나 — 초안이 있으면 서버가
// CLOSE 대신 CLOSE_WITH_DRAFT를 줘요(SCRUM-112). 초안 생성은 초안이 없을 때만 여기서 — 재생성은 STR 화면에서(미저장 편집 확인).
// 작업은 모두 확인창(다이얼로그)으로 열려요 — 카드 아래로 폼이 펼쳐지지 않아요(SCRUM-428).
// request: 판단 요약의 [다음 처리] 주 버튼이 보낸 요청 { key, seq } — 같은 확인창을 여기서 열어요(SCRUM-372).
// primaryKey: 판단 요약에 이미 주 버튼으로 나온 동작 — 여기선 같은 버튼을 또 그리지 않아요(확인창은 여기서 열려요).
export default function CaseActions({ detail, request = null, primaryKey = null }) {
	const [open, setOpen] = useState(null)
	const [seenRequest, setSeenRequest] = useState(request?.seq ?? null)
	if (request && request.seq !== seenRequest) {
		setSeenRequest(request.seq)
		setOpen(request.key)
	}
	const actions = detail.availableActions
	const has = (action) => actions.includes(action)
	const showButton = (key) => key !== primaryKey
	const canGenerate = has("GENERATE_DRAFT") && !detail.currentDraftNo
	// 409 뒤 상세를 다시 불러 그 동작이 빠졌으면(예: 다른 사람이 먼저 종료) 열린 창도 닫아요.
	// open도 같이 비워서, 나중에 그 동작이 다시 생겨도 예전 창이 저절로 열리지 않게 해요(#12 리뷰).
	// 초안 생성 창은 성공 뒤 current_draft_no가 생겨도 결과 안내를 보여 주려고 열어 둬요.
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
	if (!anyButton && !shown) return null
	const close = () => setOpen(null)
	return (
		<section className="case-panel case-card case-actions" aria-labelledby="case-actions-title">
			<h2 id="case-actions-title">처리 작업</h2>
			{anyButton && (
				<div className="case-action-buttons">
					{/* 배정은 관리자만(SCRUM-339) — 서버가 ASSIGN 을 관리자에게만 줘요. */}
					{buttons.assign && (
						<Button onClick={() => setOpen("assign")}>담당자 배정</Button>
					)}
					{buttons.reassign && (
						<Button onClick={() => setOpen("reassign")}>담당자 변경</Button>
					)}
					{buttons.escalate && (
						<Button onClick={() => setOpen("escalate")}>에스컬레이션</Button>
					)}
					{buttons.generate && (
						<Button onClick={() => setOpen("generate_draft")}>STR 초안 생성</Button>
					)}
					{buttons.close && (
						<Button
							variant="danger"
							onClick={() => setOpen(has("CLOSE") ? "close" : "close_with_draft")}
						>
							종료
						</Button>
					)}
				</div>
			)}
			{(shown === "assign" || shown === "reassign") && (
				<AssigneeDialog
					mode={shown}
					caseNo={detail.caseNo}
					version={detail.version}
					assignee={detail.assignee}
					onClose={close}
				/>
			)}
			{shown === "escalate" && <EscalateForm detail={detail} onDone={close} />}
			{shown === "close" && <CloseForm detail={detail} name="close" onDone={close} />}
			{shown === "close_with_draft" && (
				<CloseForm detail={detail} name="closeWithDraft" onDone={close} />
			)}
			{shown === "generate_draft" && <StrGenerateForm detail={detail} onDone={close} />}
		</section>
	)
}

// 확인창 공통 — 실패해도 입력은 남기고 안내만 보여 줘요.
function CommandDialog({ command, onSubmit, onDone, onSuccess, ...props }) {
	return (
		<ActionDialog
			{...props}
			pending={command.isPending}
			error={command.isError ? getErrorMessage(command.error) : null}
			onSubmit={() =>
				command.mutate(onSubmit(), {
					onSuccess: () => {
						onSuccess?.()
						onDone()
					},
				})
			}
			onClose={onDone}
		/>
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

// 에스컬레이션 사유 예시(SCRUM-428) — 처음 쓰는 사람도 사유를 쉽게 채우게. 누르면 칸에 이어 붙고, 고쳐 쓸 수 있어요.
// 사유는 필수(BE @NotBlank, 계약서 A4) — 감사 기록에 "왜 의심했는지"가 남아야 해서 비워 둘 수 없어요.
const ESCALATE_EXAMPLES = [
	"자금 흐름이 탐지 유형과 맞아 추가 검토가 필요함",
	"짧은 기간에 여러 계좌로 나뉘어 오간 거래가 확인됨",
	"거래 목적과 상대방을 고객 자료로 확인할 수 없음",
]

function EscalateForm({ detail, onDone }) {
	const command = useCaseCommand(detail.caseNo, "escalate")
	const [comment, setComment] = useState("")
	const addExample = (text) => {
		const next = comment.trim() ? `${comment.trimEnd()}\n${text}` : text
		setComment(next.slice(0, COMMENT_MAX))
	}
	return (
		<CommandDialog
			title="에스컬레이션"
			submitLabel="에스컬레이션 실행"
			command={command}
			canSubmit={comment.trim() !== ""}
			onSubmit={() => ({ version: detail.version, comment })}
			onDone={onDone}
		>
			<p>성공해도 STR 초안은 자동으로 만들지 않아요. 초안 생성은 따로 요청해요.</p>
			<CommentField label="에스컬레이션 사유" value={comment} onChange={setComment} />
			<div className="case-reason-examples" role="group" aria-label="사유 예시">
				<span>사유 예시 · 누르면 칸에 들어가요</span>
				{ESCALATE_EXAMPLES.map((text) => (
					<button key={text} type="button" onClick={() => addExample(text)}>
						{text}
					</button>
				))}
			</div>
		</CommandDialog>
	)
}

// name: "close"(초안 없음, A5) 또는 "closeWithDraft"(초안 있음, A6). 요청 본문은 같아요.
// STR 화면(초안 있는 종료)에서도 같은 확인창을 써요.
export function CloseForm({ detail, name, onDone, onClosed }) {
	const command = useCaseCommand(detail.caseNo, name)
	const [closeReason, setCloseReason] = useState("")
	const [comment, setComment] = useState("")
	return (
		<CommandDialog
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
		</CommandDialog>
	)
}
