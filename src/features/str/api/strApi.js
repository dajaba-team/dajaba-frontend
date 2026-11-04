import { apiClient } from "../../../shared/api/apiClient"

// STR API 명세 2번 `GET /str-drafts/{draft_no}`, 4번 `GET /str-drafts/{draft_no}/revisions`.
// 경로·응답의 번호는 `draft_no`(`DRF-` + 6자리)예요. DB 숫자 id는 밖으로 안 나와요(계약서 2.2).
// 백엔드 str API가 아직 없어 MSW(`src/mocks/handlers.js`)가 명세 예시 그대로 답합니다.
// 본문은 담당 조사역·승인자만 받아요. 관리자·비담당 조사역은 상태·날짜만 받는 제한 응답이에요
// (FR-APR-02, 권한 매트릭스 14번, 11/3 확정 — SCRUM-110).
const draftPath = (draftNo) => `/api/v1/str-drafts/${encodeURIComponent(draftNo)}`

const toSection = (data) => ({
	section: data.section,
	text: data.text,
	evidenceIds: data.evidence_ids ?? [],
})

// 명세 1번 응답 예시의 facts. 숫자는 서버(AI)가 계산한 값 그대로 보여 주고 다시 계산하지 않아요.
// TODO(SCRUM-110): 〔확인 필요 — 채영〕 명세 1번 예시는 단순화된 모양이라 실제 AI facts(통화별 inbound/outbound,
// period, counterparties 등)와 달라요. 백엔드가 AI facts를 그대로 넘기는지, 화면용으로 줄이는지 답이 오면 맞춰요.
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

// 검증 결과는 AI 응답 그대로 넘어와요(계약서 S5, 규약 §5.3).
// 코드 검사 reason: MISMATCH·UNPARSED·MISSING·OUT_OF_SCOPE — 넷을 구분해서 보여 줘요. 값이 없으면 null(계약서 2.3).
const toCodeCheck = (data) => ({
	check: data.check,
	section: data.section,
	draftValue: data.draft_value,
	sourceValue: data.source_value,
	match: data.match,
	reason: data.reason ?? null,
})

// AI 평가는 항목마다 1~5점 + 한 줄 코멘트.
const toLlmCheck = (data) => ({ check: data.check, comment: data.comment, score: data.score })

// status: PASSED·CODE_FAILED·LLM_FAILED·VERIFY_UNAVAILABLE.
const toVerification = (data) => ({
	verificationId: data.verification_id,
	revisionNo: data.revision_no,
	narrativeSha256: data.narrative_sha256,
	isCurrent: data.is_current,
	passed: data.passed,
	status: data.status,
	verifierVersion: data.verifier_version,
	producedAt: data.produced_at,
	codeChecks: (data.code_checks ?? []).map(toCodeCheck),
	// 코드 검사가 실패하면 평가자를 안 돌려서 null — 빈 배열로 바꾸지 않아요("평가 안 함"과 "항목 0개"는 달라요).
	llmChecks: data.llm_checks ? data.llm_checks.map(toLlmCheck) : null,
})

/**
 * `access`는 `FULL`(본문) 또는 `META_ONLY`(상태·날짜만 — 관리자·비담당 조사역). META_ONLY 응답은
 * facts·narrative·latest_verification·last_rejection·references가 null로 와요(11/4 채영 확정).
 * 이중 방어: FULL이 아니면 서버가 실수로 본문을 함께 보내도 화면 모델로 옮기지 않습니다.
 */
export function toDraft(data) {
	const meta = {
		draftNo: data.draft_no,
		caseNo: data.case_no,
		status: data.status,
		caseStatus: data.case_status ?? null,
		producedAt: data.produced_at ?? null,
		access: data.access,
		contentVisible: data.access === "FULL",
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
	getDraft: async (draftNo, signal) =>
		toDraft((await apiClient.get(draftPath(draftNo), { signal })).data),
	// 목록에는 본문이 없어요. 본문 전·후는 getRevision으로 한 행씩 받아요.
	getRevisions: async (draftNo, signal) =>
		(await apiClient.get(`${draftPath(draftNo)}/revisions`, { signal })).data.items.map(
			toRevisionSummary,
		),
	getRevision: async (draftNo, revisionNo, signal) => {
		const { data } = await apiClient.get(`${draftPath(draftNo)}/revisions`, {
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
