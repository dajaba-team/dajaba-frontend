import { canViewStrContent, seedStrDrafts, visibleStrDraft } from "./strDrafts"
import {
	applyCommand,
	changeResponse,
	detailResponse,
	evidenceResponse,
	graphResponse,
	historiesResponse,
	listResponse,
	noteHistoriesResponse,
	seedCases,
	transactionsResponse,
} from "./cases"
import { http, HttpResponse } from "msw"

let cases = seedCases()
let drafts = seedStrDrafts()
let currentUser = null
// 배치 실행 (B4·B5) — 접수하면 RUNNING, 첫 상태 조회에서 끝나요. 같은 날짜가 성공했으면 409 BATCH_ALREADY_DONE.
let batchRuns = []
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
	batchRuns = []
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
	http.post(`${base}/api/v1/admin/batches/open-cases`, ({ request }) => {
		if (!currentUser) return unauthenticated()
		if (currentUser.role !== "ADMIN")
			return HttpResponse.json(
				{ error: { code: "FORBIDDEN", message: "권한이 없습니다", details: {} } },
				{ status: 403 },
			)
		const date = new URL(request.url).searchParams.get("date")
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? ""))
			return HttpResponse.json(
				{ error: { code: "INVALID_REQUEST", message: "date 가 필요합니다", details: {} } },
				{ status: 400 },
			)
		if (batchRuns.some((run) => run.batch_date === date && run.status === "SUCCEEDED"))
			return HttpResponse.json(
				{
					error: {
						code: "BATCH_ALREADY_DONE",
						message: "이미 성공한 날짜입니다",
						details: {},
					},
				},
				{ status: 409 },
			)
		const run = {
			batch_run_id: 100 + batchRuns.length,
			batch_type: "OPEN_CASES",
			batch_date: date,
			status: "RUNNING",
		}
		batchRuns.push(run)
		return HttpResponse.json(run, { status: 202 })
	}),
	http.get(`${base}/api/v1/admin/batches/:batchRunId`, ({ params }) => {
		if (!currentUser) return unauthenticated()
		const run = batchRuns.find((item) => String(item.batch_run_id) === params.batchRunId)
		if (!run)
			return HttpResponse.json(
				{ error: { code: "NOT_FOUND", message: "요청한 주소가 없습니다", details: {} } },
				{ status: 404 },
			)
		if (run.status === "RUNNING")
			Object.assign(run, {
				status: "SUCCEEDED",
				started_at: "2026-11-02T03:00:00Z",
				finished_at: "2026-11-02T03:00:05Z",
				rows_in: 2,
				rows_out: 1,
				error_message: null,
				triggered_by: { login_id: currentUser.login_id },
			})
		return HttpResponse.json(run)
	}),
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
		return HttpResponse.json(listResponse(cases, new URL(request.url), currentUser))
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
	// BE GET /admin/users (SCRUM-135 ①) — ADMIN만, role·is_active 필터, display_name 오름차순
	http.get(`${base}/api/v1/admin/users`, ({ request }) => {
		if (!currentUser) return unauthenticated()
		if (currentUser.role !== "ADMIN")
			return HttpResponse.json(
				{ error: { code: "FORBIDDEN", message: "권한이 없습니다", details: {} } },
				{ status: 403 },
			)
		const url = new URL(request.url)
		const role = url.searchParams.get("role")
		const active = url.searchParams.get("is_active") !== "false"
		const items = Object.values(MOCK_USERS)
			.filter((u) => (!role || u.role === role) && (u.is_active !== false) === active)
			.sort((a, b) => a.display_name.localeCompare(b.display_name))
			.map((u) => ({
				id: u.id,
				login_id: u.login_id,
				display_name: u.display_name,
				role: u.role,
				is_active: u.is_active !== false,
				active_case_count: null,
			}))
		return HttpResponse.json({ items, page: 0, size: 100, total: items.length })
	}),
	// 근거 거래(C3)·원본(C4)·그래프(C5)·이력 전체(C6) — BE CaseTransactions·ListCaseHistories(SCRUM-179)와 같은 모양
	...[
		["transactions", transactionsResponse],
		["graph", graphResponse],
		["histories", historiesResponse],
	].map(([path, respond]) =>
		http.get(`${base}/api/v1/cases/:caseNo/${path}`, ({ params, request }) => {
			if (!currentUser) return unauthenticated()
			const item = cases.find((entry) => entry.case_no === params.caseNo)
			return item
				? HttpResponse.json(respond(item, new URL(request.url)))
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
	),
	http.get(`${base}/api/v1/cases/:caseNo/evidence/:transactionId`, ({ params }) => {
		if (!currentUser) return unauthenticated()
		const item = cases.find((entry) => entry.case_no === params.caseNo)
		if (!item)
			return HttpResponse.json(
				{ error: { code: "CASE_NOT_FOUND", message: "케이스가 없습니다", details: {} } },
				{ status: 404 },
			)
		const evidence = evidenceResponse(item, params.transactionId)
		return evidence
			? HttpResponse.json(evidence)
			: HttpResponse.json(
					{
						error: {
							code: "EVIDENCE_NOT_FOUND",
							message: "이 케이스의 근거 거래가 아닙니다",
							details: {},
						},
					},
					{ status: 404 },
				)
	}),
	http.get(`${base}/api/v1/cases/:caseNo/note-histories`, ({ params, request }) => {
		if (!currentUser) return unauthenticated()
		const item = cases.find((entry) => entry.case_no === params.caseNo)
		return item
			? HttpResponse.json(noteHistoriesResponse(item, new URL(request.url)))
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
		["post", "reassign"],
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
