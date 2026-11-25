import { useState } from "react"
import Modal from "../../../shared/ui/dashboard/Modal"
import { revisionLabel } from "../../../shared/str/revisionLabel"
import { suspicionTypeLabel } from "../../../shared/str/suspicionTypes"
import { getErrorMessage } from "../../../shared/api/apiClient"
import { suspicionMissing } from "../model/strRules"
import { SuspicionFields } from "./StrSuspicionPanel"

// [승인 요청] 창 — 두 단계.
// 1) 의심 유형·지점 의심 정도 고르기 → [완료]
// 2) "보내면 편집할 수 없어요" 확인 → [승인 요청](S6) / [계속 편집](창 닫고 편집으로)
// 고른 값은 화면(StrWorkspace)이 들고 있어서, 계속 편집 뒤 다시 열어도 그대로예요.
export default function StrSubmitDialog({
	draft,
	types,
	level,
	onTypesChange,
	onLevelChange,
	command,
	onConfirm,
	onCancel,
}) {
	const [step, setStep] = useState("pick")
	const missing = suspicionMissing(types, level)
	const sending = command.isPending
	const cancel = sending ? () => {} : onCancel

	if (step === "pick")
		return (
			<Modal
				className="modal-wide str-submit-dialog"
				title="승인 요청 — 의심 유형·지점 의심 정도"
				onClose={cancel}
				footer={
					<>
						<button type="button" onClick={cancel}>
							취소
						</button>
						<button
							type="button"
							className="primary"
							onClick={() => setStep("confirm")}
							disabled={Boolean(missing)}
						>
							완료
						</button>
					</>
				}
			>
				<p>승인 요청에 함께 보낼 VI부를 골라 주세요.</p>
				<SuspicionFields
					types={types}
					level={level}
					recommended={draft.suspicionTypesRecommended}
					onTypesChange={onTypesChange}
					onLevelChange={onLevelChange}
				/>
				{missing && <p className="str-submit-hint">{missing}</p>}
			</Modal>
		)

	return (
		<Modal
			className="str-submit-dialog str-submit-confirm"
			title="승인 요청 확인"
			onClose={cancel}
			footer={
				<>
					<button type="button" onClick={cancel} disabled={sending}>
						계속 편집
					</button>
					<button
						type="button"
						className="primary"
						onClick={onConfirm}
						disabled={sending}
					>
						{sending ? "요청 중…" : "승인 요청"}
					</button>
				</>
			}
		>
			<p className="str-submit-warning">
				<strong>승인 요청을 누르면 보고서를 편집할 수 없어요.</strong> 승인자가 보완을
				요청하면 다시 고칠 수 있어요.
			</p>
			<dl className="str-submit-summary">
				<div>
					<dt>보낼 본문</dt>
					<dd>
						{/* 검증 번호(VRF-…)는 보여 주지 않아요 — 요청엔 그대로 실어 보내요(S6 verification_id) */}
						{revisionLabel(draft.currentRevisionNo)} · 검증 통과
					</dd>
				</div>
				<div>
					<dt>의심 유형</dt>
					<dd>{types.map(suspicionTypeLabel).join(", ")}</dd>
				</div>
				<div>
					<dt>지점 의심 정도</dt>
					<dd>{level}</dd>
				</div>
			</dl>
			<button
				type="button"
				className="str-link-button"
				onClick={() => setStep("pick")}
				disabled={sending}
			>
				← 유형·정도 다시 고르기
			</button>
			{command.isError && <p role="alert">{getErrorMessage(command.error)}</p>}
		</Modal>
	)
}
