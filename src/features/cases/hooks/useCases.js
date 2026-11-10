import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { casesApi } from "../api/casesApi"
import { getErrorCode } from "../../../shared/api/apiClient"

export const caseKey = (caseNo) => ["case", caseNo]

export function useCases(params) {
	return useQuery({
		queryKey: ["cases", params],
		queryFn: ({ signal }) => casesApi.list(params, signal),
	})
}

export function useCaseDetail(caseNo) {
	return useQuery({
		queryKey: caseKey(caseNo),
		queryFn: ({ signal }) => casesApi.detail(caseNo, signal),
		enabled: Boolean(caseNo),
	})
}

/** 메모 이력(C8). 키가 caseKey 아래라 메모 저장 뒤 상세와 같이 다시 불러요. */
export function useCaseNoteHistories(caseNo, page) {
	return useQuery({
		queryKey: [...caseKey(caseNo), "note-histories", page],
		queryFn: ({ signal }) => casesApi.noteHistories({ caseNo, page }, signal),
		enabled: Boolean(caseNo),
	})
}

// 서버 상태가 화면과 달라서 생기는 오류 — 상세를 다시 불러 최신 버튼을 보여 줘요(계약서 3절).
const REFETCH_ON = [
	"CONCURRENT_UPDATE",
	"INVALID_CASE_TRANSITION",
	"NOT_ASSIGNEE",
	"CLOSE_REQUIRES_STR",
]

/**
 * 케이스 상태 작업(assign·escalate·close·closeWithDraft·saveNotes). 응답은 공통 변경 응답 M이라 성공 뒤 상세·목록을 다시 불러요.
 * 낙관적 변경 없음, 자동 재시도 없음(queryClient 기본값).
 */
export function useCaseCommand(caseNo, name) {
	const client = useQueryClient()
	const refresh = () =>
		Promise.all([
			client.invalidateQueries({ queryKey: caseKey(caseNo) }),
			client.invalidateQueries({ queryKey: ["cases"] }),
		])
	return useMutation({
		mutationFn: (input) => casesApi[name]({ caseNo, ...input }),
		// 로그아웃 이후 도착한 응답으로 업무 캐시를 다시 채우지 않습니다.
		onMutate: () => ({ session: client.getQueryData(["auth", "me"]) }),
		onSuccess: async (_result, _input, context) => {
			if (context.session !== client.getQueryData(["auth", "me"])) return
			await refresh()
		},
		onError: (error, _input, context) => {
			if (context?.session !== client.getQueryData(["auth", "me"])) return
			if (REFETCH_ON.includes(getErrorCode(error))) void refresh()
		},
	})
}
