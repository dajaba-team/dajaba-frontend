// 승인함 API(P1 목록·P2 승인·P3 반려)의 MSW 동작 — BE ApprovalController·ListPendingApprovals(SCRUM-217~219)와 같은 모양.
// 검사 순서(BE str.md): 역할 403 → 초안 404 → version 409 CONCURRENT_UPDATE → 대체된 초안 409 DRAFT_SUPERSEDED
// → 상태 409 INVALID_CASE_TRANSITION → 지금·예전 담당 409 SELF_APPROVAL → (승인) 최신 검증 통과 409 DRAFT_NOT_VERIFIED.
const fail = (status, code, message, details = {}) => ({
	status,
	body: { error: { code, message, details } },
})
const ok = (body, status = 200) => ({ status, body })
const now = () => new Date().toISOString().replace(/\.\d+Z$/, "Z")
const COMMENT_MAX = 2000
const REASON_CODES = ["NEED_REVISION", "NOT_REPORTABLE"]

// 지금 담당이거나 예전에 담당했던 사람(BE WasCaseAssignee) — MSW 이력엔 담당자 칸이 없어 ASSIGN·REASSIGN 행의 작성자로 봐요.
export function wasAssignee(viewer, item) {
	if (item.assignee?.login_id === viewer.login_id) return true
	return item.history.some(
		(row) => ["ASSIGN", "REASSIGN"].includes(row.action) && row.created_by === viewer.login_id,
	)
}

const submittedAt = (item) =>
	item.history.find((row) => row.action === "SUBMIT_FOR_APPROVAL")?.created_at ?? item.updated_at

/** P1 `GET /approvals` — 승인 대기만, 요청 오래된 순, 본문 없음. ADMIN 은 조회만(available_actions []). */
export function listApprovals(viewer, cases, drafts, url) {
	if (!["APPROVER", "ADMIN"].includes(viewer.role))
		return fail(403, "FORBIDDEN", "권한이 없습니다")
	const page = Number(url.searchParams.get("page") ?? 0)
	const size = Number(url.searchParams.get("size") ?? 20)
	const pending = cases
		.filter((item) => item.status === "PENDING_APPROVAL")
		.sort((a, b) => submittedAt(a).localeCompare(submittedAt(b)))
	const items = pending.slice(page * size, page * size + size).map((item) => {
		const draft = drafts.find((entry) => entry.draft_no === item.current_draft_no)
		const verification = draft?.latest_verification
		const was = wasAssignee(viewer, item)
		return {
			draft_no: item.current_draft_no,
			case_no: item.case_no,
			assignee: item.assignee,
			submitted_at: submittedAt(item),
			verification: verification
				? {
						verification_id: verification.verification_id,
						revision_no: verification.revision_no,
						status: verification.status,
						passed: verification.passed,
					}
				: null,
			last_rejection: draft?.last_rejection ?? null,
			case_version: item.version,
			was_assignee: was,
			available_actions: viewer.role === "APPROVER" && !was ? ["APPROVE", "REJECT"] : [],
		}
	})
	return ok({ items, page, size, total: pending.length })
}

// 승인·반려 공통 앞부분 — 역할 → version → 대체된 초안 → 상태 → 자기 승인.
function check(viewer, item, draft, body) {
	if (viewer.role !== "APPROVER") return fail(403, "FORBIDDEN", "권한이 없습니다")
	if (!Number.isInteger(body?.case_version))
		return fail(400, "INVALID_REQUEST", "입력 값을 확인해 주세요", {
			case_version: "필수입니다",
		})
	if (item.version !== body.case_version)
		return fail(409, "CONCURRENT_UPDATE", "케이스가 그 사이 바뀌었습니다")
	if (item.current_draft_no && item.current_draft_no !== draft.draft_no)
		return fail(409, "DRAFT_SUPERSEDED", "대체된 초안입니다", {
			draft_no: draft.draft_no,
			current_draft_no: item.current_draft_no,
		})
	if (item.status !== "PENDING_APPROVAL")
		return fail(409, "INVALID_CASE_TRANSITION", "승인 대기 상태가 아닙니다", {
			draft_no: draft.draft_no,
		})
	if (wasAssignee(viewer, item))
		return fail(409, "SELF_APPROVAL", "본인이 담당한 케이스는 승인할 수 없습니다")
	return null
}

const changeOf = (item) => ({
	case_no: item.case_no,
	status: item.status,
	assignee: item.assignee,
	rejection_reason_code: item.rejection_reason_code ?? null,
	current_draft_no: item.current_draft_no,
	version: item.version,
	updated_at: item.updated_at,
})

function record(item, action, to, viewer, reasonCode = null, comment = null) {
	const from = item.status
	Object.assign(item, { status: to, version: item.version + 1, updated_at: now() })
	item.history.unshift({
		action,
		from_status: from,
		to_status: to,
		reason_code: reasonCode,
		comment,
		created_by: viewer.login_id,
		created_at: item.updated_at,
	})
}

/** P2 `POST /approvals/{draft_no}/approve {case_version, suspicion_level_hq}` — 초안 LOCKED, 케이스 APPROVED. */
export function approveDraft(viewer, item, draft, body) {
	const error = check(viewer, item, draft, body)
	if (error) return error
	const latest = draft.latest_verification
	if (!latest || latest.revision_no !== draft.current_revision_no || latest.status !== "PASSED")
		return fail(409, "DRAFT_NOT_VERIFIED", "지금 본문을 통과한 검증이 없습니다")
	const level = body.suspicion_level_hq
	if (!Number.isInteger(level) || level < 1 || level > 5)
		return fail(400, "INVALID_REQUEST", "입력 값을 확인해 주세요", {
			suspicion_level_hq: "1~5 중 선택해 주세요",
		})
	draft.suspicion_level_hq = level
	draft.status = "LOCKED"
	draft.case_status = "APPROVED"
	record(item, "APPROVE", "APPROVED", viewer)
	return ok(changeOf(item))
}

/** P3 `POST /approvals/{draft_no}/reject {case_version, reason_code, comment}` — 초안은 ACTIVE 그대로. */
export function rejectDraft(viewer, item, draft, body) {
	const fieldErrors = {}
	if (!REASON_CODES.includes(body?.reason_code))
		fieldErrors.reason_code = "NEED_REVISION 또는 NOT_REPORTABLE"
	const comment = typeof body?.comment === "string" ? body.comment : ""
	if (!comment.trim() || comment.length > COMMENT_MAX)
		fieldErrors.comment = "1~2,000자로 입력해 주세요"
	if (viewer.role === "APPROVER" && Object.keys(fieldErrors).length)
		return fail(400, "INVALID_REQUEST", "입력 값을 확인해 주세요", fieldErrors)
	const error = check(viewer, item, draft, body)
	if (error) return error
	item.rejection_reason_code = body.reason_code
	record(item, "REJECT", "REJECTED", viewer, body.reason_code, comment)
	draft.case_status = "REJECTED"
	draft.last_rejection = { reason_code: body.reason_code, comment, decided_at: item.updated_at }
	// 같은 초안으로 본문을 안 고치고 다시 올리면 S6 이 409 NARRATIVE_UNCHANGED (strCommands.submitDraft)
	draft.rejected_narrative = draft.narrative.map((section) => ({ ...section }))
	return ok(changeOf(item))
}

/**
 * 시연·테스트용 — 케이스 1001(DRF-000124)을 검증 통과 + 승인 대기로 바꿔요. inv01 이 담당, apr01 이 승인할 차례.
 * 기본 시드(케이스 4건)를 바꾸면 다른 화면 테스트가 깨져서 따로 둬요.
 */
export function seedPendingApproval(cases, drafts) {
	const item = cases.find((entry) => entry.case_no === "CASE-2022-001001")
	const draft = drafts.find((entry) => entry.draft_no === item.current_draft_no)
	draft.latest_verification = {
		...draft.latest_verification,
		passed: true,
		status: "PASSED",
		revision_no: draft.current_revision_no,
		code_checks: draft.latest_verification.code_checks.map((row) => ({
			...row,
			match: true,
			reason: null,
		})),
		llm_checks: [],
	}
	record(item, "SUBMIT_FOR_APPROVAL", "PENDING_APPROVAL", { login_id: "inv01" })
	draft.case_status = "PENDING_APPROVAL"
}
