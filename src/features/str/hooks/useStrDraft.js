import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { strApi } from "../api/strApi"
import { caseKey } from "../../cases/hooks/useCases"
import { getErrorCode, isNoResponse } from "../../../shared/api/apiClient"

export const draftKey = (draftNo) => ["draft", draftNo]

export function useStrDraft(draftNo) {
	return useQuery({
		queryKey: draftKey(draftNo),
		queryFn: ({ signal }) => strApi.getDraft(draftNo, signal),
		enabled: Boolean(draftNo),
	})
}

// 제한 응답(contentVisible=false)을 받은 화면은 enabled=false로 넘겨 이력을 부르지 않아요.
export function useStrRevisions(draftNo, { enabled = true } = {}) {
	return useQuery({
		queryKey: [...draftKey(draftNo), "revisions"],
		queryFn: ({ signal }) => strApi.getRevisions(draftNo, signal),
		enabled: Boolean(draftNo) && enabled,
	})
}

export function useStrRevision(draftNo, revisionNo, { enabled = true } = {}) {
	return useQuery({
		queryKey: [...draftKey(draftNo), "revisions", revisionNo],
		queryFn: ({ signal }) => strApi.getRevision(draftNo, revisionNo, signal),
		enabled: Boolean(draftNo) && revisionNo != null && enabled,
	})
}

// 서버 상태가 화면과 달라 생기는 오류 — 케이스·초안을 다시 읽어 최신 버튼·본문을 보여 줘요. 입력은 화면이 들고 있어요.
const REFETCH_ON = [
	"CONCURRENT_UPDATE",
	"INVALID_CASE_TRANSITION",
	"NOT_ASSIGNEE",
	"DRAFT_IN_PROGRESS",
	"DRAFT_LOCKED",
	"DRAFT_SUPERSEDED",
	"DRAFT_REQUEST_CLOSED",
]

/**
 * STR 변경 작업 — name: createDraft(S1)·saveRevision(S3).
 * 성공하면 케이스·초안을 다시 읽어요(응답이 상세 전체가 아니라서). 낙관적 변경·자동 재시도 없음.
 * 응답이 없으면(timeout·네트워크) 성공했는지 모르니 최신 상태를 먼저 읽어요 — 같은 초안이 두 번 생기지 않게(BE 미결 21).
 */
export function useStrCommand(caseNo, draftNo, name) {
	const client = useQueryClient()
	const refresh = () =>
		Promise.all([
			client.invalidateQueries({ queryKey: caseKey(caseNo) }),
			client.invalidateQueries({ queryKey: ["cases"] }),
			draftNo ? client.invalidateQueries({ queryKey: draftKey(draftNo) }) : null,
		])
	return useMutation({
		mutationFn: (input) => strApi[name]({ caseNo, draftNo, ...input }),
		// 로그아웃 이후 도착한 응답으로 업무 캐시를 다시 채우지 않아요(useCaseCommand와 같은 방식).
		onMutate: () => ({ session: client.getQueryData(["auth", "me"]) }),
		onSuccess: async (_result, _input, context) => {
			if (context.session !== client.getQueryData(["auth", "me"])) return
			await refresh()
		},
		onError: (error, _input, context) => {
			if (context?.session !== client.getQueryData(["auth", "me"])) return
			if (isNoResponse(error) || REFETCH_ON.includes(getErrorCode(error))) void refresh()
		},
	})
}
