// STR 서버 enum → 화면 글자. 값은 서버 것을 그대로 쓰고 여기서 만들지 않아요(01_code_rules §3).

export const DRAFT_STATUS_LABELS = {
	ACTIVE: "작성 중",
	SUPERSEDED: "대체됨",
	LOCKED: "승인·잠김",
}

export const labelOf = (table, value) => (value == null ? "-" : (table[value] ?? value))
