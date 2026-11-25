// 계정 발급·초기화 입력 규칙 (BE 04 §7, 11/7 진희) — 화면에서도 먼저 검사하고 서버가 다시 검사해요.
export const LOGIN_ID = /^[A-Za-z0-9_-]{3,64}$/
export const ROLE_LABELS = {
	INVESTIGATOR: "조사역",
	APPROVER: "승인자",
	ADMIN: "관리자",
	SYSTEM: "SYSTEM",
}
// 발급할 수 있는 역할 — SYSTEM 없음
export const ISSUABLE_ROLES = ["INVESTIGATOR", "APPROVER", "ADMIN"]
// 역할 변경은 조사역 ↔ 승인자만(관리자로·관리자에서 없음)
export const ROLE_SWAP = { INVESTIGATOR: "APPROVER", APPROVER: "INVESTIGATOR" }

// 진행 중 담당 = BE CaseStatus.active()(미결 33)와 같은 상태들. 계정 관리의 "진행 중 담당 N건" 옆 [케이스 보기]는
// 이 상태만 걸어서 열어요 — 끝난 케이스(승인·보고됨·종료)까지 보여 건수와 목록이 어긋나지 않게(SCRUM-423).
export const ACTIVE_CASE_STATUSES = [
	"REVIEWING",
	"ESCALATED",
	"DRAFTED",
	"PENDING_APPROVAL",
	"REJECTED",
]
/** 그 조사역의 진행 중 담당 케이스 목록 주소 */
export function activeCasesPath(loginId) {
	return `/cases?assignee=${encodeURIComponent(loginId)}&status=${ACTIVE_CASE_STATUSES.join(",")}`
}

export function loginIdError(value) {
	return LOGIN_ID.test(value) ? null : "아이디는 영문·숫자·_·- 3~64자예요."
}
export function displayNameError(value) {
	const length = value.trim().length
	return length >= 1 && length <= 50 ? null : "이름은 1~50자예요."
}
export function passwordError(value) {
	return value.length >= 8 && value.length <= 128 ? null : "비밀번호는 8~128자예요."
}
