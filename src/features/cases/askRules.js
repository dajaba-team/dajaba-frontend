// 질문 패널 규칙 — 글자 수·예시 질문·상태별 안내 문구 (SCRUM-303, 설계 8절).

export const QUESTION_MAX = 300

// 예시 질문 — 누르면 입력 칸만 채우고 바로 보내지 않아요(8.1).
export const ASK_EXAMPLES = [
	"입금 상대 계좌는 몇 개입니까?",
	"탐지 룰에 해당한 사유는 무엇입니까?",
	"모델 점수의 주요 요인은 무엇입니까?",
]

// 답하지 못한 상태의 안내 문구는 AI가 아니라 화면이 정해요(설계 5.3·8.2). 모르는 값이면 공통 문구.
export const ASK_OUTCOME_TEXT = {
	NO_DATA: "케이스 근거에 해당 데이터가 없습니다.",
	UNVERIFIED: "근거 데이터와 일치하지 않아 답변을 표시하지 않습니다.",
	EDIT_REQUEST: "조회 전용 기능입니다. 수정은 편집 화면에서 진행하세요.",
	OUTSIDE_CASE: "이 케이스 범위를 벗어난 질의입니다.",
	JUDGMENT: "판단은 조사역·승인자의 권한입니다. 사실 확인 질의만 가능합니다.",
}
export const askOutcomeText = (record) =>
	ASK_OUTCOME_TEXT[record.status === "OUT_OF_SCOPE" ? record.outOfScopeReason : record.status] ??
	"답변할 수 없는 질의입니다."

// 글자 수는 서버·AI와 같이 NFC 정규화 뒤 UTF-16 코드 단위(SCRUM-302).
export const questionLength = (text) => text.normalize("NFC").length
