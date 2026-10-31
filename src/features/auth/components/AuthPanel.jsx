import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession, sessionKey } from "../hooks/useSession"
import { clearBusinessData } from "../../../app/queryClient"
import { authApi } from "../api/authApi"
import { getErrorMessage } from "../../../shared/api/apiClient"

export default function AuthPanel() {
	const [loginId, setLoginId] = useState("inv01")
	const queryClient = useQueryClient()
	const me = useSession()
	const [switching, setSwitching] = useState(false)
	const login = useMutation({
		mutationFn: authApi.mockLogin,
		onMutate: async () => {
			setSwitching(true)
			await queryClient.cancelQueries({ queryKey: sessionKey })
			queryClient.setQueryData(sessionKey, null)
			await clearBusinessData(queryClient)
		},
		onSuccess: async () => {
			// 로그인 응답만 신뢰하지 않고 me로 사용자와 CSRF 쿠키를 다시 확인합니다.
			await queryClient.fetchQuery({
				queryKey: sessionKey,
				queryFn: authApi.me,
				staleTime: 0,
			})
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

	return (
		<section className="auth-panel" aria-label="백엔드 로그인">
			<p role="status">
				{me.isPending
					? "로그인 상태 확인 중…"
					: me.data
						? `${me.data.displayName} (${me.data.loginId}) · ${me.data.role}`
						: me.data === null
							? "로그인이 필요합니다."
							: "로그인 상태를 확인하지 못했습니다."}
			</p>
			<button type="button" disabled={me.isFetching || busy} onClick={() => me.refetch()}>
				현재 사용자 확인
			</button>
			{me.data && (
				<button
					type="button"
					disabled={busy || me.isFetching}
					onClick={() => logout.mutate()}
				>
					{logout.isPending ? "로그아웃 중…" : "로그아웃"}
				</button>
			)}
			{import.meta.env.DEV && (
				<form
					onSubmit={(event) => {
						event.preventDefault()
						login.mutate(loginId)
					}}
				>
					<label htmlFor="mock-login-id">로컬 테스트 계정</label>
					<select
						id="mock-login-id"
						value={loginId}
						disabled={busy}
						onChange={(event) => setLoginId(event.target.value)}
					>
						{["inv01", "inv02", "apr01", "admin"].map((id) => (
							<option key={id} value={id}>
								{id}
							</option>
						))}
					</select>
					<button type="submit" disabled={busy || me.isFetching}>
						{login.isPending ? "로그인 중…" : "테스트 로그인"}
					</button>
					<small>백엔드 local 프로파일 전용</small>
				</form>
			)}
			{logout.isError && <p role="alert">{getErrorMessage(logout.error)}</p>}
			{login.isError && <p role="alert">{getErrorMessage(login.error)}</p>}
		</section>
	)
}
