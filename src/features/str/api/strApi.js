import { apiClient } from "../../../shared/api/apiClient"

// STR API 명세 2번 `GET /str-drafts/{draft_id}`, 4번 `GET /str-drafts/{draft_id}/revisions`.
// 백엔드 str API가 아직 없어 MSW(`src/mocks/handlers.js`)가 명세 예시 그대로 답합니다.
// 본문은 담당 조사역·승인자만 받아요. 관리자·비담당 조사역은 상태·날짜만 받는 제한 응답이에요
// (FR-APR-02, 권한 매트릭스 14번, 11/3 확정 — SCRUM-110).
const draftPath = (draftId) => `/api/v1/str-drafts/${encodeURIComponent(draftId)}`

const toSection = (data) => ({
	section: data.section,
	text: data.text,
	evidenceIds: data.evidence_ids ?? [],
})

// 명세 1번 응답 예시의 facts. 숫자는 서버(AI)가 계산한 값 그대로 보여 주고 다시 계산하지 않아요.
const toFacts = (data) => ({
	accountNoMasked: data.account_no_masked,
	windowStart: data.window_start,
	windowEnd: data.window_end,
	inboundCount: data.inbound_count,
	distinctSenders: data.distinct_senders,
	totalAmount: data.total_amount,
	currency: data.currency,
	typology: data.typology,
})

const toCheck = (data) => ({ section: data.section, result: data.result, message: data.message })

// 명세 5번 검증 응답 모양.
const toVerification = (data) => ({
	verificationId: data.verification_id,
	revisionNo: data.revision_no,
	narrativeSha256: data.narrative_sha256,
	isCurrent: data.is_current,
	passed: data.passed,
	status: data.status,
	verifierVersion: data.verifier_version,
	producedAt: data.produced_at,
	codeChecks: (data.code_checks ?? []).map(toCheck),
	llmChecks: (data.llm_checks ?? []).map(toCheck),
})

/**
 * 제한 응답이면 contentVisible=false이고 facts·narrative 등 본문 키 자체가 없어요.
 * 서버가 실수로 본문을 함께 보내도 화면 모델로 옮기지 않습니다.
 */
export function toDraft(data) {
	const meta = {
		draftId: data.draft_id,
		caseNo: data.case_no,
		status: data.status,
		caseStatus: data.case_status ?? null,
		producedAt: data.produced_at ?? null,
		// TODO(SCRUM-110): 제한 응답 구분 필드 이름은 명세에 없음 — 채영님과 확인 필요
		contentVisible: data.content_visible === true,
	}
	if (!meta.contentVisible) return meta
	return {
		...meta,
		generationId: data.generation_id,
		caseVersion: data.case_version,
		version: data.version,
		generatorVersion: data.generator_version,
		currentRevisionNo: data.current_revision_no,
		facts: data.facts ? toFacts(data.facts) : null,
		narrative: (data.narrative ?? []).map(toSection),
		latestVerification: data.latest_verification
			? toVerification(data.latest_verification)
			: null,
	}
}

const toRevisionSummary = (data) => ({
	revisionNo: data.revision_no,
	changedSections: data.changed_sections ?? [],
	editedBy: data.edited_by,
	editedAt: data.edited_at,
})

export const strApi = {
	getDraft: async (draftId, signal) =>
		toDraft((await apiClient.get(draftPath(draftId), { signal })).data),
	// 목록에는 본문이 없어요. 본문 전·후는 getRevision으로 한 행씩 받아요.
	getRevisions: async (draftId, signal) =>
		(await apiClient.get(`${draftPath(draftId)}/revisions`, { signal })).data.items.map(
			toRevisionSummary,
		),
	getRevision: async (draftId, revisionNo, signal) => {
		const { data } = await apiClient.get(`${draftPath(draftId)}/revisions`, {
			params: { revision_no: revisionNo },
			signal,
		})
		return {
			...toRevisionSummary(data),
			narrativeBefore: (data.narrative_before ?? []).map(toSection),
			narrativeAfter: (data.narrative_after ?? []).map(toSection),
		}
	},
}
