import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { questionsApi } from "../api/questionsApi"
import { caseKey } from "./useCases"
import { isNoResponse } from "../../../shared/api/apiClient"

// 지난 질문은 케이스 키 아래 — 케이스 작업 뒤 상세와 같이 다시 불러도 돼요(조회만).
export const questionsKey = (caseNo) => [...caseKey(caseNo), "questions"]

/** C9 지난 질문. 패널이 열려 있을 때만 불러요. */
export function useCaseQuestions(caseNo, page, enabled = true) {
	return useQuery({
		queryKey: [...questionsKey(caseNo), page],
		queryFn: ({ signal }) => questionsApi.list({ caseNo, page }, signal),
		enabled: Boolean(caseNo) && enabled,
	})
}

/**
 * A8 질문하기. 자동 재시도 없음(queryClient 기본값). 성공하면 지난 질문을 다시 불러 맨 위에 새 카드가 와요.
 * 응답 없이 끊기면 저장됐을 수 있어서 지난 질문을 다시 불러요(계약서 2.6) — 저장됐는지 판단은 패널이 해요.
 */
export function useAskQuestion(caseNo) {
	const client = useQueryClient()
	const refresh = () => client.invalidateQueries({ queryKey: questionsKey(caseNo) })
	return useMutation({
		mutationFn: ({ question }) => questionsApi.ask({ caseNo, question }),
		// 로그아웃 이후 도착한 응답으로 업무 캐시를 다시 채우지 않습니다.
		onMutate: () => ({ session: client.getQueryData(["auth", "me"]) }),
		onSuccess: async (_result, _input, context) => {
			if (context.session !== client.getQueryData(["auth", "me"])) return
			await refresh()
		},
		onError: async (error, _input, context) => {
			if (context?.session !== client.getQueryData(["auth", "me"])) return
			if (isNoResponse(error)) await refresh()
		},
	})
}
