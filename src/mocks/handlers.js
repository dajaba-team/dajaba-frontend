import { canViewStrContent, seedStrDrafts, visibleStrDraft } from "./strDrafts"
import { createDraft, draftActions, saveRevision, submitDraft, verifyDraft } from "./strCommands"
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
// 배치 실행 (B1·B2·B4·B5) — 적재·케이스 생성은 접수하면 RUNNING, 첫 상태 조회에서 끝나요. 룰 스캔은 바로 끝나요.
// 같은 유형·날짜가 성공했으면 409 BATCH_ALREADY_DONE(적재는 날짜와 상관없이 한 번).
let batchRuns = []
const batchConflict = (code, message) =>
	HttpResponse.json({ error: { code, message, details: {} } }, { status: 409 })
const succeeded = (type, date) =>
	batchRuns.some(
		(run) =>
			run.batch_type === type &&
			run.status === "SUCCEEDED" &&
			(date == null || run.batch_date === date),
	)
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
// 계정 관리(계약서 5.8) — 로그인용 MOCK_USERS 와 따로 바뀌는 목록. SYSTEM 은 비활성·로그인 불가(BE V003).
// BE 에서는 id 1 이지만 예시 계정 id(1~4, SCRUM-173)와 겹치지 않게 MSW 에서는 100 — 화면은 id 가 아니라 role 로 가려요.
const seedAccounts = () => [
	{ id: 100, login_id: "system", display_name: "SYSTEM", role: "SYSTEM", is_active: false },
	...Object.values(MOCK_USERS).map((u) => ({ ...u, is_active: true })),
]
let accounts = seedAccounts()
const ACTIVE_CASE = ["REVIEWING", "ESCALATED", "DRAFTED", "PENDING_APPROVAL", "REJECTED"]
const accountView = (u) => ({
	id: u.id,
	login_id: u.login_id,
	display_name: u.display_name,
	role: u.role,
	is_active: u.is_active,
	// 조사역 행만 진행 중 담당 건수(BE ActiveCaseCounter, 미결 33)
	active_case_count:
		u.role === "INVESTIGATOR"
			? cases.filter(
					(c) => c.assignee?.login_id === u.login_id && ACTIVE_CASE.includes(c.status),
				).length
			: null,
})
const adminOnly = () =>
	currentUser?.role === "ADMIN"
		? null
		: HttpResponse.json(
				{ error: { code: "FORBIDDEN", message: "권한이 없습니다", details: {} } },
				{ status: 403 },
			)
const accountFail = (status, code, message, details = {}) =>
	HttpResponse.json({ error: { code, message, details } }, { status })

export function resetCases(user = null) {
	cases = seedCases()
	drafts = seedStrDrafts()
	currentUser = user
	accounts = seedAccounts()
	batchRuns = []
}
const draftNotFound = () =>
	HttpResponse.json(
		{ error: { code: "DRAFT_NOT_FOUND", message: "초안을 찾을 수 없습니다", details: {} } },
		{ status: 404 },
	)
const caseOf = (draft) => cases.find((entry) => entry.case_no === draft.case_no) ?? null
const reply = ({ status, body }) => HttpResponse.json(body, { status })
const unauthenticated = () =>
	HttpResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 })
const base = new URL(import.meta.env.VITE_API_BASE_URL || "", window.location.origin).href.replace(
	/\/$/,
	"",
)
// 감사 기록(SCRUM-170) 예시 — 메타만. AI 호출 기록은 BE AiCallLogView(#69), 접근 기록은 access_logs 칸 + 공통 목록〔가정, SCRUM-168 전〕.
const AI_CALLS = [
	{
		id: 6,
		endpoint: "/v1/cases/summary",
		request_id: "req-006",
		attempt: 1,
		status_code: null,
		error_code: "AI_TIMEOUT",
		duration_ms: 90000,
		ai_version: null,
		generation_id: null,
		target_type: "CASE",
		target_id: "CASE-2022-001004",
		created_at: "2026-11-02T03:10:00Z",
	},
	{
		id: 5,
		endpoint: "/v1/str/verify",
		request_id: "req-005",
		attempt: 1,
		status_code: 200,
		error_code: null,
		duration_ms: 4200,
		ai_version: "verifier-v2",
		generation_id: "g-124",
		target_type: "DRAFT",
		target_id: "DRF-000124",
		created_at: "2026-11-02T02:40:00Z",
	},
	{
		id: 4,
		endpoint: "/v1/str/drafts",
		request_id: "req-004",
		attempt: 2,
		status_code: 200,
		error_code: null,
		duration_ms: 31000,
		ai_version: "narrative_v2",
		generation_id: "g-124",
		target_type: "DRAFT",
		target_id: "DRF-000124",
		created_at: "2026-11-02T02:30:00Z",
	},
	{
		id: 3,
		endpoint: "/v1/str/drafts",
		request_id: "req-004",
		attempt: 1,
		status_code: 503,
		error_code: "AI_UNAVAILABLE",
		duration_ms: 1200,
		ai_version: null,
		generation_id: null,
		target_type: "DRAFT",
		target_id: "DRF-000124",
		created_at: "2026-11-02T02:29:00Z",
	},
	{
		id: 2,
		endpoint: "/v1/scores",
		request_id: "req-002",
		attempt: 1,
		status_code: 200,
		error_code: null,
		duration_ms: 8800,
		ai_version: "xgb-2022.11",
		generation_id: null,
		target_type: "BATCH_RUN",
		target_id: "17",
		created_at: "2026-11-01T01:00:00Z",
	},
	{
		id: 1,
		endpoint: "/v1/health",
		request_id: "req-001",
		attempt: 1,
		status_code: 200,
		error_code: null,
		duration_ms: 40,
		ai_version: null,
		generation_id: null,
		target_type: null,
		target_id: null,
		created_at: "2026-11-01T00:00:00Z",
	},
]
const ACCESS_LOGS = [
	{
		id: 5,
		login_id: "admin",
		action: "ROLE_CHANGED",
		target_type: "USER",
		target_id: 2,
		created_at: "2026-11-02T04:00:00Z",
	},
	{
		id: 4,
		login_id: "inv01",
		action: "STR_VIEW",
		target_type: "STR_DRAFT",
		target_id: 124,
		created_at: "2026-11-02T02:50:00Z",
	},
	{
		id: 3,
		login_id: "inv01",
		action: "VIEW",
		target_type: "CASE",
		target_id: 1004,
		created_at: "2026-11-02T02:00:00Z",
	},
	{
		id: 2,
		login_id: "nobody",
		action: "LOGIN_FAIL",
		target_type: null,
		target_id: null,
		created_at: "2026-11-01T09:00:00Z",
	},
	{
		id: 1,
		login_id: "inv01",
		action: "LOGIN_OK",
		target_type: null,
		target_id: null,
		created_at: "2026-11-01T08:59:00Z",
	},
]
const pageOf = (all, url) => {
	const page = Number(url.searchParams.get("page") ?? 0)
	const size = Number(url.searchParams.get("size") ?? 20)
	return { items: all.slice(page * size, (page + 1) * size), page, size, total: all.length }
}
// 필터는 전부 선택·AND, from 포함·to 제외(계약서 5.9). 값이 같은 칸만.
const byFilters = (rows, url, keys) =>
	rows.filter((row) => {
		const p = url.searchParams
		if (p.get("from") && row.created_at < p.get("from")) return false
		if (p.get("to") && row.created_at >= p.get("to")) return false
		if (p.get("outcome") === "SUCCESS" && row.error_code) return false
		if (p.get("outcome") === "FAILURE" && !row.error_code) return false
		return keys.every((key) => !p.get(key) || String(row[key]) === p.get(key))
	})

export const handlers = [
	http.get(`${base}/api/v1/admin/ai-calls`, ({ request }) => {
		if (!currentUser) return unauthenticated()
		const denied = adminOnly()
		if (denied) return denied
		const url = new URL(request.url)
		const rows = byFilters(AI_CALLS, url, [
			"endpoint",
			"request_id",
			"target_type",
			"target_id",
			"error_code",
		])
		return HttpResponse.json(pageOf(rows, url))
	}),
	http.get(`${base}/api/v1/admin/access-logs`, ({ request }) => {
		if (!currentUser) return unauthenticated()
		const denied = adminOnly()
		if (denied) return denied
		const url = new URL(request.url)
		return HttpResponse.json(
			pageOf(byFilters(ACCESS_LOGS, url, ["login_id", "action", "target_type"]), url),
		)
	}),
	http.post(`${base}/api/v1/admin/batches/load`, () => {
		if (!currentUser) return unauthenticated()
		const denied = adminOnly()
		if (denied) return denied
		if (succeeded("LOAD_DATASET"))
			return batchConflict("BATCH_ALREADY_DONE", "이미 적재된 데이터가 있습니다")
		const run = {
			batch_run_id: 100 + batchRuns.length,
			batch_type: "LOAD_DATASET",
			batch_date: new Date().toISOString().slice(0, 10),
			status: "RUNNING",
		}
		batchRuns.push(run)
		return HttpResponse.json(run, { status: 202 })
	}),
	http.post(`${base}/api/v1/admin/batches/rule-scan`, ({ request }) => {
		if (!currentUser) return unauthenticated()
		const denied = adminOnly()
		if (denied) return denied
		const date = new URL(request.url).searchParams.get("date")
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? ""))
			return HttpResponse.json(
				{ error: { code: "INVALID_REQUEST", message: "date 가 필요합니다", details: {} } },
				{ status: 400 },
			)
		if (!succeeded("LOAD_DATASET"))
			return batchConflict("DATASET_NOT_LOADED", "적재된 거래가 없습니다")
		if (date < "2022-09-01" || date > "2022-09-18")
			return batchConflict("DATE_OUT_OF_RANGE", "거래가 있는 날짜가 아닙니다")
		if (succeeded("RULE_SCAN", date))
			return batchConflict(
				"BATCH_ALREADY_DONE",
				`RULE_SCAN ${date} 는 이미 성공한 배치입니다`,
			)
		const run = {
			batch_run_id: 100 + batchRuns.length,
			batch_type: "RULE_SCAN",
			batch_date: date,
			status: "SUCCEEDED",
			rows_in: 1200,
			rows_out: 3,
			alerts_by_rule: [{ rule_id: "R02_FAN_IN", rule_version: 1, alert_count: 3 }],
			started_at: "2026-11-12T03:00:00Z",
			finished_at: "2026-11-12T03:00:02Z",
		}
		batchRuns.push(run)
		return HttpResponse.json(run)
	}),
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
		// 다른 유형(룰 스캔)이 같은 날짜에 성공해도 막지 않게 유형까지 봐요(SCRUM-220)
		if (succeeded("OPEN_CASES", date))
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
	// BE GET /admin/users (SCRUM-135 ①) — ADMIN만, role·is_active 필터(미지정이면 활성만), display_name 오름차순
	http.get(`${base}/api/v1/admin/users`, ({ request }) => {
		if (!currentUser) return unauthenticated()
		const denied = adminOnly()
		if (denied) return denied
		const url = new URL(request.url)
		const role = url.searchParams.get("role")
		const active = url.searchParams.get("is_active") !== "false"
		const page = Number(url.searchParams.get("page") ?? 0)
		const size = Number(url.searchParams.get("size") ?? 20)
		const all = accounts
			.filter((u) => (!role || u.role === role) && u.is_active === active)
			.sort((a, b) => a.display_name.localeCompare(b.display_name) || a.id - b.id)
			.map(accountView)
		return HttpResponse.json({
			items: all.slice(page * size, (page + 1) * size),
			page,
			size,
			total: all.length,
		})
	}),
	// SCRUM-135 ② 계약서 5.8 모양 — BE 머지 전 MSW 먼저
	http.post(`${base}/api/v1/admin/users`, async ({ request }) => {
		if (!currentUser) return unauthenticated()
		const denied = adminOnly()
		if (denied) return denied
		const body = await request.json().catch(() => ({}))
		const details = {}
		if (!/^[A-Za-z0-9_-]{3,64}$/.test(body.login_id ?? ""))
			details.login_id = "영문·숫자·_·- 3~64자"
		if (!body.display_name?.trim() || body.display_name.trim().length > 50)
			details.display_name = "1~50자"
		if ((body.initial_password ?? "").length < 8 || body.initial_password.length > 128)
			details.initial_password = "8~128자"
		if (!["INVESTIGATOR", "APPROVER", "ADMIN"].includes(body.role)) details.role = "역할"
		if (Object.keys(details).length)
			return accountFail(400, "INVALID_REQUEST", "입력 값을 확인해 주세요", details)
		if (accounts.some((u) => u.login_id === body.login_id))
			return accountFail(409, "LOGIN_ID_TAKEN", "이미 쓰는 아이디입니다")
		const user = {
			id: Math.max(...accounts.map((u) => u.id)) + 1,
			login_id: body.login_id,
			display_name: body.display_name.trim(),
			role: body.role,
			is_active: true,
		}
		accounts.push(user)
		return HttpResponse.json(accountView(user), { status: 201 })
	}),
	http.post(`${base}/api/v1/admin/users/:id/:verb`, async ({ params, request }) => {
		if (!currentUser) return unauthenticated()
		const denied = adminOnly()
		if (denied) return denied
		const user = accounts.find((u) => String(u.id) === params.id)
		if (!user) return accountFail(404, "USER_NOT_FOUND", "사용자가 없습니다")
		const body = await request.json().catch(() => ({}))
		if (params.verb === "change-role") {
			const swap = { INVESTIGATOR: "APPROVER", APPROVER: "INVESTIGATOR" }
			if (swap[user.role] !== body.role)
				return accountFail(400, "INVALID_REQUEST", "조사역 ↔ 승인자만 바꿀 수 있습니다", {
					role: "조사역 ↔ 승인자만",
				})
			const count = accountView(user).active_case_count
			if (count > 0)
				return accountFail(
					409,
					"ASSIGNEE_HAS_ACTIVE_CASES",
					"진행 중인 담당 케이스가 있습니다",
					{
						active_case_count: count,
					},
				)
			user.role = body.role
		} else if (params.verb === "deactivate") user.is_active = false
		else if (params.verb === "activate") user.is_active = true
		else if (params.verb === "reset-password") {
			if ((body.new_password ?? "").length < 8 || body.new_password.length > 128)
				return accountFail(400, "INVALID_REQUEST", "입력 값을 확인해 주세요", {
					new_password: "8~128자",
				})
		} else return accountFail(404, "NOT_FOUND", "요청한 주소가 없습니다")
		return HttpResponse.json(accountView(user))
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
	// S1 초안 생성 — BE develop에 있어요(SCRUM-183). MSW는 같은 계약으로 답해요. 새 초안 본문은 7항목 예시를 복사.
	http.post(`${base}/api/v1/cases/:caseNo/str-drafts`, async ({ params, request }) => {
		if (!currentUser) return unauthenticated()
		const item = cases.find((entry) => entry.case_no === params.caseNo)
		const body = await request.json().catch(() => null)
		const template = drafts.find((entry) => entry.draft_no === "DRF-000124")
		return reply(createDraft(currentUser, item, body, drafts, template))
	}),
	http.get(`${base}/api/v1/str-drafts/:draftNo`, ({ params }) => {
		if (!currentUser) return unauthenticated()
		const draft = drafts.find((item) => item.draft_no === params.draftNo)
		return draft
			? HttpResponse.json(visibleStrDraft(currentUser, draft, caseOf(draft), draftActions))
			: draftNotFound()
	}),
	// S3는 BE develop(SCRUM-184 #91)과 같은 계약, S5·S6은 BE 아직 없음 — 계약서·BE str.md 모양으로 MSW가 답해요.
	...[
		["put", "revisions", saveRevision],
		["post", "verify", verifyDraft],
		["post", "submit", submitDraft],
	].map(([method, command, run]) =>
		http[method](
			`${base}/api/v1/str-drafts/:draftNo/${command}`,
			async ({ params, request }) => {
				if (!currentUser) return unauthenticated()
				const draft = drafts.find((item) => item.draft_no === params.draftNo)
				if (!draft) return draftNotFound()
				const body = await request.json().catch(() => null)
				return reply(run(currentUser, caseOf(draft), draft, body))
			},
		),
	),
	// 목록은 본문 없이, `?revision_no=`면 그 한 행의 전·후 본문(명세 4번).
	http.get(`${base}/api/v1/str-drafts/:draftNo/revisions`, ({ params, request }) => {
		if (!currentUser) return unauthenticated()
		const draft = drafts.find((item) => item.draft_no === params.draftNo)
		if (!draft) return draftNotFound()
		// 수정 이력은 제한 응답 없이 403 NOT_ASSIGNEE — 관리자도 같아요(BE ListStrRevisions, SCRUM-184 #91)
		if (!canViewStrContent(currentUser, draft))
			return HttpResponse.json(
				{
					error: {
						code: "NOT_ASSIGNEE",
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
				current_revision_no: draft.current_revision_no,
				// 목록은 본문 없이 메타만(명세 4번). ai_original은 BE ListStrRevisions처럼 SYSTEM 행.
				items: draft.revisions.map((item) => ({
					revision_no: item.revision_no,
					changed_sections: item.changed_sections,
					edited_by: item.edited_by,
					edited_at: item.edited_at,
					ai_original: item.edited_by === "SYSTEM",
				})),
			})
		// 없는 revision_no는 404 REVISION_NOT_FOUND (계약서 Q13, 11/4 채영)
		const revision = draft.revisions.find((item) => item.revision_no === Number(revisionNo))
		return revision
			? HttpResponse.json({
					draft_no: draft.draft_no,
					...revision,
					ai_original: revision.edited_by === "SYSTEM",
				})
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
