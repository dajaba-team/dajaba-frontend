import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { approvalsApi } from "../api/approvalsApi"
import { caseKey } from "../../cases/hooks/useCases"
import { draftKey } from "../../str/hooks/useStrDraft"
import { getErrorCode, isNoResponse } from "../../../shared/api/apiClient"

export const approvalsKey = (page) => ["approvals", page]

export function useApprovals(page) {
	return useQuery({
		queryKey: approvalsKey(page),
		queryFn: ({ signal }) => approvalsApi.list({ page }, signal),
	})
}

// 다른 승인자가 먼저 처리했거나 그사이 바뀐 경우 — 목록을 다시 불러 최신 줄·버튼을 보여 줘요. 입력은 확인창이 들고 있어요.
const REFETCH_ON = [
	"CONCURRENT_UPDATE",
	"INVALID_CASE_TRANSITION",
	"DRAFT_SUPERSEDED",
	"DRAFT_NOT_VERIFIED",
	"SELF_APPROVAL",
]

/**
 * 승인함 작업 — name: approve(P2)·reject(P3). 응답이 공통 변경 응답이라 성공 뒤 승인함·케이스·초안을 다시 불러요.
 * 낙관적 변경·자동 재시도 없음. 응답이 없으면(timeout·네트워크) 처리됐을 수 있으니 목록을 먼저 다시 읽어요.
 */
export function useApprovalCommand(item, name) {
	const client = useQueryClient()
	const refresh = () =>
		Promise.all([
			client.invalidateQueries({ queryKey: ["approvals"] }),
			client.invalidateQueries({ queryKey: caseKey(item.caseNo) }),
			client.invalidateQueries({ queryKey: ["cases"] }),
			client.invalidateQueries({ queryKey: draftKey(item.draftNo) }),
		])
	return useMutation({
		mutationFn: (input) =>
			approvalsApi[name]({ draftNo: item.draftNo, caseVersion: item.caseVersion, ...input }),
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
