export const statusKo = {
	OPEN: "접수",
	REVIEWING: "조사 중",
	ESCALATED: "상신",
	DRAFTED: "초안 작성됨",
	PENDING_APPROVAL: "승인 대기",
	APPROVED: "승인",
	REJECTED: "반려",
	CLOSED: "종료",
	SUCCEEDED: "성공",
	FAILED: "실패",
	RUNNING: "처리 중",
	IDLE: "대기",
}
// 서술부 7항목 — 별지 제1호 서식 1~7 순서(AI SectionV2·narrative_v2 프롬프트, 11/6 반영).
// 화면 이름표는 서버가 주는 narrative[].label이 먼저고, 이 값은 label이 없을 때만 써요.
// 순서는 체크리스트용이고, 본문은 서버가 준 목록·순서대로 그려요(기존 6섹션 초안도 그대로 보여요).
export const narrativeItems = [
	["SUBJECT", "거래자"],
	["DATE", "일자"],
	["PLACE", "장소"],
	["INSTRUMENT", "수단"],
	["METHOD", "방법"],
	["GROUNDS", "사유"],
	["OPINION", "종합의견"],
]
export const sectionKo = Object.fromEntries(narrativeItems)
export const sectionLabel = (section) =>
	section.label ?? sectionKo[section.section] ?? section.section
export const roleKo = {
	ADMIN: "관리자",
	INVESTIGATOR: "조사역",
	APPROVER: "책임자",
}
