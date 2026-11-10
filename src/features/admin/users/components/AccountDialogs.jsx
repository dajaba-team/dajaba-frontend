import { useId, useState } from "react"
import { Link } from "react-router"
import ConfirmDialog from "../../../../shared/ui/ConfirmDialog"
import { getErrorCode, getErrorMessage } from "../../../../shared/api/apiClient"
import { useToast } from "../../../../shared/ui/toast/useToast"
import { useAccountCommand } from "../useAccountCommand"
import {
	ISSUABLE_ROLES,
	ROLE_LABELS,
	ROLE_SWAP,
	displayNameError,
	loginIdError,
	passwordError,
} from "../accountRules"

// 계정 관리 확인창들 (ADM-03, 계약서 5.8). 실패는 그 확인창 안에만, 입력은 남겨요(비밀번호만 성공 뒤 비움).

function Field({ label, error, children }) {
	const id = useId()
	const errorId = useId()
	return (
		<div className="case-field">
			<label htmlFor={id}>{label}</label>
			{children({
				id,
				"aria-invalid": error ? true : undefined,
				"aria-describedby": error ? errorId : undefined,
			})}
			{error && (
				<p id={errorId} className="field-error">
					{error}
				</p>
			)}
		</div>
	)
}

// 400 details 는 요청 JSON 이름(snake_case)으로 와요(BE SCRUM-167).
const detailOf = (error, key) => error?.response?.data?.error?.details?.[key]

export function CreateAccountDialog({ onClose }) {
	const command = useAccountCommand("create")
	const { show } = useToast()
	const [form, setForm] = useState({
		loginId: "",
		displayName: "",
		role: "INVESTIGATOR",
		password: "",
	})
	const [checked, setChecked] = useState(false)
	const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
	const errors = {
		loginId:
			(checked && loginIdError(form.loginId)) ||
			(getErrorCode(command.error ?? {}) === "LOGIN_ID_TAKEN"
				? "이미 쓰는 아이디예요."
				: null) ||
			detailOf(command.error, "login_id") ||
			null,
		displayName:
			(checked && displayNameError(form.displayName)) ||
			detailOf(command.error, "display_name") ||
			null,
		password:
			(checked && passwordError(form.password)) ||
			detailOf(command.error, "initial_password") ||
			null,
	}
	const fieldFailure =
		getErrorCode(command.error ?? {}) === "LOGIN_ID_TAKEN" ||
		getErrorCode(command.error ?? {}) === "INVALID_REQUEST"
	return (
		<ConfirmDialog
			title="계정 발급"
			confirmLabel="발급"
			confirming={command.isPending}
			error={command.isError && !fieldFailure ? getErrorMessage(command.error) : null}
			onCancel={onClose}
			onConfirm={() => {
				setChecked(true)
				if (
					loginIdError(form.loginId) ||
					displayNameError(form.displayName) ||
					passwordError(form.password)
				)
					return
				command.mutate(
					{
						loginId: form.loginId,
						displayName: form.displayName.trim(),
						role: form.role,
						initialPassword: form.password,
					},
					{
						onSuccess: () => {
							show({
								tone: "info",
								text: `${form.loginId} 계정을 발급했어요. 비밀번호는 다시 보여 주지 않아요.`,
							})
							setForm({ ...form, password: "" })
							onClose()
						},
					},
				)
			}}
			body={
				<>
					<Field label="아이디" error={errors.loginId}>
						{(props) => (
							<input
								{...props}
								value={form.loginId}
								autoComplete="off"
								onChange={(event) => {
									set("loginId")(event)
									command.reset()
								}}
							/>
						)}
					</Field>
					<Field label="이름" error={errors.displayName}>
						{(props) => (
							<input
								{...props}
								value={form.displayName}
								onChange={set("displayName")}
							/>
						)}
					</Field>
					<Field label="역할">
						{(props) => (
							<select {...props} value={form.role} onChange={set("role")}>
								{ISSUABLE_ROLES.map((role) => (
									<option key={role} value={role}>
										{ROLE_LABELS[role]}
									</option>
								))}
							</select>
						)}
					</Field>
					<Field label="초기 비밀번호" error={errors.password}>
						{(props) => (
							<input
								{...props}
								type="password"
								autoComplete="new-password"
								value={form.password}
								onChange={set("password")}
							/>
						)}
					</Field>
					<p className="case-action-note">
						발급한 뒤에는 비밀번호를 다시 보여 주지 않아요. 따로 전달해 주세요.
					</p>
				</>
			}
		/>
	)
}

export function ChangeRoleDialog({ user, onClose }) {
	const command = useAccountCommand("changeRole")
	const { show } = useToast()
	const target = ROLE_SWAP[user.role]
	const busy = getErrorCode(command.error ?? {}) === "ASSIGNEE_HAS_ACTIVE_CASES"
	const count = detailOf(command.error, "active_case_count")
	return (
		<ConfirmDialog
			title="역할 변경"
			confirmLabel="변경"
			confirming={command.isPending}
			confirmDisabled={busy}
			error={command.isError && !busy ? getErrorMessage(command.error) : null}
			onCancel={onClose}
			onConfirm={() =>
				command.mutate(
					{ id: user.id, role: target },
					{
						onSuccess: () => {
							show({
								tone: "info",
								text: `${user.displayName}의 역할을 ${ROLE_LABELS[target]}(으)로 바꿨어요.`,
							})
							onClose()
						},
					},
				)
			}
			body={
				<>
					<p>
						{user.displayName}({user.loginId})의 역할을 {ROLE_LABELS[user.role]} →{" "}
						{ROLE_LABELS[target]}
						(으)로 바꿔요. 바꾸면 그 사람의 로그인이 끊겨 다시 로그인해야 해요.
					</p>
					{target === "APPROVER" && <p>이 사람이 담당했던 케이스는 승인할 수 없어요.</p>}
					{busy && (
						<div role="alert">
							<p>
								진행 중인 담당 케이스가 {count ?? user.activeCaseCount ?? "몇"}건
								있어요. 먼저 담당자를 바꿔 주세요.
							</p>
							<Link to={`/cases?assignee=${encodeURIComponent(user.loginId)}`}>
								담당 케이스 보기
							</Link>
						</div>
					)}
				</>
			}
		/>
	)
}

/** 비활성화·재활성화. 비활성화는 막지 않고, 진행 중 담당이 남았으면 끝난 뒤 페이지에 알려요(onDeactivated). */
export function ActiveToggleDialog({ user, onClose, onDeactivated }) {
	const deactivating = user.isActive
	const command = useAccountCommand(deactivating ? "deactivate" : "activate")
	const { show } = useToast()
	return (
		<ConfirmDialog
			title={deactivating ? "계정 비활성화" : "계정 재활성화"}
			confirmLabel={deactivating ? "비활성화" : "재활성화"}
			confirming={command.isPending}
			error={command.isError ? getErrorMessage(command.error) : null}
			onCancel={onClose}
			onConfirm={() =>
				command.mutate(
					{ id: user.id },
					{
						onSuccess: (updated) => {
							if (deactivating) {
								const left = updated?.activeCaseCount ?? user.activeCaseCount ?? 0
								onDeactivated({ ...user, activeCaseCount: left })
							} else {
								show({
									tone: "info",
									text: `${user.displayName} 계정을 다시 활성화했어요.`,
								})
							}
							onClose()
						},
					},
				)
			}
			body={
				deactivating ? (
					<p>
						{user.displayName}({user.loginId}) 계정을 비활성화해요. 로그인할 수 없게
						되고, 배정 대상에서도 빠져요. 계정은 지우지 않아요.
					</p>
				) : (
					<p>
						{user.displayName}({user.loginId}) 계정을 다시 활성화해요.
					</p>
				)
			}
		/>
	)
}

export function ResetPasswordDialog({ user, onClose }) {
	const command = useAccountCommand("resetPassword")
	const { show } = useToast()
	const [password, setPassword] = useState("")
	const [checked, setChecked] = useState(false)
	const error =
		(checked && passwordError(password)) || detailOf(command.error, "new_password") || null
	return (
		<ConfirmDialog
			title="비밀번호 초기화"
			confirmLabel="초기화"
			confirming={command.isPending}
			error={
				command.isError && !detailOf(command.error, "new_password")
					? getErrorMessage(command.error)
					: null
			}
			onCancel={onClose}
			onConfirm={() => {
				setChecked(true)
				if (passwordError(password)) return
				command.mutate(
					{ id: user.id, newPassword: password },
					{
						onSuccess: () => {
							setPassword("")
							show({
								tone: "info",
								text: `${user.displayName}의 비밀번호를 초기화했어요.`,
							})
							onClose()
						},
					},
				)
			}}
			body={
				<>
					<p>
						{user.displayName}({user.loginId})의 비밀번호를 새로 정해요. 다시 보여 주지
						않으니 따로 전달해 주세요.
					</p>
					<Field label="새 비밀번호" error={error}>
						{(props) => (
							<input
								{...props}
								type="password"
								autoComplete="new-password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
							/>
						)}
					</Field>
				</>
			}
		/>
	)
}
