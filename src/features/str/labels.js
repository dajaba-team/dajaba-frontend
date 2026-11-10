// STR 서버 enum → 화면 글자. 값은 서버 것을 그대로 쓰고 여기서 만들지 않아요(01_code_rules §3).

export const DRAFT_STATUS_LABELS = {
	ACTIVE: "작성 중",
	SUPERSEDED: "대체됨",
	LOCKED: "승인·잠김",
}

export const VERIFICATION_STATUS_LABELS = {
	PASSED: "통과",
	CODE_FAILED: "코드 대조 불통과",
	LLM_FAILED: "AI 평가 불통과",
	VERIFY_UNAVAILABLE: "검증 못 함",
}

// 코드 검사 reason (규약 §5.3). 화면 설계 STR-02 ③ — 넷을 구분해요.
export const CHECK_REASON_LABELS = {
	MISMATCH: "불일치",
	UNPARSED: "읽지 못함",
	MISSING: "누락",
	OUT_OF_SCOPE: "범위 밖",
}

// 검사 이름은 AI가 정해요. 모르는 이름은 그대로 보여 줘요(검사 수를 5개로 고정하지 않음 — STR-02 ②).
export const CHECK_LABELS = {
	AMOUNT_MATCH: "금액·통화 대조",
	DATE_MATCH: "날짜 대조",
	COUNT_MATCH: "건수 대조",
	ACCOUNT_ID_MATCH: "계좌 대조",
	EVIDENCE_IN_SCOPE: "근거 거래 범위",
	OPINION_PRESENT: "종합의견 존재",
	FIVE_W_ONE_H_COMPLETE: "육하원칙 충족",
	TYPOLOGY_CONSISTENT: "유형 일관성",
	NO_UNSUPPORTED_CLAIM: "근거 없는 주장 없음",
	NO_SPECULATION: "추측 표현 없음",
	NO_INSTRUCTION_TEXT: "지시문 섞임 없음",
}

export const labelOf = (table, value) => (value == null ? "-" : (table[value] ?? value))
