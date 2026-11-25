import { useId, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import ActionDialog from "../../../shared/ui/ActionDialog"
import { getErrorCode, getErrorMessage } from "../../../shared/api/apiClient"
import { adminUsersApi } from "../../admin/users/api/adminUsersApi"
import { useCaseCommand } from "../hooks/useCases"
import Spinner from "../../../shared/ui/Spinner"

const COMMENT_MAX = 2000
const ASSIGNEE_ERRORS = ["INVALID_ASSIGNEE", "USER_NOT_FOUND"]

// 담당자 배정·변경 확인창(SCRUM-428) — 아이디를 치지 않고 활성 조사역 목록(BE GET /admin/users)에서 골라요. ADMIN만.
// assign: 계약서 A1 `POST /cases/{case_no}/assign {assignee, version}` — 미배정 케이스
// reassign: 계약서 A2 `POST /cases/{case_no}/reassign {assignee, comment?, version}` — 지금 담당은 목록에서 빼요
// 그사이 대상이 비활성·조사역 아님이 되면 서버가 409 INVALID_ASSIGNEE — 고른 값을 비우고 목록을 다시 불러요.
const TEXT = {
	assign: { title: "담당자 배정", submit: "배정", field: "배정할 조사역" },
	reassign: { title: "담당자 변경", submit: "변경", field: "새 담당 조사역" },
}

function errorText(error) {
	return getErrorCode(error) === "INVALID_ASSIGNEE"
		? "활성 조사역에게만 맡길 수 있어요. 조사역 목록을 다시 불러왔어요."
		: getErrorMessage(error)
}

export default function AssigneeDialog({ mode, caseNo, version, assignee, onClose }) {
	const text = TEXT[mode]
	const selectId = useId()
	const commentId = useId()
	const [target, setTarget] = useState("")
	const [comment, setComment] = useState("")
	const investigators = useQuery({
		queryKey: ["admin", "users", "active-investigators"],
		queryFn: ({ signal }) => adminUsersApi.activeInvestigators(signal),
	})
	const command = useCaseCommand(caseNo, mode)
	const choices = (investigators.data ?? []).filter((user) => user.loginId !== assignee?.loginId)
	const submit = () =>
		command.mutate(
			mode === "assign"
				? { version, assignee: target }
				: { version, assignee: target, comment: comment.trim() || undefined },
			{
				onSuccess: onClose,
				onError: (error) => {
					if (ASSIGNEE_ERRORS.includes(getErrorCode(error))) {
						setTarget("")
						void investigators.refetch()
					}
				},
			},
		)
	return (
		<ActionDialog
			title={text.title}
			submitLabel={text.submit}
			pending={command.isPending}
			canSubmit={Boolean(target)}
			error={command.isError ? errorText(command.error) : null}
			onSubmit={submit}
			onClose={onClose}
		>
			<p>
				{mode === "assign"
					? `${caseNo}을 맡을 조사역을 골라요. 배정하면 조사 중으로 바뀌어요.`
					: `${caseNo} · 지금 담당 ${assignee?.displayName ?? "미배정"}. 상태는 그대로이고 담당만 바뀌어요.`}
			</p>
			{investigators.isPending && <Spinner size="sm" label="조사역 목록을 불러오는 중" />}
			{investigators.isError && <p role="alert">{getErrorMessage(investigators.error)}</p>}
			{investigators.isSuccess && (
				<div className="case-field">
					<label htmlFor={selectId}>{text.field}</label>
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
					{!choices.length && <p>고를 수 있는 활성 조사역이 없어요.</p>}
				</div>
			)}
			{mode === "reassign" && (
				<div className="case-field">
					<label htmlFor={commentId}>변경 사유 (선택)</label>
					<textarea
						id={commentId}
						value={comment}
						maxLength={COMMENT_MAX}
						onChange={(event) => setComment(event.target.value)}
					/>
				</div>
			)}
		</ActionDialog>
	)
}
