// STR API 명세 1·2·4·5번 응답 예시를 그대로 옮긴 MSW 시드예요. 필드 이름·타입을 지어내지 않아요.
// `assignee_login_id`·`revisions`는 MSW 내부 판단용이라 응답에 넣지 않아요.
const INSTRUMENT_TEXT =
	"24시간 동안 31개 계좌로부터 ACH 입금 47건, 합계 3억 2천만 원 상당이 들어옴."
const METHOD_BEFORE = "9월 3일 입금 후 평균 1.8시간 만에 95%가 타행 두 계좌로 빠져나감."
const METHOD_AFTER = "9월 2일 입금 후 평균 1.8시간 만에 95%가 타행 두 계좌로 빠져나감."
const instrument = {
	section: "INSTRUMENT",
	text: INSTRUMENT_TEXT,
	evidence_ids: [5120331, 5120347, 5120402],
}
const method = (text) => ({ section: "METHOD", text, evidence_ids: [5121008, 5121011] })

export function seedStrDrafts() {
	return [
		{
			assignee_login_id: "inv01",
			draft_id: "DRF-3b81e2",
			generation_id: "GEN-예시",
			case_no: "CASE-2022-000057",
			case_status: "DRAFTED",
			case_version: 6,
			status: "ACTIVE",
			version: 1,
			generator_version: "str-gen-0.2.0",
			produced_at: "2026-10-21T10:15:02Z",
			facts: {
				account_no_masked: "****9D80",
				window_start: "2022-09-02T00:00:00",
				window_end: "2022-09-03T00:00:00",
				inbound_count: 47,
				distinct_senders: 31,
				total_amount: 320000000,
				currency: "KRW",
				typology: "FAN_IN_THEN_FAN_OUT",
			},
			narrative: [instrument, method(METHOD_AFTER)],
			current_revision_no: 2,
			latest_verification: {
				verification_id: "VRF-a71f02",
				draft_id: "DRF-3b81e2",
				generation_id: "GEN-예시",
				revision_no: 2,
				narrative_sha256: "예시-해시",
				is_current: true,
				passed: true,
				status: "PASSED",
				verifier_version: "str-verify-0.1.0",
				produced_at: "2026-10-21T10:22:31Z",
				code_checks: [
					{ section: "INSTRUMENT", result: "PASS", message: null },
					{ section: "METHOD", result: "PASS", message: null },
				],
				llm_checks: [{ section: "METHOD", result: "PASS", message: null }],
			},
			revisions: [
				{
					revision_no: 2,
					changed_sections: ["METHOD"],
					edited_by: "inv01",
					edited_at: "2026-10-21T10:21:40Z",
					narrative_before: [method(METHOD_BEFORE)],
					narrative_after: [method(METHOD_AFTER)],
				},
				{
					revision_no: 1,
					changed_sections: [],
					edited_by: "SYSTEM",
					edited_at: "2026-10-21T10:15:02Z",
					narrative_before: [],
					narrative_after: [instrument, method(METHOD_BEFORE)],
				},
			],
		},
	]
}

// 본문은 담당 조사역과 승인자만(FR-APR-02, 권한 매트릭스 14번). ADMIN은 조사역·승인자 권한을 물려받지 않아요.
export function canViewStrContent(user, draft) {
	return (
		user?.role === "APPROVER" ||
		(user?.role === "INVESTIGATOR" && user.login_id === draft.assignee_login_id)
	)
}

// 관리자·비담당 조사역은 상태·날짜만(11/3 확정). 허용 필드만 골라 만들어 본문 필드가 새로 생겨도 새지 않게 해요.
// TODO(SCRUM-110): 제한 응답의 필드 목록과 `content_visible` 이름은 명세에 없음 — 채영님과 확인 필요
export function visibleStrDraft(user, draft) {
	if (!canViewStrContent(user, draft))
		return {
			draft_id: draft.draft_id,
			case_no: draft.case_no,
			status: draft.status,
			case_status: draft.case_status,
			produced_at: draft.produced_at,
			content_visible: false,
		}
	// eslint-disable-next-line no-unused-vars
	const { assignee_login_id, revisions, ...body } = draft
	return { ...body, content_visible: true }
}
