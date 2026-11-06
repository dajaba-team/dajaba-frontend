// 서술부 섹션 이름 → 화면 제목. 실제 STR 화면과 시연 화면이 같이 쓰는 한 벌이에요(SCRUM-115 리뷰).
// 제목은 서버가 주는 `narrative[].label`이 먼저고(11/4 채영, 서식 항목 제목), 이 표는 label이 없거나 빈 값일 때만 써요.
// 표에도 없는 이름은 섹션 이름을 그대로 보여 줘서 화면이 깨지지 않아요.
// 본문 순서는 이 표가 아니라 서버가 준 목록 순서 그대로예요.

// 서술부 7항목 — 별지 제1호 서식 1~7 순서, AI narrative_v2 (11/6부터 새 초안)
export const narrativeItems = [
	["SUBJECT", "거래자"],
	["DATE", "일자"],
	["PLACE", "장소"],
	["INSTRUMENT", "수단"],
	["METHOD", "방법"],
	["GROUNDS", "사유"],
	["OPINION", "종합의견"],
]

export const sectionTitles = {
	...Object.fromEntries(narrativeItems),
	// 옛 6섹션 — narrative_v1. 이미 만든 초안·승인본은 그대로 남아서 계속 보여야 해요
	SUMMARY: "요약",
	WHO: "누가",
	WHAT_WHEN_WHERE: "무엇을·언제·어디서",
	HOW: "어떻게",
	WHY_SUSPICIOUS: "의심 사유",
	CONCLUSION: "결론",
}

/** 섹션({ section, label })의 화면 제목. `||`라서 label이 빈 문자열이어도 표로 넘어가요. */
export const sectionTitle = ({ section, label }) => label || sectionTitles[section] || section
