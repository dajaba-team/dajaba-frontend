// 참고 사례 패널·찾기 영역 규칙 — 순수 함수 (설계 문서 「참고 사례 검색 · 승인 STR 색인」 A 7절, SCRUM-333).

// 찾을 수 있는 유형은 경보 Typology 중 이 다섯만(규약 5.5 — FX_RELAY 등은 BE·AI가 400). 순서도 이대로.
// 이름은 룰 화면(shared/format/rule.js, BE rules.md v2)과 같게.
export const SEARCH_TYPOLOGIES = [
	["FAN_IN", "집중 입금"],
	["FAN_OUT", "분산 송금"],
	["CYCLE", "순환 거래"],
	["SCATTER_GATHER", "흩었다 모으기"],
	["GATHER_SCATTER", "모았다 흩기"],
]
export const MAX_TYPOLOGIES = 3
export const QUERY_MAX = 200

const TYPOLOGY_LABELS = Object.fromEntries(SEARCH_TYPOLOGIES)
const SEARCHABLE = new Set(Object.keys(TYPOLOGY_LABELS))

/** 결과 태그는 검색 가능한 5종 밖도 올 수 있어요(AI가 청크 태그 전부를 줌) — 모르는 값은 코드 그대로. */
export const typologyLabel = (code) => TYPOLOGY_LABELS[code] ?? code

/** 처음 골라 둘 유형 — 이 STR의 경보 유형(facts.typology)이 찾을 수 있는 다섯 중 하나면 그것 하나. */
export function initialTypologies(facts) {
	const code = facts?.typology
	return SEARCHABLE.has(code) ? [code] : []
}

/**
 * 검색어 길이 — AI·BE와 같은 기준(NFC 정규화 뒤 UTF-16 코드 단위, 질문 답변과 같음).
 * 앞뒤 공백은 서버가 지우니 화면도 지운 뒤 세요.
 */
export const queryLength = (query) => (query ?? "").trim().normalize("NFC").length

/** [찾기]를 막는 이유. 없으면 null. */
export function searchBlockReason({ typologies, query }) {
	if (typologies.length === 0) return "유형을 하나 이상 골라 주세요."
	if (queryLength(query) > QUERY_MAX) return `검색어는 ${QUERY_MAX}자까지 쓸 수 있어요.`
	return null
}

/** 유사도는 소수 둘째 자리까지 버리지 않고 반올림해 보여 줘요(설계 7.1 "0.52"). */
export const formatSimilarity = (score) => (typeof score === "number" ? score.toFixed(2) : "-")

/** 초안에 이미 붙어 있는 참고 사례와 같은 문서·쪽인가(문서명 + PDF 쪽으로 비교 — 찾기 응답엔 doc_id가 없어요). */
export function isAttached(item, references) {
	return references.some(
		(ref) => ref.docTitle != null && ref.docTitle === item.docTitle && ref.page === item.page,
	)
}

/** 400 INVALID_REQUEST의 details에서 칸별 안내. 칸을 모르면 공통 문구. */
export function invalidInputMessage(details) {
	if (details?.typologies) return "유형은 1~3개, 목록 안에서만 고를 수 있어요."
	if (details?.query) return `검색어는 ${QUERY_MAX}자까지 쓸 수 있어요.`
	return "입력을 확인해 주세요."
}
