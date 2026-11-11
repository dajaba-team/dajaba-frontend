import { AI_REQUEST_TIMEOUT_MS, apiClient } from "../../../shared/api/apiClient"

// STR API (계약서 S1~S6, BE docs/06_features/str.md API 표). 경로·응답 번호는 `draft_no`(`DRF-` + 6자리).
//
// 백엔드 연결 상태 (2026-11-10)
//   S1 POST /cases/{case_no}/str-drafts        — BE develop 구현(SCRUM-183). 요청 {case_version} (#89에서 snake_case로 고침)
//   S2 GET  /str-drafts/{draft_no}             — BE develop 구현(SCRUM-205 #84). 아래 "S2 실제 응답과 다른 점" 참고
//   S3 PUT  /str-drafts/{draft_no}/revisions   — BE develop 구현(SCRUM-184 #91)
//   S4 GET  /str-drafts/{draft_no}/revisions   — BE develop 구현(SCRUM-184 #91). 목록·?revision_no= 한 행
// 검증(S5)·승인 요청(S6)은 BE가 아직 없어 다음 PR에서 붙여요. S2의 latest_verification은 여기서 읽기만 해요.
const draftPath = (draftNo) => `/api/v1/str-drafts/${encodeURIComponent(draftNo)}`
const casePath = (caseNo) => `/api/v1/cases/${encodeURIComponent(caseNo)}`

// label은 서식 항목 제목 — BE가 섹션 이름으로 붙여 줘요(SCRUM-205 #84). 없거나 빈 값이면 sectionTitles 표로.
// cites는 단락이 근거로 쓴 facts 키 목록(규약 v0.4 8번) — 화면은 읽기만 하고 수정 요청엔 넣지 않아요.
const toSection = (data) => ({
	section: data.section,
	label: data.label ?? null,
	text: data.text ?? "",
	cites: data.cites ?? [],
	evidenceIds: data.evidence_ids ?? [],
})

// 검증 결과는 AI 응답 그대로(계약서 S5, 규약 §5.3). reason: MISMATCH·UNPARSED·MISSING·OUT_OF_SCOPE.
const toCodeCheck = (data) => ({
	check: data.check,
	section: data.section ?? null,
	draftValue: data.draft_value ?? null,
	sourceValue: data.source_value ?? null,
	match: data.match,
	reason: data.reason ?? null,
})

const toLlmCheck = (data) => ({ check: data.check, comment: data.comment, score: data.score })

/**
 * status: PASSED·CODE_FAILED·LLM_FAILED·VERIFY_UNAVAILABLE.
 * isCurrent는 서버가 준 is_current를 그대로 써요. 서버가 무엇으로 판단하는지(수정본 번호·본문 해시 —
 * BE #95 S5부터 해시)는 화면이 따라 하지 않아요. 키가 없을 때만(옛 응답·검증 응답 등) 화면에서
 * "검증한 수정본 번호 = 지금 수정본 번호"로 대신 계산해요. 승인 요청 때 서버가 다시 검사해요.
 */
export const toVerification = (data, currentRevisionNo = null) => ({
	verificationId: data.verification_id ?? null,
	revisionNo: data.revision_no ?? null,
	narrativeSha256: data.narrative_sha256 ?? null,
	isCurrent:
		typeof data.is_current === "boolean"
			? data.is_current
			: data.revision_no != null && data.revision_no === currentRevisionNo,
	passed: data.passed === true,
	status: data.status ?? null,
	verifierVersion: data.verifier_version ?? null,
	producedAt: data.produced_at ?? null,
	codeChecks: (data.code_checks ?? []).map(toCodeCheck),
	// 코드 검사가 실패하면 평가자를 안 돌려서 null — 빈 배열로 바꾸지 않아요("평가 안 함" ≠ "항목 0개").
	llmChecks: Array.isArray(data.llm_checks) ? data.llm_checks.map(toLlmCheck) : null,
})

const toLastRejection = (data) => ({
	reasonCode: data.reason_code,
	comment: data.comment,
	revisionNo: data.revision_no ?? null,
	decidedBy: data.decided_by ?? null,
	decidedAt: data.decided_at ?? null,
	narrativeUnchanged: data.narrative_unchanged ?? null,
})

/**
 * S2 → 화면 모델. `access`가 정확히 "FULL"일 때만 본문 필드를 옮겨요(META_ONLY·없음·모르는 값은 상태·날짜만).
 *
 * S2 실제 응답(BE develop, SCRUM-205 #84)과 계약서의 차이 — 없는 키는 null로 두고 화면이 대신 판단하지 않아요.
 *   - generation_id·generator_version·last_rejection·suspicion_*·available_actions 아직 없음
 *     (case_status·narrative[].label·latest_verification.is_current는 #84에서 들어옴)
 *   - META_ONLY의 case_no·case_status는 null (계약서는 값)
 *   - facts의 *account_key는 *account_no(가림)·*account_ref로 바뀌어 옴
 * availableActions는 키가 없으면 null — "서버가 아직 안 줌"과 "할 수 있는 게 없음([])"을 구분해요(strRules.strActionsFor).
 */
export function toDraft(data) {
	const meta = {
		draftNo: data.draft_no,
		caseNo: data.case_no ?? null,
		status: data.status,
		caseStatus: data.case_status ?? null,
		producedAt: data.produced_at ?? null,
		access: data.access ?? null,
		contentVisible: data.access === "FULL",
	}
	if (!meta.contentVisible) return meta
	const currentRevisionNo = data.current_revision_no ?? null
	return {
		...meta,
		generationId: data.generation_id ?? null,
		caseVersion: data.case_version ?? null,
		version: data.version ?? null,
		generatorVersion: data.generator_version ?? null,
		currentRevisionNo,
		// facts는 AI facts 그대로(계약서 Q15) — 키를 바꾸지 않아야 cites("inbound.count")와 바로 맞춰 봐요.
		facts: data.facts ?? null,
		narrative: (data.narrative ?? []).map(toSection),
		latestVerification: data.latest_verification
			? toVerification(data.latest_verification, currentRevisionNo)
			: null,
		lastRejection: data.last_rejection ? toLastRejection(data.last_rejection) : null,
		suspicionTypes: data.suspicion_types ?? [],
		suspicionTypesRecommended: data.suspicion_types_recommended ?? [],
		suspicionLevelBranch: data.suspicion_level_branch ?? null,
		suspicionLevelHq: data.suspicion_level_hq ?? null,
		// REVISE·VERIFY·SUBMIT·REGENERATE·CLOSE_WITH_DRAFT(조사역) / APPROVE·REJECT·REPORT(승인자) / *_PDF
		availableActions: Array.isArray(data.available_actions) ? data.available_actions : null,
	}
}

const toRevisionSummary = (data) => ({
	revisionNo: data.revision_no,
	changedSections: data.changed_sections ?? [],
	editedBy: data.edited_by ?? null,
	editedAt: data.edited_at ?? null,
})

// 저장 응답(S3, BE StrRevisionResponses.Saved): draft_no·revision_no·changed_sections·edited_by·edited_at·narrative·
// needs_verification·version·case_version. 화면은 번호·version만 쓰고 성공 뒤 S2를 다시 읽어요. case_status는 BE가 안 줘서 null.
const toSaved = (data) => ({
	draftNo: data.draft_no ?? null,
	revisionNo: data.revision_no ?? data.current_revision_no ?? null,
	version: data.version ?? null,
	caseVersion: data.case_version ?? null,
	caseStatus: data.case_status ?? null,
})

export const strApi = {
	/** S1 — 생성·재생성. 응답 {case_no, case_status, case_version, draft_no}. AI를 기다려서 전용 timeout. */
	createDraft: async ({ caseNo, caseVersion }) => {
		const { data } = await apiClient.post(
			`${casePath(caseNo)}/str-drafts`,
			{ case_version: caseVersion },
			{ timeout: AI_REQUEST_TIMEOUT_MS },
		)
		return {
			caseNo: data.case_no,
			caseStatus: data.case_status,
			caseVersion: data.case_version,
			draftNo: data.draft_no,
		}
	},
	/** S2 */
	getDraft: async (draftNo, signal) =>
		toDraft((await apiClient.get(draftPath(draftNo), { signal })).data),
	/** S3 — 고친 섹션만 {section, text}. facts·cites·evidence_ids는 보내지 않아요(서버가 관리). */
	saveRevision: async ({ draftNo, caseVersion, sections }) =>
		toSaved(
			(
				await apiClient.put(`${draftPath(draftNo)}/revisions`, {
					case_version: caseVersion,
					sections: sections.map(({ section, text }) => ({ section, text })),
				})
			).data,
		),
	/** S4 목록 — 본문 없음. BE 응답 {draft_no, current_revision_no, items[{…, ai_original}]} 중 items만 써요. */
	getRevisions: async (draftNo, signal) =>
		(await apiClient.get(`${draftPath(draftNo)}/revisions`, { signal })).data.items.map(
			toRevisionSummary,
		),
	/** S4 한 행(?revision_no=) — 평평한 모양, 전·후 본문 전체. 1번(AI 원문)은 narrative_before가 []. */
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
