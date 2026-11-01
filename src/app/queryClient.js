import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { getErrorCode } from "../shared/api/apiClient"

// 로그인돼 있던 세션이 401로 끊겼다는 표시입니다. 같은 계정의 다른 곳 로그인(maximumSessions 1)·만료가 여기로 옵니다.
export const sessionEndedKey = ["auth", "sessionEnded"]

export function isBusinessQuery(query) {
	return query.queryKey[0] !== "auth"
}

export async function clearBusinessData(client) {
	// 진행 중 조회도 취소해야 이전 계정의 늦은 응답이 새 캐시를 채우지 않습니다.
	const cancellation = client.cancelQueries({ predicate: isBusinessQuery })
	client.removeQueries({ predicate: isBusinessQuery })
	client.getMutationCache().clear()
	await cancellation
}

export function createQueryClient() {
	let client
	let previousLoginId
	const handleError = (error) => {
		if (error.response?.status !== 401) return
		// 로그인 실패는 세션이 끊긴 것이 아니라 입력이 틀린 것이므로 여기서 다루지 않습니다.
		if (getErrorCode(error) === "LOGIN_FAILED") return
		if (client.getQueryData(["auth", "me"])) client.setQueryData(sessionEndedKey, true)
		// null은 확인된 비로그인 상태입니다. 업무 화면을 내려 미저장 민감정보도 제거하고 로그인 폼을 보여 줍니다.
		client.setQueryData(["auth", "me"], null)
		void clearBusinessData(client)
	}
	client = new QueryClient({
		queryCache: new QueryCache({
			onError: handleError,
			onSuccess: (data, query) => {
				if (query.queryKey[0] !== "auth" || query.queryKey[1] !== "me") return
				const nextLoginId = data?.loginId
				// me도 외부 로그아웃·세션 교체를 발견할 수 있으므로 버튼 외의 경로도 정리합니다.
				if (!data || (previousLoginId && previousLoginId !== nextLoginId)) {
					void clearBusinessData(client)
				}
				previousLoginId = nextLoginId
			},
		}),
		mutationCache: new MutationCache({
			onError: (error, _variables, context) => {
				// 이전 계정의 늦은 실패가 새 로그인 세션까지 만료시키지 않게 합니다.
				if (context?.session && context.session !== client.getQueryData(["auth", "me"]))
					return
				handleError(error)
			},
		}),
		defaultOptions: {
			queries: { staleTime: 30_000, retry: false },
			// 응답 유실 때도 서버는 저장했을 수 있으므로 쓰기를 자동 반복하지 않습니다.
			mutations: { retry: false },
		},
	})
	// me 조회(수동 기록 제외)가 로그인 상태에서 비로그인으로 바뀌면 다른 곳 로그인·만료로 끊긴 것입니다.
	// 로그아웃 버튼·로그인 전환은 setQueryData(수동 기록)라 여기서 걸리지 않습니다.
	let lastUser = null
	client.getQueryCache().subscribe((event) => {
		if (event.type !== "updated" || event.action.type !== "success") return
		if (event.query.queryKey[0] !== "auth" || event.query.queryKey[1] !== "me") return
		const user = event.query.state.data
		if (!event.action.manual && !user && lastUser) client.setQueryData(sessionEndedKey, true)
		lastUser = user
	})
	return client
}
