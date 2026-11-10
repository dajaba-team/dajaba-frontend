// STR 변경 API(S1·S3)의 MSW 동작. 백엔드 str 문서(BE docs/06_features/str.md)의 검사 순서를 따라요:
// 케이스 404 → version 409 CONCURRENT_UPDATE → 담당 403 NOT_ASSIGNEE → 상태 409.
import { availableActions as caseActions } from "./cases"

const fail = (status, code, message, details = {}) => ({
	status,
	body: { error: { code, message, details } },
})
const ok = (body, status = 200) => ({ status, body })
const now = () => new Date().toISOString().replace(/\.\d+Z$/, "Z")
const draftNoOf = (n) => `DRF-${String(n).padStart(6, "0")}`
const SECTION_MAX = 5000

const isAssignee = (viewer, item) => item.assignee?.login_id === viewer.login_id

function checkCase(viewer, item, version) {
	if (!item) return fail(404, "CASE_NOT_FOUND", "케이스가 없습니다")
	if (!Number.isInteger(version))
		return fail(400, "INVALID_REQUEST", "case_version 이 필요합니다")
	if (item.version !== version)
		return fail(409, "CONCURRENT_UPDATE", "케이스가 그 사이 바뀌었습니다")
	if (!isAssignee(viewer, item)) return fail(403, "NOT_ASSIGNEE", "담당자만 할 수 있습니다")
	return null
}

const canRevise = (item) =>
	item.status === "DRAFTED" ||
	(item.status === "REJECTED" && item.rejection_reason_code === "NEED_REVISION")

function checkActiveDraft(draft) {
	if (draft.status === "LOCKED") return fail(409, "DRAFT_LOCKED", "승인된 초안입니다")
	if (draft.status === "SUPERSEDED") return fail(409, "DRAFT_SUPERSEDED", "대체된 초안입니다")
	return null
}

const pushHistory = (item, action, from, to, by) =>
	item.history.unshift({
		action,
		from_status: from,
		to_status: to,
		reason_code: null,
		comment: null,
		created_by: by,
		created_at: now(),
	})

/** S2 available_actions (계약서 Q16) — 케이스 C2 규칙(cases.availableActions) + 초안 상태로. 조사역 동작만 흉내 내요. */
export function draftActions(viewer, item, draft) {
	if (!item || item.current_draft_no !== draft.draft_no || draft.status !== "ACTIVE") return []
	const base = caseActions(viewer, item)
	const actions = []
	// 검증·승인 요청·초안 있는 종료(VERIFY·SUBMIT·CLOSE_WITH_DRAFT)는 S5·S6 화면과 같이 붙여요.
	if (base.includes("GENERATE_DRAFT")) actions.push("REVISE", "REGENERATE")
	return actions
}

/** S1 POST /cases/{case_no}/str-drafts → 201 {case_no, case_status, case_version, draft_no} */
export function createDraft(viewer, item, body, drafts, template) {
	const error = checkCase(viewer, item, body?.case_version)
	if (error) return error
	if (!caseActions(viewer, item).includes("GENERATE_DRAFT"))
		return fail(409, "INVALID_CASE_TRANSITION", "지금 상태에서는 초안을 만들 수 없습니다", {
			action: "GENERATE_DRAFT",
		})
	const next = Math.max(...drafts.map((d) => Number(d.draft_no.slice(4)))) + 1
	const previous = drafts.find((d) => d.draft_no === item.current_draft_no)
	if (previous && previous.status === "ACTIVE") previous.status = "SUPERSEDED"
	const producedAt = now()
	const narrative = template.narrative.map((section) => ({ ...section }))
	const draft = {
		...template,
		assignee_login_id: item.assignee.login_id,
		draft_no: draftNoOf(next),
		generation_id: `GEN-${draftNoOf(next)}`,
		case_no: item.case_no,
		status: "ACTIVE",
		version: 1,
		produced_at: producedAt,
		narrative,
		current_revision_no: 1,
		last_rejection: null,
		latest_verification: null,
		suspicion_types: [],
		suspicion_level_branch: null,
		revisions: [
			{
				revision_no: 1,
				changed_sections: [],
				edited_by: "SYSTEM",
				edited_at: producedAt,
				narrative_before: [],
				narrative_after: narrative,
			},
		],
	}
	drafts.push(draft)
	const from = item.status
	Object.assign(item, {
		status: "DRAFTED",
		current_draft_no: draft.draft_no,
		rejection_reason_code: null,
		version: item.version + 1,
		updated_at: producedAt,
	})
	pushHistory(item, "ATTACH_DRAFT", from, "DRAFTED", viewer.login_id)
	return ok(
		{
			case_no: item.case_no,
			case_status: item.status,
			case_version: item.version,
			draft_no: draft.draft_no,
		},
		201,
	)
}

/** S3 PUT /str-drafts/{draft_no}/revisions {case_version, sections:[{section,text}]} */
export function saveRevision(viewer, item, draft, body) {
	const error = checkCase(viewer, item, body?.case_version) ?? checkActiveDraft(draft)
	if (error) return error
	if (!canRevise(item) || item.current_draft_no !== draft.draft_no)
		return fail(409, "INVALID_CASE_TRANSITION", "지금 상태에서는 고칠 수 없습니다", {
			action: "REVISE_DRAFT",
		})
	const sections = Array.isArray(body.sections) ? body.sections : []
	if (!sections.length) return fail(400, "INVALID_REQUEST", "고친 항목이 없습니다")
	const fieldErrors = {}
	sections.forEach((entry, index) => {
		const known = draft.narrative.some((section) => section.section === entry?.section)
		const text = entry?.text
		if (!known) fieldErrors[`sections[${index}].section`] = "이 초안에 없는 항목입니다"
		else if (typeof text !== "string" || !text.trim())
			fieldErrors[`sections[${index}].text`] = "빈 항목은 저장할 수 없습니다"
		else if (text.normalize("NFC").length > SECTION_MAX)
			fieldErrors[`sections[${index}].text`] = "5,000자를 넘었습니다"
	})
	if (Object.keys(fieldErrors).length)
		return fail(400, "INVALID_REQUEST", "입력 값을 확인해 주세요", fieldErrors)
	const before = draft.narrative.map((section) => ({ ...section }))
	// text만 바꾸고 cites·evidence_ids는 그대로(서버 관리).
	draft.narrative = draft.narrative.map((section) => {
		const change = sections.find((entry) => entry.section === section.section)
		return change ? { ...section, text: change.text } : section
	})
	const revisionNo = draft.current_revision_no + 1
	const editedAt = now()
	draft.revisions.unshift({
		revision_no: revisionNo,
		changed_sections: sections.map((entry) => entry.section),
		edited_by: viewer.login_id,
		edited_at: editedAt,
		narrative_before: before.filter((s) => sections.some((e) => e.section === s.section)),
		narrative_after: draft.narrative.filter((s) =>
			sections.some((e) => e.section === s.section),
		),
	})
	draft.current_revision_no = revisionNo
	draft.version += 1
	// 수정도 케이스 version을 올려요(TouchCaseForRevision). 보완 요청 반려면 DRAFTED로 되돌려요.
	const from = item.status
	if (from === "REJECTED") {
		Object.assign(item, { status: "DRAFTED", rejection_reason_code: null })
		pushHistory(item, "REOPEN_DRAFT", from, "DRAFTED", viewer.login_id)
	}
	item.version += 1
	item.updated_at = editedAt
	return ok({
		draft_no: draft.draft_no,
		revision_no: revisionNo,
		version: draft.version,
		case_version: item.version,
		case_status: item.status,
	})
}
