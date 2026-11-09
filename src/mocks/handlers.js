import { canViewStrContent, seedStrDrafts, visibleStrDraft } from "./strDrafts"
import { applyCommand, changeResponse, detailResponse, listResponse, seedCases } from "./cases"
import { http, HttpResponse } from "msw"

let cases = seedCases()
let drafts = seedStrDrafts()
let currentUser = null
// MSW 예시 계정입니다. 실제 백엔드 비밀번호(DEV_USER_PASSWORD)와는 관계없습니다.
export const MOCK_PASSWORD = "mock-password"
const MOCK_USERS = Object.fromEntries(
	[
		// id는 백엔드처럼 숫자(Long)예요(SCRUM-173).
		[1, "inv01", "INVESTIGATOR"],
		[2, "inv02", "INVESTIGATOR"],
		[3, "apr01", "APPROVER"],
		[4, "admin", "ADMIN"],
	].map(([id, loginId, role]) => [
		loginId,
		{ id, login_id: loginId, display_name: `예시 ${loginId}`, role },
	]),
)
export function resetCases(user = null) {
	cases = seedCases()
	drafts = seedStrDrafts()
	currentUser = user
}
const draftNotFound = () =>
	HttpResponse.json(
		{ error: { code: "DRAFT_NOT_FOUND", message: "초안을 찾을 수 없습니다", details: {} } },
		{ status: 404 },
	)
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
	// 케이스 — 계약서 C1·C2·A1·A3·A4·A5·A6 (요약 A7·C7은 아래, 실제 백엔드 CaseController와 같은 경로, 메모 A3·초안 있는 종료 A6은 백엔드 준비 중)
	http.get(`${base}/api/v1/cases`, ({ request }) => {
		if (!currentUser) return unauthenticated()
		return HttpResponse.json(listResponse(cases, new URL(request.url)))
	}),
	http.get(`${base}/api/v1/cases/:caseNo`, ({ params }) => {
		if (!currentUser) return unauthenticated()
		const item = cases.find((entry) => entry.case_no === params.caseNo)
		return item
			? HttpResponse.json(detailResponse(currentUser, item))
			: HttpResponse.json(
					{
						error: {
							code: "CASE_NOT_FOUND",
							message: "케이스가 없습니다",
							details: {},
						},
					},
					{ status: 404 },
				)
	}),
	...[
		["post", "assign"],
		["post", "escalate"],
		["post", "close"],
		["post", "close-with-draft"],
		["put", "notes"],
	].map(([method, command]) =>
		http[method](`${base}/api/v1/cases/:caseNo/${command}`, async ({ params, request }) => {
			if (!currentUser) return unauthenticated()
			const item = cases.find((entry) => entry.case_no === params.caseNo)
			const body = await request.json().catch(() => null)
			const result = applyCommand(currentUser, item, command, body, MOCK_USERS)
			// 초안 있는 종료는 같은 트랜잭션에서 초안을 SUPERSEDED로 바꿔요(BE CloseRequiresStrException 주석).
			if (result.item && command === "close-with-draft") {
				const draft = drafts.find(
					(entry) => entry.draft_no === result.item.current_draft_no,
				)
				if (draft) Object.assign(draft, { status: "SUPERSEDED", case_status: "CLOSED" })
			}
			return result.item
				? HttpResponse.json(changeResponse(result.item))
				: HttpResponse.json(result.body, { status: result.status })
		}),
	),
	// AI 조사 요약 — 계약서 A7(201 { case_no, summary, case_version })·C7(조회 3역할, 없으면 summary: null)
	http.post(`${base}/api/v1/cases/:caseNo/refresh-summary`, async ({ params, request }) => {
		if (!currentUser) return unauthenticated()
		const item = cases.find((entry) => entry.case_no === params.caseNo)
		const body = await request.json().catch(() => null)
		const result = applyCommand(currentUser, item, "refresh-summary", body, MOCK_USERS)
		return result.item
			? HttpResponse.json(
					{
						case_no: result.item.case_no,
						summary: result.item.latest_summary,
						case_version: result.item.version,
					},
					{ status: 201 },
				)
			: HttpResponse.json(result.body, { status: result.status })
	}),
	http.get(`${base}/api/v1/cases/:caseNo/summary`, ({ params }) => {
		if (!currentUser) return unauthenticated()
		const item = cases.find((entry) => entry.case_no === params.caseNo)
		if (!item)
			return HttpResponse.json(
				{ error: { code: "CASE_NOT_FOUND", message: "케이스가 없습니다", details: {} } },
				{ status: 404 },
			)
		return HttpResponse.json({ case_no: item.case_no, summary: item.latest_summary ?? null })
	}),
	http.get(`${base}/api/v1/str-drafts/:draftNo`, ({ params }) => {
		if (!currentUser) return unauthenticated()
		const draft = drafts.find((item) => item.draft_no === params.draftNo)
		return draft ? HttpResponse.json(visibleStrDraft(currentUser, draft)) : draftNotFound()
	}),
	// 목록은 본문 없이, `?revision_no=`면 그 한 행의 전·후 본문(명세 4번).
	http.get(`${base}/api/v1/str-drafts/:draftNo/revisions`, ({ params, request }) => {
		if (!currentUser) return unauthenticated()
		const draft = drafts.find((item) => item.draft_no === params.draftNo)
		if (!draft) return draftNotFound()
		// 수정 이력은 제한 응답 없이 403 — 관리자 FORBIDDEN, 비담당 조사역 NOT_ASSIGNEE (계약서 Q13, 11/4 채영)
		if (!canViewStrContent(currentUser, draft))
			return HttpResponse.json(
				{
					error: {
						code: currentUser.role === "ADMIN" ? "FORBIDDEN" : "NOT_ASSIGNEE",
						message: "권한이 없습니다",
						details: {},
					},
				},
				{ status: 403 },
			)
		const revisionNo = new URL(request.url).searchParams.get("revision_no")
		if (revisionNo == null)
			return HttpResponse.json({
				draft_no: draft.draft_no,
				// 목록은 본문 없이 메타만(명세 4번).
				items: draft.revisions.map((item) => ({
					revision_no: item.revision_no,
					changed_sections: item.changed_sections,
					edited_by: item.edited_by,
					edited_at: item.edited_at,
				})),
			})
		// 없는 revision_no는 404 REVISION_NOT_FOUND (계약서 Q13, 11/4 채영)
		const revision = draft.revisions.find((item) => item.revision_no === Number(revisionNo))
		return revision
			? HttpResponse.json(revision)
			: HttpResponse.json(
					{
						error: {
							code: "REVISION_NOT_FOUND",
							message: "수정본이 없습니다",
							details: {},
						},
					},
					{ status: 404 },
				)
	}),
]
