import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { casesApi } from "../api/casesApi"
import { getErrorCode, isNoResponse } from "../../../shared/api/apiClient"

export const caseKey = (caseNo) => ["case", caseNo]

export function useCases(params, { enabled = true } = {}) {
	return useQuery({
		queryKey: ["cases", params],
		queryFn: ({ signal }) => casesApi.list(params, signal),
		enabled,
		// 필터·정렬·페이지를 바꿔도 새 응답이 올 때까지 이전 목록을 보여 줘서 화면이 비었다 채워지며 깜빡이지 않게 해요.
		placeholderData: keepPreviousData,
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

/** 근거 거래(C3)·그래프(C5)·이력 전체(C6) — 조회만, 키가 caseKey 아래라 상태 변경 뒤 같이 다시 불러요. */
export function useCaseTransactions(caseNo, scope, page) {
	return useQuery({
		queryKey: [...caseKey(caseNo), "transactions", scope, page],
		queryFn: ({ signal }) => casesApi.transactions({ caseNo, scope, page }, signal),
		enabled: Boolean(caseNo),
	})
}

export function useCaseEvidence(caseNo, transactionId) {
	return useQuery({
		queryKey: [...caseKey(caseNo), "evidence", transactionId],
		queryFn: ({ signal }) => casesApi.evidence({ caseNo, transactionId }, signal),
		enabled: Boolean(caseNo) && transactionId != null,
	})
}

export function useCaseGraph(caseNo) {
	return useQuery({
		queryKey: [...caseKey(caseNo), "graph"],
		queryFn: ({ signal }) => casesApi.graph({ caseNo }, signal),
		enabled: Boolean(caseNo),
	})
}

export function useCaseHistories(caseNo, page, enabled = true) {
	return useQuery({
		queryKey: [...caseKey(caseNo), "histories", page],
		queryFn: ({ signal }) => casesApi.histories({ caseNo, page }, signal),
		enabled: Boolean(caseNo) && enabled,
	})
}

export const caseQuestionsKey = (caseNo) => [...caseKey(caseNo), "questions"]

/** 지난 질문(C9) — 질문 패널이 열려 있을 때만 불러요. 한 페이지 5개, 최신 먼저. */
export function useCaseQuestions(caseNo, page, enabled = true) {
	return useQuery({
		queryKey: [...caseQuestionsKey(caseNo), page],
		queryFn: ({ signal }) => casesApi.questions({ caseNo, page, size: 5 }, signal),
		enabled: Boolean(caseNo) && enabled,
	})
}

/**
 * 질문하기(A8). 케이스를 바꾸지 않아서 상세는 다시 부르지 않고 지난 질문(C9)만 다시 불러요.
 * 자동 재시도 없음. 응답 없이 끊겨도 서버엔 저장됐을 수 있어 C9 를 먼저 다시 불러요(계약서 2.6).
 */
export function useAskQuestion(caseNo) {
	const client = useQueryClient()
	const refresh = () => client.invalidateQueries({ queryKey: caseQuestionsKey(caseNo) })
	return useMutation({
		mutationFn: ({ question }) => casesApi.ask({ caseNo, question }),
		onMutate: () => ({ session: client.getQueryData(["auth", "me"]) }),
		onSettled: async (_data, error, _input, context) => {
			if (context?.session !== client.getQueryData(["auth", "me"])) return
			// 502·429·400 은 기록이 안 생겨요. 성공과 응답 없음만 목록이 바뀌었을 수 있어요.
			if (!error || isNoResponse(error)) await refresh()
		},
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
 * 케이스 작업(assign·reassign·escalate·close·closeWithDraft·saveNotes·refreshSummary). 응답은 공통 변경 응답 M이라 성공 뒤 상세·목록을 다시 불러요.
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
			// 응답 없이 끊긴 쓰기는 서버에서 처리됐을 수 있어 최신 상태를 먼저 읽어요(계약서 2.6, 03_api.md §4).
			if (REFETCH_ON.includes(getErrorCode(error)) || isNoResponse(error)) void refresh()
		},
	})
}
