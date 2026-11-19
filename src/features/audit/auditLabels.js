// 서버 enum → 화면 글자. 값 자체는 서버 것 그대로 (AI 호출 기록 계약서 5.9 endpoint 여섯 개, 접근 기록 5.10).
export const AI_ENDPOINTS = {
	"/v1/scores": "점수 배치",
	"/v1/str/drafts": "STR 초안",
	"/v1/str/verify": "STR 검증",
	"/v1/cases/summary": "케이스 요약",
	"/v1/cases/ask": "질문 답변",
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
// 접근 기록 대상 번호 칸 안내 — 서버가 대상 종류별 형식을 검사해요(틀리면 400 details.target_id).
export const ACCESS_TARGET_ID_EXAMPLES = {
	CASE: "CASE-2022-000057",
	STR_DRAFT: "DRF-000123",
	ALERT: "ALT-20220902-000142",
	USER: "inv01",
}
export const ACCESS_TARGET_TYPES = {
	CASE: "케이스",
	STR_DRAFT: "STR 초안",
	ALERT: "경보",
	USER: "계정",
}
