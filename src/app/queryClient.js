import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"

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
		// null은 확인된 비로그인 상태입니다. 업무 화면을 내려 미저장 민감정보도 제거합니다.
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
	return client
}
