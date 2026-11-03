import { useQuery } from "@tanstack/react-query"
import { strApi } from "../api/strApi"

export const draftKey = (draftId) => ["draft", draftId]

export function useStrDraft(draftId) {
	return useQuery({
		queryKey: draftKey(draftId),
		queryFn: ({ signal }) => strApi.getDraft(draftId, signal),
		enabled: Boolean(draftId),
	})
}

// 제한 응답(contentVisible=false)을 받은 화면은 enabled=false로 넘겨 이력을 부르지 않아요.
export function useStrRevisions(draftId, { enabled = true } = {}) {
	return useQuery({
		queryKey: [...draftKey(draftId), "revisions"],
		queryFn: ({ signal }) => strApi.getRevisions(draftId, signal),
		enabled: Boolean(draftId) && enabled,
	})
}

export function useStrRevision(draftId, revisionNo, { enabled = true } = {}) {
	return useQuery({
		queryKey: [...draftKey(draftId), "revisions", revisionNo],
		queryFn: ({ signal }) => strApi.getRevision(draftId, revisionNo, signal),
		enabled: Boolean(draftId) && revisionNo != null && enabled,
	})
}
