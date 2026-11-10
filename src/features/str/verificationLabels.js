// 검증 결과 화면 글자와 "어떤 항목을 늘 보여 줄지" 표 (SCRUM-116, FR-VRF-02~08, 계약서 S5).
// 검사 이름은 계약서 S5 그대로예요. 요구사항에 없는 항목(예: 옛 GROUNDING)은 표에 없어서 화면에 안 나와요.

// 코드 검사 5개 — 응답에 줄이 없어도 항목은 늘 보여 줘요("검사 없음"과 "통과"는 달라요).
export const CODE_CHECKS = [
	["AMOUNT_MATCH", "금액"],
	["DATE_MATCH", "날짜"],
	["COUNT_MATCH", "건수"],
	["ACCOUNT_ID_MATCH", "계좌"],
	["EVIDENCE_IN_SCOPE", "근거 범위"],
]

// AI 평가 5개 — 1~5점 + 한 줄 코멘트.
export const LLM_CHECKS = [
	["FIVE_W_ONE_H_COMPLETE", "육하원칙 빠짐 없음"],
	["TYPOLOGY_CONSISTENT", "의심 유형과 본문이 맞음"],
	["NO_UNSUPPORTED_CLAIM", "근거 없는 주장 없음"],
	["NO_SPECULATION", "추측 표현 없음"],
	["NO_INSTRUCTION_TEXT", "지시문·프롬프트 흔적 없음"],
]

// AI 평가 통과 점수. 화면은 줄마다 "미달" 표시만 하고, 전체 통과 여부는 서버 passed·status만 봐요.
export const LLM_PASS_SCORE = 4

// 코드 검사가 틀린 이유 — 넷을 섞지 않아요(SCRUM-116, 11/3 진희 DATE_MATCH 공유).
export const CODE_REASON_LABELS = {
	MISMATCH: "불일치",
	UNPARSED: "읽지 못함",
	MISSING: "빠짐",
	OUT_OF_SCOPE: "근거 범위 밖",
}

export const VERIFICATION_STATUS_LABELS = {
	PASSED: "통과",
	CODE_FAILED: "코드 검사 실패",
	LLM_FAILED: "AI 평가 미달",
	VERIFY_UNAVAILABLE: "검증 못 함",
}
