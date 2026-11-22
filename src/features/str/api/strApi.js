import { AI_REQUEST_TIMEOUT_MS, apiClient } from "../../../shared/api/apiClient"

// STR API (계약서 S1~S6, BE docs/06_features/str.md API 표). 경로·응답 번호는 `draft_no`(`DRF-` + 6자리).
//
// 백엔드 연결 상태 (2026-11-10)
//   S1 POST /cases/{case_no}/str-drafts        — BE develop 구현(SCRUM-183). 요청 {case_version} (#89에서 snake_case로 고침)
//   S2 GET  /str-drafts/{draft_no}             — BE develop 구현(SCRUM-205 #84). 아래 "S2 실제 응답과 다른 점" 참고
//   S3 PUT  /str-drafts/{draft_no}/revisions   — BE develop 구현(SCRUM-184 #91)
//   S4 GET  /str-drafts/{draft_no}/revisions   — BE develop 구현(SCRUM-184 #91). 목록·?revision_no= 한 행
//   S5 POST /str-drafts/{draft_no}/verify      — BE develop 구현(SCRUM-206 #95)
//                                                응답은 AI 원문이라 is_current 없음
//   S6 POST /str-drafts/{draft_no}/submit      — BE develop 구현(SCRUM-185 #100)
//   참고 사례 찾기 POST /str-drafts/{draft_no}/references/search — BE 아직 없음(SCRUM-313·354), MSW만
// 아직 없는 API는 계약서 모양 그대로 MSW(`src/mocks/handlers.js`)가 답해요. BE가 붙으면 이 파일은 그대로 써요.
// 참고 사례 찾기는 AI 임베딩을 기다려요 — 백엔드 8초 + 여유(설계 문서 A 5.1·7.3 "화면 timeout 10초"). 자동 재시도 없음.
export const REFERENCE_SEARCH_TIMEOUT_MS = 10_000

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

// 초안 기준 최신 반려(BE GetStrDraft, ApprovalRepository.findLatestRejection).
// narrative_unchanged: 반려 당시 본문 해시 == 지금 본문 해시. true면 S6이 409 NARRATIVE_UNCHANGED.
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
 * S2 실제 응답(BE develop)과 계약서의 차이 — 없는 키는 null로 두고 화면이 대신 판단하지 않아요.
 *   - #84: case_status·narrative[].label·latest_verification.is_current
 *   - #109: suspicion_types·_recommended([])·suspicion_level_branch·_hq·generation_id·
 *     generator_version·references(문서명·쪽·점수, 본문 없음), META_ONLY의 case_no·case_status
 *   - #115(SCRUM-231): last_rejection — decided_by는 승인자 표시 이름(문자열)
 *   - SCRUM-232: available_actions — 조사역 REVISE·VERIFY·SUBMIT·REGENERATE·CLOSE_WITH_DRAFT,
 *     승인자 APPROVE·REJECT
 *   - facts의 *account_key는 *account_no(가림)·*account_ref로 바뀌어 옴
 * availableActions는 키가 없으면 null(옛 응답) — strRules.strActionsFor가 빈 목록으로 봐요.
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
		// 초안을 만들 때 AI가 붙인 참고 사례 0~3건(SCRUM-312). 옛 응답·null이면 [].
		references: Array.isArray(data.references) ? data.references.map(toReference) : [],
		// REVISE·VERIFY·SUBMIT·REGENERATE·CLOSE_WITH_DRAFT(조사역) / APPROVE·REJECT·REPORT(승인자) / *_PDF
		availableActions: Array.isArray(data.available_actions) ? data.available_actions : null,
	}
}

// S2 references — BE GetStrDraft가 AI generation_meta.references에서 chunk_id·doc_id·doc_title·page·score만 옮겨 줘요
// (본문 text는 빠짐, SCRUM-125 후속). page는 PDF 쪽 번호(1부터)라 화면은 "PDF n쪽"으로 적어요.
const toReference = (data) => ({
	chunkId: data.chunk_id ?? null,
	docId: data.doc_id ?? null,
	docTitle: data.doc_title ?? null,
	page: data.page ?? null,
	score: typeof data.score === "number" ? data.score : null,
})

// 참고 사례 찾기 결과 한 건(설계 문서 A 6.1). doc_id·chunk_id는 BE가 화면에 주지 않아요.
// publisher·year는 AI manifest 값이라 없으면 null. typologies는 그 청크의 태그 전부(고른 유형 밖도 올 수 있어요).
const toSearchItem = (data) => ({
	docTitle: data.doc_title ?? null,
	publisher: data.publisher ?? null,
	year: data.year ?? null,
	page: data.page ?? null,
	score: typeof data.score === "number" ? data.score : null,
	typologies: Array.isArray(data.typologies) ? data.typologies : [],
	sourceType: data.source_type ?? null,
})

// ai_original: 서버가 정한 "AI 원문 행" 여부(S4). 없으면 null — revisionLabel이 번호로 대신 봐요.
const toRevisionSummary = (data) => ({
	revisionNo: data.revision_no,
	changedSections: data.changed_sections ?? [],
	editedBy: data.edited_by ?? null,
	editedAt: data.edited_at ?? null,
	aiOriginal: typeof data.ai_original === "boolean" ? data.ai_original : null,
})

// 저장 응답(S3, BE StrRevisionResponses.Saved). 화면은 성공 뒤 S2를 다시 읽지만,
// needs_verification은 저장 안내 문구에 바로 써요(검증 대상이 바뀌었는지 서버가 판단).
// case_status는 BE가 안 줘서 null.
const toSaved = (data) => ({
	draftNo: data.draft_no ?? null,
	revisionNo: data.revision_no ?? data.current_revision_no ?? null,
	changedSections: data.changed_sections ?? [],
	editedBy: data.edited_by ?? null,
	editedAt: data.edited_at ?? null,
	needsVerification:
		typeof data.needs_verification === "boolean" ? data.needs_verification : null,
	version: data.version ?? null,
	caseVersion: data.case_version ?? null,
	caseStatus: data.case_status ?? null,
})

const toSubmitted = (data) => ({
	caseNo: data.case_no ?? null,
	caseStatus: data.case_status ?? data.status ?? null,
	caseVersion: data.case_version ?? data.version ?? null,
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
	/**
	 * S4 목록 — 본문 없음. BE 응답 {draft_no, current_revision_no, items[{…, ai_original}]}.
	 * current_revision_no로 "지금 저장본" 행을 표시해요.
	 */
	getRevisions: async (draftNo, signal) => {
		const { data } = await apiClient.get(`${draftPath(draftNo)}/revisions`, { signal })
		return {
			currentRevisionNo: data.current_revision_no ?? null,
			items: (data.items ?? []).map(toRevisionSummary),
		}
	},
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
	/** S5 — body {}. 서버가 지금 저장된 수정본을 검증해요. 응답은 검증 결과(AI 응답 그대로). */
	verify: async ({ draftNo }) => {
		const { data } = await apiClient.post(
			`${draftPath(draftNo)}/verify`,
			{},
			{ timeout: AI_REQUEST_TIMEOUT_MS },
		)
		return toVerification(data, data.revision_no ?? null)
	},
	/** S6 — 승인 요청. 서버가 ApprovalGate로 다시 검사해요(본문 해시). */
	submit: async ({
		draftNo,
		caseVersion,
		verificationId,
		suspicionTypes,
		suspicionLevelBranch,
	}) =>
		toSubmitted(
			(
				await apiClient.post(`${draftPath(draftNo)}/submit`, {
					case_version: caseVersion,
					verification_id: verificationId,
					suspicion_types: suspicionTypes,
					suspicion_level_branch: suspicionLevelBranch,
				})
			).data,
		),
	/**
	 * 참고 사례 찾기 〔임시: BE SearchReferences 아직 없음 — SCRUM-313/354, 설계 문서 A 6.1 모양 그대로 MSW〕.
	 * 조회 전용이지만 검색어가 주소·접속 기록에 남지 않게 POST예요. top_k는 BE 설정값(5)이라 보내지 않아요.
	 * query는 앞뒤 공백을 지우고 빈 값이면 null(BE도 같은 처리를 다시 해요).
	 */
	searchReferences: async ({ draftNo, typologies, query }, signal) => {
		const trimmed = query?.trim() ?? ""
		const { data } = await apiClient.post(
			`${draftPath(draftNo)}/references/search`,
			{ typologies, query: trimmed === "" ? null : trimmed },
			{ timeout: REFERENCE_SEARCH_TIMEOUT_MS, signal },
		)
		return {
			items: (data.items ?? []).map(toSearchItem),
			degraded: data.degraded === true,
		}
	},
}
