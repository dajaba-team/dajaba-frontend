import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession, sessionKey } from "../hooks/useSession"
import { clearBusinessData, sessionEndedKey } from "../../../app/queryClient"
import { authApi } from "../api/authApi"
import { getErrorMessage } from "../../../shared/api/apiClient"
import Icon from "../../../shared/ui/dashboard/Icon"
import brandMark from "../../../assets/brand-mark.png"

const ROLE_LABELS = { INVESTIGATOR: "조사역", APPROVER: "승인자", ADMIN: "운영 관리자" }

// 로그인 뒤에는 위 띠(placement="header")에 프로필 칩으로, 로그인 전에는 본문 가운데 로그인 카드로 보여요.
// 두 자리 모두 늘 마운트해 두고 한쪽만 그려서, 로그인·로그아웃 순간에 컴포넌트가 다시 만들어지지 않게 해요.
export default function AuthPanel({ placement = "main" }) {
	const [loginId, setLoginId] = useState("")
	const [password, setPassword] = useState("")
	// 비밀번호 보기 — 비밀번호가 지워지면(로그인 성공·실패) 다시 숨겨요(SCRUM-345)
	const [showPassword, setShowPassword] = useState(false)
	const queryClient = useQueryClient()
	const me = useSession()
	// 캐시에만 두는 표시라 queryFn 없이 읽습니다. 로그인에 성공하면 지웁니다.
	const sessionEnded = useQuery({
		queryKey: sessionEndedKey,
		queryFn: () => false,
		enabled: false,
		initialData: false,
	}).data
	const [switching, setSwitching] = useState(false)
	const login = useMutation({
		mutationFn: authApi.login,
		onMutate: async () => {
			setSwitching(true)
			await queryClient.cancelQueries({ queryKey: sessionKey })
			queryClient.setQueryData(sessionKey, null)
			await clearBusinessData(queryClient)
		},
		onSuccess: async () => {
			setPassword("")
			setShowPassword(false)
			queryClient.setQueryData(sessionEndedKey, false)
			// 로그인 응답만 신뢰하지 않고 me로 사용자와 바뀐 CSRF 쿠키를 다시 확인합니다.
			await queryClient.fetchQuery({
				queryKey: sessionKey,
				queryFn: authApi.me,
				staleTime: 0,
			})
		},
		onError: () => {
			setPassword("")
			setShowPassword(false)
		},
		onSettled: () => setSwitching(false),
	})
	const logout = useMutation({
		mutationFn: authApi.logout,
		onSuccess: async () => {
			await queryClient.cancelQueries({ queryKey: sessionKey })
			queryClient.setQueryData(sessionKey, null)
			await clearBusinessData(queryClient)
		},
	})
	const busy = switching || login.isPending || logout.isPending
	if ((placement === "header") !== Boolean(me.data)) return null
	// 위 띠: 역할 칩(시안 "조사역 A · inv01 ⌄")을 누르면 로그인 정보·현재 사용자 확인·로그아웃이 펼쳐져요.
	if (placement === "header")
		return (
			<details className="persona">
				<summary>
					<Icon name="user" size={16} />
					<span>
						{ROLE_LABELS[me.data.role] ?? me.data.role} · {me.data.loginId}
					</span>
					<Icon name="chevron" size={16} />
				</summary>
				<section className="persona-menu" aria-label="로그인">
					<p role="status" className="auth-identity">
						{`${me.data.displayName} (${me.data.loginId}) · ${me.data.role}`}
					</p>
					<button
						type="button"
						disabled={me.isFetching || busy}
						onClick={() => me.refetch()}
					>
						현재 사용자 확인
					</button>
					<button
						type="button"
						className="is-logout"
						disabled={busy || me.isFetching}
						onClick={() => logout.mutate()}
					>
						{logout.isPending ? "로그아웃 중…" : "로그아웃"}
					</button>
				</section>
			</details>
		)

	return (
		<section className="auth-panel" aria-label="로그인">
			{me.data === null && !sessionEnded && (
				<header className="auth-heading">
					<img className="auth-brand-mark" src={brandMark} alt="" />
					<h2>DAJABA</h2>
					<p>AI 기반 자금세탁방지 업무 시스템</p>
				</header>
			)}
			<p role="status" className="auth-identity">
				{me.isPending
					? "로그인 상태 확인 중…"
					: me.data === null
						? "로그인이 필요합니다."
						: "로그인 상태를 확인하지 못했습니다."}
			</p>
			{me.isError && !me.data && (
				// 401이 아닌 실패(네트워크·500)는 로그인 여부를 모르는 상태 — 다시 확인할 길을 줘요(SCRUM-173).
				<div className="auth-error">
					<p role="alert">{getErrorMessage(me.error)}</p>
					<button type="button" disabled={me.isFetching} onClick={() => me.refetch()}>
						{me.isFetching ? "확인 중…" : "다시 확인"}
					</button>
				</div>
			)}
			{me.data === null && (
				<form
					className="login-form"
					onSubmit={(event) => {
						event.preventDefault()
						login.mutate({ loginId: loginId.trim(), password })
					}}
				>
					{sessionEnded && (
						<p role="alert">
							다른 곳에서 같은 계정으로 로그인했거나 세션이 끝났어요. 다시 로그인해
							주세요.
						</p>
					)}
					<label htmlFor="login-id">아이디</label>
					<input
						id="login-id"
						name="username"
						autoComplete="username"
						required
						maxLength={64}
						value={loginId}
						disabled={busy}
						onChange={(event) => setLoginId(event.target.value)}
					/>
					<label htmlFor="login-password">비밀번호</label>
					<div className="password-field">
						<input
							id="login-password"
							name="password"
							type={showPassword ? "text" : "password"}
							autoComplete="current-password"
							required
							maxLength={128}
							value={password}
							disabled={busy}
							onChange={(event) => setPassword(event.target.value)}
						/>
						<button
							type="button"
							className="password-toggle"
							aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
							aria-pressed={showPassword}
							disabled={busy}
							onClick={() => setShowPassword((shown) => !shown)}
						>
							<Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
						</button>
					</div>
					<button type="submit" disabled={busy || me.isFetching}>
						{login.isPending ? "로그인 중…" : "로그인"}
					</button>
				</form>
			)}
			{logout.isError && <p role="alert">{getErrorMessage(logout.error)}</p>}
			{login.isError && <p role="alert">{getErrorMessage(login.error)}</p>}
		</section>
	)
}
