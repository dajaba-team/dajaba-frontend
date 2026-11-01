import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession, sessionKey } from "../hooks/useSession"
import { clearBusinessData, sessionEndedKey } from "../../../app/queryClient"
import { authApi } from "../api/authApi"
import { getErrorMessage } from "../../../shared/api/apiClient"

const usingMocks = import.meta.env.VITE_USE_MOCKS === "true"

export default function AuthPanel() {
	const [loginId, setLoginId] = useState("")
	const [password, setPassword] = useState("")
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
			queryClient.setQueryData(sessionEndedKey, false)
			// 로그인 응답만 신뢰하지 않고 me로 사용자와 바뀐 CSRF 쿠키를 다시 확인합니다.
			await queryClient.fetchQuery({
				queryKey: sessionKey,
				queryFn: authApi.me,
				staleTime: 0,
			})
		},
		onError: () => setPassword(""),
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

	return (
		<section className="auth-panel" aria-label="로그인">
			<p role="status">
				{me.isPending
					? "로그인 상태 확인 중…"
					: me.data
						? `${me.data.displayName} (${me.data.loginId}) · ${me.data.role}`
						: me.data === null
							? "로그인이 필요합니다."
							: "로그인 상태를 확인하지 못했습니다."}
			</p>
			{me.data && (
				<>
					<button
						type="button"
						disabled={me.isFetching || busy}
						onClick={() => me.refetch()}
					>
						현재 사용자 확인
					</button>
					<button
						type="button"
						disabled={busy || me.isFetching}
						onClick={() => logout.mutate()}
					>
						{logout.isPending ? "로그아웃 중…" : "로그아웃"}
					</button>
				</>
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
					<input
						id="login-password"
						name="password"
						type="password"
						autoComplete="current-password"
						required
						maxLength={128}
						value={password}
						disabled={busy}
						onChange={(event) => setPassword(event.target.value)}
					/>
					<button type="submit" disabled={busy || me.isFetching}>
						{login.isPending ? "로그인 중…" : "로그인"}
					</button>
					{import.meta.env.DEV && (
						<small>
							로컬 계정 inv01 · inv02 · apr01 · admin —{" "}
							{usingMocks
								? "MSW 비밀번호는 mock-password"
								: "비밀번호는 백엔드 .env의 DEV_USER_PASSWORD"}
						</small>
					)}
				</form>
			)}
			{logout.isError && <p role="alert">{getErrorMessage(logout.error)}</p>}
			{login.isError && <p role="alert">{getErrorMessage(login.error)}</p>}
		</section>
	)
}
