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
 *   - 그중 케이스가 DRAFTED면 VERIFY·SUBMIT — 보완 요청 반려(REJECTED)에선 둘 다 없음. 저장하면 DRAFTED가 돼서
 *     그때 켜져요(BE #95 VerifyStrDraft: DRAFTED에서만, 아니면 409 INVALID_CASE_TRANSITION · 계약서 4절)
 * S2가 available_actions를 주기 시작하면 이 다리는 타지 않아요. 그때 지워요. TODO(SCRUM-205 후속)
 */
export function strActionsFor(draft, caseDetail) {
	if (!draft?.contentVisible) return []
	if (Array.isArray(draft.availableActions)) return draft.availableActions
	const caseActions = caseDetail?.availableActions ?? []
	const actions = []
	if (draft.status === "ACTIVE" && caseActions.includes("GENERATE_DRAFT")) {
		actions.push("REVISE")
		if (caseDetail.status === "DRAFTED") actions.push("VERIFY", "SUBMIT")
		actions.push("REGENERATE")
	}
	if (caseActions.includes("CLOSE_WITH_DRAFT")) actions.push("CLOSE_WITH_DRAFT")
	return actions
}

/**
 * 검증 영역 상태 (화면 설계 STR-02-S).
 * - UNSAVED: 미저장 편집 있음 → 저장 먼저
 * - NONE: 검증 없음
 * - STALE: 최신 검증이 지금 수정본 대상이 아님(isCurrent=false) — 예전 통과는 승인 근거가 아님
 * - PASSED·CODE_FAILED·LLM_FAILED·VERIFY_UNAVAILABLE: 서버 status 그대로
 */
export function verificationState(verification, { dirty = false } = {}) {
	if (dirty) return "UNSAVED"
	if (!verification) return "NONE"
	if (!verification.isCurrent) return "STALE"
	if (verification.status === "PASSED" && verification.passed) return "PASSED"
	return verification.status ?? "UNKNOWN"
}

export const VERIFICATION_TEXT = {
	UNSAVED: "변경한 내용을 먼저 저장해 주세요. 아래 결과는 저장 전 본문 기준이에요.",
	NONE: "아직 검증하지 않았어요. 저장한 본문을 검증해 주세요.",
	STALE: "본문이 바뀌어 다시 검증해야 해요.",
	PASSED: "현재 저장본 검증 통과",
	CODE_FAILED:
		"코드 검사에서 맞지 않는 항목이 있어요. 해당 항목을 고쳐 저장한 뒤 다시 검증해 주세요.",
	LLM_FAILED: "AI 평가 미달(4점 미만) 항목이 있어요. 내용을 보완해 저장한 뒤 다시 검증해 주세요.",
	VERIFY_UNAVAILABLE:
		"평가 서비스를 이용하지 못했어요. 본문은 유지돼요. 잠시 후 다시 검증해 주세요.",
	UNKNOWN: "검증 결과를 확인할 수 없어요. 다시 검증해 주세요.",
}

/**
 * 승인 요청을 막는 이유(버튼 옆에 표시). 없으면 null.
 * 서버가 S6에서 다시 검사해요(ApprovalGate — 본문 해시·최신 검증·반려 후 미수정).
 */
export function submitBlockReason({ actions, caseStatus, dirty, verification, types, level }) {
	if (!actions.includes("SUBMIT")) {
		if (caseStatus === "REJECTED") return "본문을 고쳐 저장하면 다시 승인 요청할 수 있어요."
		return "지금은 승인 요청을 할 수 없는 상태예요."
	}
	if (dirty) return "먼저 변경 내용을 저장해 주세요."
	if (verificationState(verification) !== "PASSED")
		return "지금 저장된 본문의 검증 통과가 필요해요."
	if (!verification.verificationId) return "검증 번호를 확인할 수 없어요. 다시 검증해 주세요."
	if (!types.length) return "의심 유형을 1개 이상 선택해 주세요."
	if (!level) return "지점 의심 정도를 선택해 주세요."
	return null
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
	if (status === "REJECTED") return "보완 요청: 수정 후 저장하고 다시 검증해 주세요."
	return null
}

// ---- 코드 대조 불일치 밑줄 (STR-02-S CODE_FAILED: "본문 밑줄 + 원본: …") ----
// AI의 draft_value는 정규화된 값("2022-09-03", "42750.00")이라 본문 글자("2022년 9월 3일", "USD 42,750.00")와
// 다를 수 있어요. 본문에 흔히 쓰는 모양으로 바꿔 본 뒤 찾고, 못 찾으면 밑줄 없이 항목 아래 안내만 남겨요(추측 표시 안 함).

const groupDigits = (int) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")

/** draft_value 하나 → 본문에서 찾아볼 글자 후보(긴 것 먼저). */
export function valueCandidates(value) {
	if (value == null) return []
	const raw = String(value).trim()
	if (!raw) return []
	const found = new Set([raw])
	const date = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
	if (date) {
		const [, y, m, d] = date
		const mm = Number(m)
		const dd = Number(d)
		;[
			`${y}년 ${mm}월 ${dd}일`,
			`${y}. ${mm}. ${dd}.`,
			`${y}.${m}.${d}`,
			`${y}/${m}/${d}`,
			`${y}-${m}-${d}`,
			`${mm}월 ${dd}일`,
		].forEach((item) => found.add(item))
	}
	const number = raw.match(/^(-?)(\d+)(?:\.(\d+))?$/)
	if (number) {
		const [, sign, int, frac] = number
		const grouped = sign + groupDigits(int)
		if (frac) found.add(`${grouped}.${frac}`)
		found.add(grouped)
		found.add(sign + int)
	}
	return [...found].sort((a, b) => b.length - a.length)
}

const isDigit = (ch) => ch != null && ch >= "0" && ch <= "9"

/**
 * 본문 text에서 불일치 검사(match=false)의 본문 값을 찾아 밑줄 범위를 돌려줘요.
 * 결과: [{start, end, check}] — 시작 위치 순, 겹치지 않음. 숫자 앞뒤가 숫자면("13"의 "3") 건너뛰어요.
 */
export function mismatchMarks(text, checks) {
	if (!text) return []
	const marks = []
	const overlaps = (start, end) => marks.some((mark) => start < mark.end && mark.start < end)
	for (const check of checks) {
		if (check.match) continue
		let placed = false
		for (const candidate of valueCandidates(check.draftValue)) {
			let from = 0
			while (!placed) {
				const start = text.indexOf(candidate, from)
				if (start < 0) break
				const end = start + candidate.length
				const boundary =
					!(isDigit(candidate[0]) && isDigit(text[start - 1])) &&
					!(isDigit(candidate.at(-1)) && isDigit(text[end]))
				if (boundary && !overlaps(start, end)) {
					marks.push({ start, end, check })
					placed = true
				}
				from = start + 1
			}
			if (placed) break
		}
	}
	return marks.sort((a, b) => a.start - b.start)
}
