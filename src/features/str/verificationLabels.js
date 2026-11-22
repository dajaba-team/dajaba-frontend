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

// 검증 항목 이름 옆 물음표 도움말(SCRUM-331).
// 사용자가 "무엇을, 왜 확인하는지" 알 수 있도록 실제 검사 기준만 쉬운 말로 설명합니다.
export const VERIFICATION_CHECK_HELP = {
	AMOUNT_MATCH: "본문의 거래 금액이 이 케이스 거래 자료의 금액과 같은지 확인해요.",
	DATE_MATCH: "본문의 거래 날짜·고객 등록일이 이 케이스 거래 자료의 날짜와 같은지 확인해요.",
	COUNT_MATCH: "본문에 적은 건수·계좌 수 같은 숫자가 이 케이스 거래 자료의 값과 같은지 확인해요.",
	ACCOUNT_ID_MATCH: "본문의 계좌 정보가 이 케이스 거래 자료의 계좌와 같은지 확인해요.",
	EVIDENCE_IN_SCOPE: "본문이 근거로 든 거래와 항목이 이 케이스의 근거 안에 있는지 확인해요.",
	OPINION_PRESENT: "검토자가 판단 근거를 알 수 있도록 종합의견이 작성되었는지 확인해요.",
	FIVE_W_ONE_H_COMPLETE:
		"누가·언제·어디서·무엇을·어떻게·왜에 해당하는 핵심 정보가 빠지지 않았는지 평가해요.",
	TYPOLOGY_CONSISTENT: "선택한 의심 유형과 STR 본문의 설명이 서로 맞는지 평가해요.",
	NO_UNSUPPORTED_CLAIM: "원본 거래 근거로 확인할 수 없는 사실을 단정하지 않았는지 평가해요.",
	NO_SPECULATION: "확인되지 않은 내용을 사실처럼 추측해 적지 않았는지 평가해요.",
	NO_INSTRUCTION_TEXT: "작성 지시문이나 AI 프롬프트 문구가 보고서 본문에 남지 않았는지 평가해요.",
}

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
