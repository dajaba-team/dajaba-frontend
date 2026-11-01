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
// MSW 예시 계정입니다. 실제 백엔드 비밀번호(DEV_USER_PASSWORD)와는 관계없습니다.
export const MOCK_PASSWORD = "mock-password"
const MOCK_USERS = Object.fromEntries(
	[
		["1", "inv01", "INVESTIGATOR"],
		["2", "inv02", "INVESTIGATOR"],
		["3", "apr01", "APPROVER"],
		["4", "admin", "ADMIN"],
	].map(([id, loginId, role]) => [
		loginId,
		{ id, login_id: loginId, display_name: `예시 ${loginId}`, role },
	]),
)
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
const base = new URL(import.meta.env.VITE_API_BASE_URL || "", window.location.origin).href.replace(
	/\/$/,
	"",
)
export const handlers = [
	http.get(`${base}/api/v1/auth/me`, () =>
		currentUser
			? HttpResponse.json(currentUser)
			: HttpResponse.json(
					{ error: { code: "UNAUTHENTICATED", message: "로그인이 필요합니다" } },
					{ status: 401 },
				),
	),
	// 실제 백엔드(POST /api/v1/auth/login)와 같은 계약입니다. 예시 비밀번호는 MOCK_PASSWORD 하나입니다.
	http.post(`${base}/api/v1/auth/login`, async ({ request }) => {
		const body = await request.json().catch(() => null)
		if (!body?.login_id?.trim() || !body?.password)
			return HttpResponse.json(
				{
					error: {
						code: "INVALID_REQUEST",
						message: "login_id 와 password 가 필요합니다",
					},
				},
				{ status: 400 },
			)
		const user = MOCK_USERS[body.login_id]
		if (!user || body.password !== MOCK_PASSWORD)
			return HttpResponse.json(
				{
					error: {
						code: "LOGIN_FAILED",
						message: "아이디 또는 비밀번호가 맞지 않습니다",
					},
				},
				{ status: 401 },
			)
		currentUser = user
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
				"/api/v1/auth/login": { post: {} },
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
