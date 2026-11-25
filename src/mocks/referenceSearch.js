// 참고 사례 찾기 MSW — BE develop의 SearchReferences(SCRUM-354 #178) 응답 모양을 따라요.
// 모양은 설계 문서 「참고 사례 검색 · 승인 STR 색인」 A 6.1 응답(items[] + degraded) 그대로, 판단 순서는 SCRUM-313 처리 순서.
// 목업 결과(설계 7.4 — 결과 있음 · 없음 · degraded · 400 · 502):
//   - SCATTER_GATHER만 고르면 0건(BE MockAiClient와 같은 규칙)
//   - 검색어에 "일부"가 있으면 degraded: true
//   - 검색어에 "AI오류"가 있으면 502 AI_UNAVAILABLE
//   - 유형 0개·4개 이상·목록 밖·중복, 검색어 201자 이상이면 400 INVALID_REQUEST
// 문서명·쪽은 AI corpus의 공개 문서를 흉내 낸 값이고, 관련 구절은 예시 문장이에요.
import { canViewStrContent } from "./strDrafts"

export const REFERENCE_SEARCH_TYPOLOGIES = [
	"FAN_IN",
	"FAN_OUT",
	"CYCLE",
	"SCATTER_GATHER",
	"GATHER_SCATTER",
]
const TOP_K = 5
const QUERY_MAX = 200

const CATALOG = [
	{
		doc_title: "APG Yearly Typologies Report 2025",
		publisher: "Asia/Pacific Group on Money Laundering",
		year: 2025,
		page: 53,
		typologies: ["FAN_IN", "CYCLE"],
		excerpt: "Several unrelated senders transferred funds to the same dormant account.",
	},
	{
		doc_title: "FATF Professional Money Laundering",
		publisher: "FATF",
		year: 2018,
		page: 21,
		typologies: ["FAN_IN", "FAN_OUT"],
		excerpt: null,
	},
	{
		doc_title: "Egmont Group FIU Case Studies",
		publisher: "Egmont Group",
		year: 2023,
		page: 12,
		typologies: ["FAN_OUT", "GATHER_SCATTER"],
		excerpt: "One incoming payment funded transfers to several unrelated recipients.",
	},
	{
		doc_title: "FATF Trade-Based Money Laundering Trends",
		publisher: "FATF",
		year: 2020,
		page: 34,
		typologies: ["CYCLE"],
		excerpt: "Trade payments passed through several firms and returned to the original buyer.",
	},
]

const error = (status, code, message, details = {}) => ({
	status,
	body: { error: { code, message, details } },
})

function invalid(body) {
	const typologies = body?.typologies
	const query = body?.query
	const details = {}
	if (
		!Array.isArray(typologies) ||
		typologies.length < 1 ||
		typologies.length > 3 ||
		new Set(typologies).size !== typologies.length ||
		typologies.some((code) => !REFERENCE_SEARCH_TYPOLOGIES.includes(code))
	)
		details.typologies = "1~3개, 목록 안, 중복 없이"
	if (
		query != null &&
		(typeof query !== "string" || query.trim().normalize("NFC").length > QUERY_MAX)
	)
		details.query = `0~${QUERY_MAX}자`
	return Object.keys(details).length ? details : null
}

/** POST /str-drafts/{draft_no}/references/search → 200 {items, degraded} */
export function searchReferences(viewer, draft, body) {
	if (!canViewStrContent(viewer, draft)) return error(403, "NOT_ASSIGNEE", "권한이 없습니다")
	const details = invalid(body)
	if (details) return error(400, "INVALID_REQUEST", "잘못된 요청입니다", details)
	const query = body.query ?? ""
	if (query.includes("AI오류"))
		return error(502, "AI_UNAVAILABLE", "AI 서버에 연결하지 못했습니다")
	const wanted = new Set(body.typologies)
	const items = CATALOG.filter((doc) => doc.typologies.some((code) => wanted.has(code)))
		.slice(0, TOP_K)
		.map(({ excerpt, ...doc }, index) => ({
			...doc,
			score: Math.round((0.61 - index * 0.07) * 100) / 100,
			source_type: "PUBLIC",
			excerpt,
		}))
	return { status: 200, body: { items, degraded: query.includes("일부") } }
}
