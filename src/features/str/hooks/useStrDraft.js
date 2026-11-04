import { useQuery } from "@tanstack/react-query"
import { strApi } from "../api/strApi"

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
