import { http, HttpResponse } from "msw"

function seed() {
	return [
		{
			id: "1001",
			title: "반복 고액 이체 조사",
			status: "REVIEWING",
			assignee_name: "예시 조사원",
			case_version: 1,
			memo: "거래 목적 확인 필요",
			evidence: "예시: 동일 계좌에서 짧은 시간 내 반복 이체가 발생했습니다.",
			allowed_actions: ["SAVE_MEMO"],
			history: ["케이스 생성", "예시 조사원에게 배정"],
		},
		{
			id: "1002",
			title: "다수 계좌 분산 거래",
			status: "OPEN",
			assignee_name: null,
			case_version: 1,
			memo: "",
			evidence: "예시: 여러 계좌로 분산된 거래를 확인해야 합니다.",
			allowed_actions: [],
			history: ["케이스 생성"],
		},
	]
}
let cases = seed()
let currentUser = null
export function resetCases(user = null) {
	cases = seed()
	currentUser = user
}
// 예시 사용자도 역할·담당자 조건을 지켜야 개발 화면이 과도한 권한을 전제로 굳지 않습니다.
function canSaveMemo(item) {
	return currentUser?.login_id === "inv01" && item.status === "REVIEWING" && item.id === "1001"
}
function visibleCase(item) {
	return { ...item, allowed_actions: canSaveMemo(item) ? ["SAVE_MEMO"] : [] }
}
const unauthenticated = () =>
	HttpResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 })
const base = new URL(
	import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
	window.location.origin,
).href.replace(/\/$/, "")
export const handlers = [
	http.get(`${base}/api/v1/auth/me`, () =>
		currentUser
			? HttpResponse.json(currentUser)
			: HttpResponse.json(
					{ error: { code: "UNAUTHENTICATED", message: "로그인이 필요합니다" } },
					{ status: 401 },
				),
	),
	http.post(`${base}/api/v1/auth/mock-login`, ({ request }) => {
		const loginId = new URL(request.url).searchParams.get("login_id")
		if (!["inv01", "inv02", "apr01", "admin"].includes(loginId))
			return new HttpResponse(null, { status: 400 })
		currentUser = {
			id: { inv01: "1", inv02: "2", apr01: "3", admin: "4" }[loginId],
			login_id: loginId,
			display_name: `예시 ${loginId}`,
			role: loginId === "admin" ? "ADMIN" : loginId === "apr01" ? "APPROVER" : "INVESTIGATOR",
		}
		return HttpResponse.json(currentUser)
	}),
	http.post(`${base}/api/v1/auth/logout`, () => {
		currentUser = null
		return new HttpResponse(null, { status: 204 })
	}),
	// 연동 확인 화면용. 실제 백엔드 응답 중 화면이 읽는 필드만 둡니다.
	http.get(`${base}/actuator/health`, () => HttpResponse.json({ status: "UP" })),
	http.get(`${base}/v3/api-docs`, () =>
		HttpResponse.json({
			openapi: "3.0.1",
			info: { title: "MSW 예시 API", version: "mock" },
			paths: {
				"/api/v1/auth/me": { get: {} },
				"/api/v1/auth/mock-login": { post: {} },
				"/api/v1/auth/logout": { post: {} },
			},
		}),
	),
	http.get(`${base}/api/cases`, ({ request }) => {
		if (!currentUser) return unauthenticated()
		const url = new URL(request.url)
		const status = url.searchParams.get("status")
		const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
		const filtered = cases.filter((item) => !status || item.status === status)
		return HttpResponse.json({
			items: filtered.slice((page - 1) * 10, page * 10).map(visibleCase),
			has_next: filtered.length > page * 10,
		})
	}),
	http.get(`${base}/api/cases/:id`, ({ params }) => {
		if (!currentUser) return unauthenticated()
		const item = cases.find((item) => item.id === params.id)
		return item ? HttpResponse.json(visibleCase(item)) : new HttpResponse(null, { status: 404 })
	}),
	http.put(`${base}/api/cases/:id/memo`, async ({ params, request }) => {
		if (!currentUser) return unauthenticated()
		const item = cases.find((item) => item.id === params.id)
		if (!item) return new HttpResponse(null, { status: 404 })
		if (!canSaveMemo(item)) return new HttpResponse(null, { status: 403 })
		const body = await request.json()
		if (body.case_version !== item.case_version)
			return HttpResponse.json({ error: { code: "CONCURRENT_UPDATE" } }, { status: 409 })
		if (typeof body.memo !== "string") return new HttpResponse(null, { status: 400 })
		item.memo = body.memo
		item.case_version += 1
		item.history.push(`조사 메모 저장 (버전 ${item.case_version})`)
		return HttpResponse.json(visibleCase(item))
	}),
]
