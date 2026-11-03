import { apiClient } from "../../../shared/api/apiClient"

// 〔초안〕 STR 명세 `GET /str-drafts/{draft_id}` · `GET /str-drafts/{draft_id}/revisions`.
// 백엔드 str API가 아직 없어 MSW(`src/mocks/handlers.js`)가 같은 계약으로 답합니다.
// 본문 열람은 담당 조사역·승인자만(FR-APR-02, 권한 매트릭스 14번). 그 밖의 사용자에게 서버는
// 같은 경로에서 상태·날짜만 담은 제한 응답(`content_visible: false`)을 주고 본문 필드를 아예 빼요.
const draftPath = (draftId) => `/api/v1/str-drafts/${encodeURIComponent(draftId)}`

function toSection(data) {
	return {
		section: data.section,
		title: data.title ?? null,
		text: data.text,
		evidenceIds: data.evidence_ids ?? [],
	}
}

function toFacts(data) {
	return {
		transactionCount: data.transaction_count,
		accountCount: data.account_count,
		currency: data.currency,
		inboundTotal: data.inbound_total,
		outboundTotal: data.outbound_total,
	}
}

/**
 * 제한 응답이면 contentVisible=false이고 sections·facts·revisionNo 키 자체가 없어요.
 * 서버가 실수로 본문을 함께 보내도 화면 모델로 옮기지 않습니다.
 */
export function toDraft(data) {
	const draft = {
		draftId: data.draft_id,
		caseNo: data.case_no,
		status: data.status,
		createdAt: data.created_at,
		updatedAt: data.updated_at ?? null,
		submittedAt: data.submitted_at ?? null,
		decidedAt: data.decided_at ?? null,
		contentVisible: data.content_visible === true,
	}
	if (!draft.contentVisible) return draft
	return {
		...draft,
		version: data.version,
		revisionNo: data.revision_no ?? null,
		facts: data.facts ? toFacts(data.facts) : null,
		sections: (data.sections ?? []).map(toSection),
	}
}

function toRevision(data) {
	return {
		revisionNo: data.revision_no,
		changedSections: data.changed_sections ?? [],
		before: data.before ?? {},
		after: data.after ?? {},
		createdAt: data.created_at,
		createdBy: data.created_by ?? null,
	}
}

export const strApi = {
	getDraft: async (draftId, signal) =>
		toDraft((await apiClient.get(draftPath(draftId), { signal })).data),
	// 담당 조사역·승인자가 아니면 403 NOT_STR_VIEWER 〔제안〕. 제한 응답 없이 거절합니다.
	getRevisions: async (draftId, signal) =>
		(await apiClient.get(`${draftPath(draftId)}/revisions`, { signal })).data.items.map(
			toRevision,
		),
}
