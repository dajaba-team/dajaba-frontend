// 서버 enum → 화면 글자. 값 자체는 서버 것 그대로 (AI 호출 기록 계약서 5.9, access_logs V004_3).
export const AI_ENDPOINTS = {
	"/v1/scores": "점수 배치",
	"/v1/str/drafts": "STR 초안",
	"/v1/str/verify": "STR 검증",
	"/v1/cases/summary": "케이스 요약",
	"/v1/health": "AI 상태 확인",
}
export const AI_TARGET_TYPES = { BATCH_RUN: "배치", CASE: "케이스", DRAFT: "STR 초안" }
export const ACCESS_ACTIONS = {
	VIEW: "열람",
	STR_VIEW: "STR 열람",
	PDF_DOWNLOAD: "PDF 내려받기",
	EXPORT: "내보내기",
	LOGIN_OK: "로그인",
	LOGIN_FAIL: "로그인 실패",
	LOGOUT: "로그아웃",
	USER_CREATED: "계정 발급",
	ROLE_CHANGED: "역할 변경",
	USER_DEACTIVATED: "계정 비활성화",
}
export const ACCESS_TARGET_TYPES = {
	CASE: "케이스",
	STR_DRAFT: "STR 초안",
	ALERT: "경보",
	USER: "계정",
}
