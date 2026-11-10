// 서버 enum → 화면 글자. 값 자체는 서버 것을 그대로 쓰고 여기서 새로 만들지 않아요(01_code_rules §3).
// 상태 이름은 계약서 v0.2 §4·§7 — ESCALATED는 "에스컬레이션됨"("상신" 안 씀).
export const STATUS_LABELS = {
	OPEN: "접수",
	REVIEWING: "조사 중",
	ESCALATED: "에스컬레이션됨",
	DRAFTED: "초안 작성됨",
	PENDING_APPROVAL: "승인 대기",
	APPROVED: "승인",
	REPORTED: "보고됨",
	REJECTED: "반려",
	CLOSED: "종료",
}

export const CLOSE_REASON_LABELS = {
	FALSE_POSITIVE: "오탐",
	DUPLICATE: "중복 경보",
	NO_ACTION: "추가 조치 불필요",
}

export const REJECTION_LABELS = {
	NEED_REVISION: "보완 요청",
	NOT_REPORTABLE: "보고 안 함",
}

// case_history.action (BE CaseHistoryAction)
export const HISTORY_LABELS = {
	OPEN: "케이스 생성",
	ASSIGN: "담당 배정",
	REASSIGN: "담당자 변경",
	ESCALATE: "에스컬레이션",
	ATTACH_DRAFT: "STR 초안 연결",
	SUBMIT_FOR_APPROVAL: "승인 요청",
	APPROVE: "승인",
	REJECT: "반려",
	CLOSE: "종료",
	REOPEN_DRAFT: "초안 보완 시작",
	NOTE: "메모 저장",
}

// alerts.score_status — 상세 latest_score.score_status
export const SCORE_STATUS_LABELS = {
	PENDING: "산출 전",
	SCORED: "산출 완료",
	FAILED: "산출 실패",
}

export const labelOf = (labels, value) => (value == null ? "" : (labels[value] ?? value))

// 근거 거래 방향 — 케이스 계좌 기준 (계약서 C3). INDIRECT = 경유 거래, 대상 계좌가 보내지도 받지도 않음.
export const DIRECTION_LABELS = {
	INBOUND: "입금",
	OUTBOUND: "출금",
	INDIRECT: "대상 계좌 미참여 (경유)",
}
