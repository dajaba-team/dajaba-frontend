import { useId, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import ConfirmDialog from "../../../shared/ui/ConfirmDialog"
import { getErrorCode, getErrorMessage } from "../../../shared/api/apiClient"
import { adminUsersApi } from "../../admin/users/api/adminUsersApi"
import { useCaseCommand } from "../hooks/useCases"

const COMMENT_MAX = 2000

// 담당자 변경 확인창 — 계약서 A2 `POST /cases/{case_no}/reassign {assignee, comment?, version}`, ADMIN만.
// 고를 수 있는 사람은 활성 조사역 목록(BE GET /admin/users)에서 지금 담당을 뺀 사람이에요.
// 그사이 비활성이 됐으면 서버가 409 INVALID_ASSIGNEE — 목록을 다시 불러요.
// 대상이 그사이 비활성·조사역 아님이 되면 목록을 다시 불러오니 그 뜻을 같이 알려요.
function errorText(error) {
	return getErrorCode(error) === "INVALID_ASSIGNEE"
		? "활성 조사역에게만 맡길 수 있어요. 조사역 목록을 다시 불러왔어요."
		: getErrorMessage(error)
}

export default function ReassignDialog({ caseNo, version, assignee, onClose }) {
	const selectId = useId()
	const commentId = useId()
	const [target, setTarget] = useState("")
	const [comment, setComment] = useState("")
	const investigators = useQuery({
		queryKey: ["admin", "users", "active-investigators"],
		queryFn: ({ signal }) => adminUsersApi.activeInvestigators(signal),
	})
	const command = useCaseCommand(caseNo, "reassign")
	const choices = (investigators.data ?? []).filter((user) => user.loginId !== assignee?.loginId)
	const submit = () => {
		if (!target || command.isPending) return
		command.mutate(
			{ version, assignee: target, comment: comment.trim() || undefined },
			{
				onSuccess: onClose,
				onError: (error) => {
					if (["INVALID_ASSIGNEE", "USER_NOT_FOUND"].includes(getErrorCode(error))) {
						setTarget("")
						void investigators.refetch()
					}
				},
			},
		)
	}
	return (
		<ConfirmDialog
			title="담당자 변경"
			confirmLabel="변경"
			confirmDisabled={!target}
			confirming={command.isPending}
			error={command.isError ? errorText(command.error) : null}
			onConfirm={submit}
			onCancel={onClose}
			body={
				<>
					<p>
						{caseNo} · 지금 담당 {assignee?.displayName ?? "미배정"}. 상태는 그대로이고
						담당만 바뀌어요.
					</p>
					{investigators.isPending && <p>조사역 목록을 불러오는 중…</p>}
					{investigators.isError && (
						<p role="alert">{getErrorMessage(investigators.error)}</p>
					)}
					{investigators.isSuccess && (
						<div className="case-field">
							<label htmlFor={selectId}>새 담당 조사역</label>
							<select
								id={selectId}
								value={target}
								onChange={(event) => setTarget(event.target.value)}
							>
								<option value="">선택</option>
								{choices.map((user) => (
									<option key={user.loginId} value={user.loginId}>
										{user.displayName} ({user.loginId})
									</option>
								))}
							</select>
							{!choices.length && <p>바꿀 수 있는 활성 조사역이 없어요.</p>}
						</div>
					)}
					<div className="case-field">
						<label htmlFor={commentId}>변경 사유 (선택)</label>
						<textarea
							id={commentId}
							value={comment}
							maxLength={COMMENT_MAX}
							onChange={(event) => setComment(event.target.value)}
						/>
					</div>
				</>
			}
		/>
	)
}
