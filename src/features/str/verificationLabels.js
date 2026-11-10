// 검증 결과 화면 글자와 "어떤 항목을 늘 보여 줄지" 표 (SCRUM-116, FR-VRF-02~08, 계약서 S5).
// 검사 이름은 계약서 S5(AI 정본 CodeCheckName) 그대로예요.
// 표에 없는 이름이 응답에 오면 숨기지 않고 이름 그대로 표 뒤에 보여 줘요 — 개수를 고정하지 않아요(#32 리뷰).

// 코드 검사 6개 — 응답에 줄이 없어도 항목은 늘 보여 줘요("검사 없음"과 "통과"는 달라요).
// OPINION_PRESENT는 종합의견 공란 거부예요(narrative_v2만, SCRUM-47 안건 6-5).
export const CODE_CHECKS = [
	["AMOUNT_MATCH", "금액"],
	["DATE_MATCH", "날짜"],
	["COUNT_MATCH", "건수"],
	["ACCOUNT_ID_MATCH", "계좌"],
	["EVIDENCE_IN_SCOPE", "근거 범위"],
	["OPINION_PRESENT", "종합의견"],
]

// AI 평가 5개 — 1~5점 + 한 줄 코멘트.
export const LLM_CHECKS = [
	["FIVE_W_ONE_H_COMPLETE", "육하원칙 빠짐 없음"],
	["TYPOLOGY_CONSISTENT", "의심 유형과 본문이 맞음"],
	["NO_UNSUPPORTED_CLAIM", "근거 없는 주장 없음"],
	["NO_SPECULATION", "추측 표현 없음"],
	["NO_INSTRUCTION_TEXT", "지시문·프롬프트 흔적 없음"],
]

// 응답에 와도 안 보여 주는 옛 항목 — 요구사항에서 빠졌어요.
export const HIDDEN_CHECKS = ["GROUNDING"]

// AI 평가 통과 점수. 화면은 줄마다 "미달" 표시만 하고, 전체 통과 여부는 서버 passed·status만 봐요.
export const LLM_PASS_SCORE = 4

// 코드 검사가 틀린 이유 — 넷을 섞지 않아요(SCRUM-116, 11/3 진희 DATE_MATCH 공유).
export const CODE_REASON_LABELS = {
	MISMATCH: "불일치",
	UNPARSED: "읽지 못함",
	MISSING: "빠짐",
	OUT_OF_SCOPE: "근거 범위 밖",
}

// llm_checks가 null인 이유 — 코드 검사 실패와 평가 서비스 오류를 섞지 않아요(#32 리뷰, 테스트 11-4).
export const LLM_SKIPPED_NOTES = {
	CODE_FAILED: "코드 검사가 실패해서 AI 평가를 돌리지 않았어요.",
	VERIFY_UNAVAILABLE: "AI 평가를 하지 못했어요(평가 서비스 오류). 검증 실패가 아니에요.",
}

export const VERIFICATION_STATUS_LABELS = {
	PASSED: "통과",
	CODE_FAILED: "코드 검사 실패",
	LLM_FAILED: "AI 평가 미달",
	VERIFY_UNAVAILABLE: "검증 못 함",
}
