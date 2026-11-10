// 케이스 MSW 대역 — 계약서 v0.2 C1·C2·A1·A3·A4·A5·A6, 백엔드 CaseController(SCRUM-106)와 같은 모양.
// A6 close-with-draft(str 컨트롤러)는 백엔드가 아직 없어 CloseCase와 같은 순서로 만들었어요 〔초안〕.
// 버튼(available_actions)·오류 순서는 백엔드 CaseAction·유스케이스와 맞췄어요: 404 → version 409 → 담당 403 → 상태 409.
// 계좌는 가린 값과 account_ref만 둬요. 원본 account_key는 예시 데이터에도 넣지 않아요(01_code_rules §6-3).

const at = (minute) => `2026-11-02T01:${String(minute).padStart(2, "0")}:00Z`
const history = (action, from, to, by, minute, comment = null) => ({
	action,
	from_status: from,
	to_status: to,
	reason_code: null,
	comment,
	created_by: by,
	created_at: at(minute),
})
const user = (loginId) => ({ login_id: loginId, display_name: `예시 ${loginId}` })
const alertOf = (index) => ({
	alert_no: `ALT-20221101-00010${index + 1}`,
	rule_id: "R02_FAN_IN_24H",
	batch_date: "2022-11-01",
	window_start: "2022-10-31T00:00:00",
	window_end: "2022-11-01T00:00:00",
	reference_ts: "2022-11-01T00:00:00",
	transaction_count: 12 + index,
})
const scored = (score) => ({
	score_status: "SCORED",
	score,
	score_band: "HIGH", // 예시 정책 경계 0.9 이상
	failure_code: null,
	model_version: "xgb-2022.11",
	feature_version: "f1",
	data_quality_status: "OK",
	reasons: [],
})
const PENDING_SCORE = {
	score_status: "PENDING",
	score: null,
	score_band: null,
	failure_code: null,
	model_version: null,
	feature_version: null,
	data_quality_status: null,
	reasons: [],
}

export function seedCases() {
	return [
		{
			case_no: "CASE-2022-001001",
			status: "DRAFTED",
			account_ref: "ACR-0001",
			account_no: "010_****8842",
			assignee: user("inv01"),
			investigator_notes: "거래 목적 확인 필요",
			current_draft_no: "DRF-000124",
			rejection_reason_code: null,
			close_reason: null,
			version: 3,
			history: [
				history("ATTACH_DRAFT", "ESCALATED", "DRAFTED", "inv01", 30),
				history("ESCALATE", "REVIEWING", "ESCALATED", "inv01", 20, "STR 검토 필요"),
				history("ASSIGN", "OPEN", "REVIEWING", "inv01", 10),
				history("OPEN", null, "OPEN", "system", 0),
			],
		},
		{
			case_no: "CASE-2022-001002",
			status: "OPEN",
			account_ref: "ACR-0002",
			account_no: "020_****1109",
			assignee: null,
			investigator_notes: null,
			current_draft_no: null,
			rejection_reason_code: null,
			close_reason: null,
			version: 0,
			history: [history("OPEN", null, "OPEN", "system", 1)],
		},
		{
			case_no: "CASE-2022-001003",
			status: "APPROVED",
			account_ref: "ACR-0003",
			account_no: "010_****5521",
			assignee: user("inv01"),
			investigator_notes: null,
			current_draft_no: "DRF-000098",
			rejection_reason_code: null,
			close_reason: null,
			version: 6,
			history: [history("APPROVE", "PENDING_APPROVAL", "APPROVED", "apr01", 40)],
		},
		{
			case_no: "CASE-2022-001004",
			status: "REVIEWING",
			account_ref: "ACR-0004",
			account_no: "011_****1021",
			assignee: user("inv01"),
			investigator_notes: "거래 목적 확인 필요",
			current_draft_no: null,
			rejection_reason_code: null,
			close_reason: null,
			version: 1,
			history: [
				history("ASSIGN", "OPEN", "REVIEWING", "inv01", 12),
				history("OPEN", null, "OPEN", "system", 2),
			],
		},
	].map((item, index) => ({
		latest_score: index === 1 ? PENDING_SCORE : scored([0.94, null, 0.92, 0.91][index]),
		...item,
		alert: alertOf(index),
		created_at: at(index),
		updated_at: at(index + 10),
	}))
}

const EDITABLE = ["REVIEWING", "ESCALATED", "DRAFTED"]
const REASSIGNABLE = ["REVIEWING", "ESCALATED", "DRAFTED", "REJECTED"]

/** 백엔드 CaseAction.availableFor 와 같은 규칙. */
export function availableActions(viewer, item) {
	const actions = []
	const code = item.rejection_reason_code
	if (item.status === "OPEN" && ["INVESTIGATOR", "ADMIN"].includes(viewer.role))
		actions.push("ASSIGN")
	if (viewer.role === "ADMIN" && REASSIGNABLE.includes(item.status)) actions.push("REASSIGN")
	if (item.assignee?.login_id !== viewer.login_id) return actions
	if (EDITABLE.includes(item.status) || (item.status === "REJECTED" && code === "NEED_REVISION"))
		actions.push("UPDATE_NOTES", "REFRESH_SUMMARY")
	if (item.status === "REVIEWING") actions.push("ESCALATE")
	if (
		["REVIEWING", "ESCALATED", "DRAFTED"].includes(item.status) ||
		(item.status === "REJECTED" && code === "NOT_REPORTABLE")
	)
		actions.push(item.current_draft_no ? "CLOSE_WITH_DRAFT" : "CLOSE")
	if (
		["ESCALATED", "DRAFTED"].includes(item.status) ||
		(item.status === "REJECTED" && code === "NEED_REVISION")
	)
		actions.push("GENERATE_DRAFT")
	return actions
}

const summaryOf = (item) => ({
	case_no: item.case_no,
	status: item.status,
	account_ref: item.account_ref,
	account_no: item.account_no,
	entity_id: null,
	assignee: item.assignee,
	score: null,
	score_band: null,
	policy_version: null,
	rejection_reason_code: item.rejection_reason_code,
	version: item.version,
	created_at: item.created_at,
})

export function listResponse(items, url) {
	const statuses = url.searchParams.get("status")?.split(",").filter(Boolean) ?? []
	const assignee = url.searchParams.get("assignee")
	const page = Number(url.searchParams.get("page") ?? 0)
	const size = Number(url.searchParams.get("size") ?? 20)
	const filtered = items.filter(
		(item) =>
			(!statuses.length || statuses.includes(item.status)) &&
			(!assignee || item.assignee?.login_id === assignee),
	)
	return {
		items: filtered.slice(page * size, (page + 1) * size).map(summaryOf),
		page,
		size,
		total: filtered.length,
	}
}

export function detailResponse(viewer, item) {
	// 맨 위 score·score_band·policy_version은 계약서 Q2 MVP대로 latest_score와 같은 값 (BE GetCaseDetail)
	const latest = item.latest_score ?? null
	return {
		...summaryOf(item),
		score: latest?.score ?? null,
		score_band: latest?.score_band ?? null,
		policy_version: latest?.score_band ? "mock-policy" : null,
		updated_at: item.updated_at,
		alert: item.alert ?? null,
		customer: null,
		investigator_notes: item.investigator_notes,
		close_reason: item.close_reason,
		latest_score: item.latest_score ?? null,
		aggregates: null,
		latest_summary: null,
		current_draft_no: item.current_draft_no,
		current_draft: null,
		prior_alerts: [],
		history: item.history.slice(0, 20),
		available_actions: availableActions(viewer, item),
	}
}

/** 메모 이력(C8) — 최신 먼저, 페이지 밖 직전 메모도 before_text 로 (BE ListCaseNoteHistories). */
export function noteHistoriesResponse(item, url) {
	const page = Number(url.searchParams.get("page") ?? 0)
	const size = Number(url.searchParams.get("size") ?? 20)
	const all = item.note_histories ?? []
	return { items: all.slice(page * size, (page + 1) * size), page, size, total: all.length }
}

export const changeResponse = (item) => ({
	case_no: item.case_no,
	status: item.status,
	assignee: item.assignee,
	rejection_reason_code: item.rejection_reason_code,
	current_draft_no: item.current_draft_no,
	version: item.version,
	updated_at: item.updated_at,
})

const fail = (status, code, message) => ({
	status,
	body: { error: { code, message, details: {} } },
})
const blank = (text) => typeof text !== "string" || !text.trim() || text.length > 2000

/**
 * 변경 요청 하나를 적용해요. 성공이면 { item }, 실패면 { status, body }.
 * users는 login_id → 사용자(배정 대상 확인용).
 */
export function applyCommand(viewer, item, command, body, users) {
	if (!item) return fail(404, "CASE_NOT_FOUND", "케이스가 없습니다")
	if (!Number.isInteger(body?.version))
		return fail(400, "INVALID_REQUEST", "version 이 필요합니다")
	if (command === "escalate" && blank(body.comment))
		return fail(400, "INVALID_REQUEST", "사유를 입력해 주세요")
	if (
		(command === "close" || command === "close-with-draft") &&
		(blank(body.comment) ||
			!["FALSE_POSITIVE", "DUPLICATE", "NO_ACTION"].includes(body.close_reason))
	)
		return fail(400, "INVALID_REQUEST", "종료 사유와 설명을 입력해 주세요")
	if (
		command === "notes" &&
		(typeof body.investigator_notes !== "string" || body.investigator_notes.length > 10000)
	)
		return fail(400, "INVALID_REQUEST", "메모는 10,000자 이하로 입력해 주세요")
	if (body.version !== item.version)
		return fail(409, "CONCURRENT_UPDATE", "다른 사용자가 먼저 수정했습니다. 새로 고침하세요")
	const now = new Date(Date.UTC(2026, 10, 2, 2, item.version)).toISOString().replace(".000", "")
	const move = (action, to, comment = null) => {
		item.history = [
			history(action, item.status, to, viewer.login_id, 0, comment),
			...item.history,
		]
		item.history[0].created_at = now
		item.status = to
	}
	if (command === "assign") {
		const target = viewer.role === "ADMIN" ? body.assignee : (body.assignee ?? viewer.login_id)
		if (viewer.role !== "ADMIN" && target !== viewer.login_id)
			return fail(409, "INVALID_ASSIGNEE", "본인에게만 배정할 수 있습니다")
		const assignee = users[target]
		if (!assignee) return fail(404, "USER_NOT_FOUND", "사용자가 없습니다")
		if (assignee.role !== "INVESTIGATOR")
			return fail(409, "INVALID_ASSIGNEE", "조사역만 배정할 수 있습니다")
		if (item.status !== "OPEN")
			return fail(409, "INVALID_CASE_TRANSITION", "지금 상태에서 배정할 수 없습니다")
		item.assignee = user(target)
		move("ASSIGN", "REVIEWING")
	} else {
		if (item.assignee?.login_id !== viewer.login_id)
			return fail(403, "NOT_ASSIGNEE", "담당 조사역만 할 수 있습니다")
		if (command === "notes") {
			if (!availableActions(viewer, item).includes("UPDATE_NOTES"))
				return fail(409, "INVALID_CASE_TRANSITION", "지금 상태에서 메모를 고칠 수 없습니다")
			// 같은 내용(메모가 없을 때 빈 문자열 포함)이면 그대로 — version 안 오름 (BE UpdateCaseNotes)
			if (body.investigator_notes === (item.investigator_notes ?? "")) return { item }
			item.note_histories = [
				{
					before_text: item.investigator_notes ?? null,
					after_text: body.investigator_notes,
					case_version_before: item.version,
					created_by: viewer.login_id,
					created_at: now,
				},
				...(item.note_histories ?? []),
			]
			item.investigator_notes = body.investigator_notes
		} else if (command === "escalate") {
			if (item.status !== "REVIEWING")
				return fail(
					409,
					"INVALID_CASE_TRANSITION",
					"조사 중에만 에스컬레이션할 수 있습니다",
				)
			move("ESCALATE", "ESCALATED", body.comment)
		} else if (command === "close" || command === "close-with-draft") {
			const closable =
				["REVIEWING", "ESCALATED", "DRAFTED"].includes(item.status) ||
				(item.status === "REJECTED" && item.rejection_reason_code === "NOT_REPORTABLE")
			if (!closable)
				return fail(409, "INVALID_CASE_TRANSITION", "지금 상태에서 종료할 수 없습니다")
			if (command === "close" && item.current_draft_no)
				return fail(
					409,
					"CLOSE_REQUIRES_STR",
					"초안이 있는 케이스는 close-with-draft 로 종료합니다",
				)
			if (command === "close-with-draft" && !item.current_draft_no)
				return fail(
					409,
					"INVALID_CASE_TRANSITION",
					"초안이 없는 케이스는 close 로 종료합니다",
				)
			item.close_reason = body.close_reason
			move("CLOSE", "CLOSED", body.comment)
		}
	}
	item.version += 1
	item.updated_at = now
	return { item }
}
