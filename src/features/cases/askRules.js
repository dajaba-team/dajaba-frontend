// 질문 패널 규칙 — 글자 수·예시 질문·상태별 안내 문구 (SCRUM-303, 설계 8절).

export const QUESTION_MAX = 300

// 예시 질문 — 누르면 입력 칸만 채우고 바로 보내지 않아요(8.1).
export const ASK_EXAMPLES = [
	"입금 상대가 몇 곳이야?",
	"왜 이 룰에 걸렸어?",
	"모델은 뭘 보고 점수를 높게 줬어?",
]

// 답하지 못한 상태의 안내 문구는 AI가 아니라 화면이 정해요(설계 5.3·8.2). 모르는 값이면 공통 문구.
export const ASK_OUTCOME_TEXT = {
	NO_DATA: "이 케이스 근거에는 그 값이 없어요.",
	UNVERIFIED: "근거로 확인되지 않아 답을 보여 드리지 않아요.",
	EDIT_REQUEST: "이 기능은 조회만 해요. 수정은 편집 화면에서 해 주세요.",
	OUTSIDE_CASE: "이 케이스 근거로는 답할 수 없어요.",
	JUDGMENT: "판단은 조사역과 승인자가 해요. 근거 사실만 물어봐 주세요.",
}
export const askOutcomeText = (record) =>
	ASK_OUTCOME_TEXT[record.status === "OUT_OF_SCOPE" ? record.outOfScopeReason : record.status] ??
	"이 질문에는 답할 수 없어요."

// 글자 수는 서버·AI와 같이 NFC 정규화 뒤 UTF-16 코드 단위(SCRUM-302).
export const questionLength = (text) => text.normalize("NFC").length
