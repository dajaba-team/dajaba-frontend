// STR 화면 규칙 — 순수 함수만 둬요(테스트하기 쉽게). 권한·상태의 최종 판단은 언제나 서버예요.

export const SECTION_MAX = 5000

/** 글자 수는 NFC 기준(BE SCRUM-95 — 한글 조합형이 두 번 세지지 않게). */
export const textLength = (text) => (text ?? "").normalize("NFC").length

/** 항목 하나의 입력 오류. 없으면 null. 서버도 같은 규칙으로 400 INVALID_SECTION_TEXT. */
export function sectionError(text) {
	if (!text || !text.trim()) return "빈 항목은 저장할 수 없어요."
	if (textLength(text) > SECTION_MAX) return `${SECTION_MAX.toLocaleString()}자를 넘었어요.`
	return null
}

/** 서버 본문과 입력({section: text})을 비교해 고친 항목만 [{section, text}] (S3는 고친 섹션만 보내요). */
export function changedSections(narrative, inputs) {
	return narrative
		.filter((item) => inputs[item.section] !== undefined && inputs[item.section] !== item.text)
		.map((item) => ({ section: item.section, text: inputs[item.section] }))
}

/**
 * 이 화면에서 쓸 STR 동작 목록.
 *
 * 원칙: 버튼은 서버가 준 S2 `available_actions`만 보고 켜요(계약서 Q16).
 * 다리(임시): S2 실제 응답(BE develop, SCRUM-205 #84)엔 아직 available_actions가 없어요(null). 그동안은 케이스 상세 C2의
 * available_actions(BE CaseAction — 담당·상태를 서버가 이미 판단한 값)에서 STR 동작을 옮겨 와요.
 *   - GENERATE_DRAFT(담당 + ESCALATED·DRAFTED·REJECTED/NEED_REVISION) → 초안 ACTIVE면 REVISE·REGENERATE
 *   - VERIFY·SUBMIT·CLOSE_WITH_DRAFT는 S5·S6 화면과 같이 붙여요
 * S2가 available_actions를 주기 시작하면 이 다리는 타지 않아요. 그때 지워요. TODO(SCRUM-205 후속)
 */
export function strActionsFor(draft, caseDetail) {
	if (!draft?.contentVisible) return []
	if (Array.isArray(draft.availableActions)) return draft.availableActions
	const caseActions = caseDetail?.availableActions ?? []
	const actions = []
	if (draft.status === "ACTIVE" && caseActions.includes("GENERATE_DRAFT"))
		actions.push("REVISE", "REGENERATE")
	return actions
}

/** 화면 상단 안내(STR-04). 편집 가능 여부와 별개로, 지금 상태를 한 줄로. */
export function stateNotice(draft, caseDetail) {
	if (!draft.contentVisible) return null
	if (draft.status === "SUPERSEDED") return "대체된 과거 초안이에요. 읽기만 할 수 있어요."
	if (draft.status === "LOCKED") return "승인된 보고서예요. 본문이 잠겨 고칠 수 없어요."
	const status = caseDetail?.status ?? draft.caseStatus
	if (status === "PENDING_APPROVAL") return "승인 대기 중이라 본문을 수정할 수 없어요."
	if (status === "REJECTED" && caseDetail?.rejectionReasonCode === "NOT_REPORTABLE")
		return "보고 안 함으로 반려됐어요. 종료 사유를 남겨 마무리해 주세요."
	if (status === "REJECTED") return "보완 요청: 수정 후 저장해 주세요."
	return null
}
