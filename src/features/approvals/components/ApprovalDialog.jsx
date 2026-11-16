import { useId, useState } from "react"
import { useNavigate } from "react-router"
import ConfirmDialog from "../../../shared/ui/ConfirmDialog"
import { getErrorMessage } from "../../../shared/api/apiClient"
import { SUSPICION_LEVELS, SUSPICION_LEVEL_HINT } from "../../../shared/str/suspicionTypes"
import { REJECTION_LABELS } from "../../cases/labels"
import { useApprovalCommand } from "../hooks/useApprovals"

const COMMENT_MAX = 2000

// 반려 두 갈래(SCRUM-113) — API는 같고 reason_code만 달라요. 어느 쪽이냐에 따라 조사역의 다음 행동이 달라요.
const REJECT_TEXT = {
	NEED_REVISION: "조사역이 같은 초안을 고치거나 다시 생성해 다시 올릴 수 있어요.",
	NOT_REPORTABLE: "조사역은 이 케이스를 사유를 남겨 종료만 할 수 있어요.",
}

/**
 * 승인(P2)·반려(P3) 확인창. mode: "APPROVE" | "NEED_REVISION" | "NOT_REPORTABLE".
 * 승인은 본점 의심 정도 1~5(기본값 없음), 반려는 사유 1~2,000자가 필수 — 화면에서 먼저 막고 서버 400도 같은 자리에 보여요.
 * 실패해도 입력은 지우지 않아요(01_code_rules §1). 그사이 다른 사람이 처리했으면 목록을 다시 불러요(useApprovalCommand).
 * 승인에 성공하면 승인 완료 화면(`/approvals/:draftNo`, SCRUM-111)으로 가요 — 모의 제출이 이어지는 일이라서.
 */
export default function ApprovalDialog({ item, mode, onClose }) {
	const levelName = useId()
	const commentId = useId()
	const approving = mode === "APPROVE"
	const navigate = useNavigate()
	const command = useApprovalCommand(item, approving ? "approve" : "reject")
	const [level, setLevel] = useState(null)
	const [comment, setComment] = useState("")
	const ready = approving ? level != null : comment.trim().length > 0
	const submit = () => {
		if (!ready || command.isPending) return
		const input = approving
			? { suspicionLevelHq: level }
			: { reasonCode: mode, comment: comment.trim() }
		command.mutate(input, {
			onSuccess: () => {
				onClose()
				if (approving) navigate(`/approvals/${encodeURIComponent(item.draftNo)}`)
			},
		})
	}
	const title = approving ? "STR 승인" : `반려 — ${REJECTION_LABELS[mode]}`
	return (
		<ConfirmDialog
			title={title}
			confirmLabel={approving ? "승인" : REJECTION_LABELS[mode]}
			confirmDisabled={!ready}
			confirming={command.isPending}
			error={command.isError ? getErrorMessage(command.error) : null}
			onConfirm={submit}
			onCancel={onClose}
			body={
				<>
					<p>
						{item.draftNo} · {item.caseNo} · 담당 {item.assignee?.displayName ?? "-"}
					</p>
					{approving ? (
						<>
							<p>승인하면 초안이 잠겨 더는 고칠 수 없어요.</p>
							<fieldset className="approval-levels">
								<legend>본점 의심 정도 *</legend>
								<p className="approval-muted">
									{SUSPICION_LEVEL_HINT} · 기본값 없음
								</p>
								{SUSPICION_LEVELS.map((value) => (
									<label key={value}>
										<input
											type="radio"
											name={levelName}
											value={value}
											checked={level === value}
											onChange={() => setLevel(value)}
										/>{" "}
										{value}
									</label>
								))}
							</fieldset>
						</>
					) : (
						<>
							<p>{REJECT_TEXT[mode]}</p>
							<div className="case-field">
								<label htmlFor={commentId}>반려 사유 *</label>
								<textarea
									id={commentId}
									value={comment}
									maxLength={COMMENT_MAX}
									onChange={(event) => setComment(event.target.value)}
								/>
								<p className="approval-muted">
									{comment.length.toLocaleString()} /{" "}
									{COMMENT_MAX.toLocaleString()}자
								</p>
							</div>
						</>
					)}
				</>
			}
		/>
	)
}
