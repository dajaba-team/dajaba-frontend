// STR API 명세 1·2·4·5번 응답 예시를 옮긴 MSW 시드예요. 필드 이름·타입을 지어내지 않아요.
// 번호는 `draft_no`, 열람 구분은 `access`, 검증 결과는 계약서 S5(AI 응답 그대로) 모양 — 11/4 #기획 계약서 스레드.
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
// facts는 AI facts 그대로 넘어와요(계약서 Q15). AI 리포 contracts/examples/draft_response.json의
// facts를 그대로 옮겼어요(규약 §6.4 — 양쪽 계약 예시가 같은 파일). 통화는 ISO 코드(USD)예요.
// 본문(narrative)은 STR API 명세 예시라 facts 값과 맞지 않아요 — 시드 본문은 열람 제한 확인용이에요.
export const AI_FACTS_EXAMPLE = {
	reporting_institution: "Portugal Bank #4507",
	subject: {
		entity_id: "80062E240",
		entity_name: "Sole Proprietorship #50438",
		entity_type: "SOLE_PROPRIETORSHIP",
		account_key: "010_8000EBD30",
	},
	period: {
		start: "2022-09-02T00:14:00",
		end: "2022-09-02T22:51:00",
	},
	inbound: {
		count: 3,
		by_currency: [
			{
				currency: "USD",
				total: "42750.50",
				count: 3,
				transaction_ids: [104221, 104233, 104301],
			},
		],
		transaction_ids: [104221, 104233, 104301],
	},
	outbound: {
		count: 0,
		by_currency: [],
		transaction_ids: [],
	},
	internal: {
		count: 0,
		transaction_ids: [],
	},
	indirect: {
		count: 0,
		transaction_ids: [],
	},
	paths: null,
	excluded_self_transfer_count: 0,
	direction: "INBOUND",
	counterparties: {
		count: 3,
		transaction_ids: [104221, 104233, 104301],
	},
	counterparty_banks: {
		same_bank_accounts: 0,
		other_bank_accounts: 3,
	},
	payment_formats: ["ACH"],
	payment_format_counts: [
		{
			format: "ACH",
			count: 3,
		},
	],
	amount_range: [
		{
			currency: "USD",
			min: "12500.00",
			max: "16800.50",
		},
	],
	typology: "FAN_IN",
	typology_source: "RULE",
	customer: {
		industry: "RETAIL",
		risk_level: "LOW",
		account_purpose: "SALES_DEPOSIT",
		onboarded_at: "2021-03-14",
		country_code: "PT",
	},
	prior_alert_count: 1,
	observations: [
		{
			name: "account_in_counterparties_24h",
			value: 3,
			unit: "count",
			window_start: "2022-09-02T00:00:00",
			window_end: "2022-09-03T00:00:00",
			basis: "distinct_inbound_counterparties",
			baseline: null,
		},
	],
	model_signals: ["account_in_counterparties_24h"],
	unmapped_currencies: [],
}
const codeCheck = (check, section, draftValue, sourceValue) => ({
	check,
	section,
	draft_value: draftValue,
	source_value: sourceValue,
	match: true,
	reason: null,
})
const llmCheck = (check, score) => ({ check, comment: "예시 코멘트", score })

export function seedStrDrafts() {
	return [
		{
			assignee_login_id: "inv01",
			draft_no: "DRF-000123",
			access: "FULL",
			generation_id: "GEN-예시",
			case_no: "CASE-2022-000057",
			case_status: "DRAFTED",
			case_version: 6,
			status: "ACTIVE",
			version: 1,
			generator_version: "str-gen-0.2.0",
			produced_at: "2026-10-21T10:15:02Z",
			facts: AI_FACTS_EXAMPLE,
			narrative: [instrument, method(METHOD_AFTER)],
			current_revision_no: 2,
			// 11/4 채영이 S2에 더한 키. 값은 시드에 없는 정보라 비워 둬요(지어내지 않음, 계약서 2.3 null 규칙).
			last_rejection: null,
			suspicion_types: [],
			suspicion_types_recommended: [],
			suspicion_level_branch: null,
			suspicion_level_hq: null,
			available_actions: [],
			report: null,
			references: null,
			latest_verification: {
				verification_id: "VRF-a71f02",
				draft_no: "DRF-000123",
				generation_id: "GEN-예시",
				revision_no: 2,
				narrative_sha256: "예시-해시",
				is_current: true,
				passed: true,
				status: "PASSED",
				verifier_version: "str-verify-0.1.0",
				produced_at: "2026-10-21T10:22:31Z",
				// 검사 이름·필드는 계약서 S5 그대로, 값은 이 시드 본문에 맞춘 예시예요.
				code_checks: [
					codeCheck("AMOUNT_MATCH", "INSTRUMENT", "3억 2천만 원", "320000000"),
					codeCheck("DATE_MATCH", "METHOD", "2022-09-02", "2022-09-02"),
					codeCheck("COUNT_MATCH", "INSTRUMENT", "47", "47"),
					codeCheck("ACCOUNT_ID_MATCH", "INSTRUMENT", null, null),
					codeCheck("EVIDENCE_IN_SCOPE", "METHOD", null, null),
				],
				llm_checks: [
					llmCheck("FIVE_W_ONE_H_COMPLETE", 4),
					llmCheck("TYPOLOGY_CONSISTENT", 5),
					llmCheck("NO_UNSUPPORTED_CLAIM", 4),
					llmCheck("NO_SPECULATION", 5),
					llmCheck("NO_INSTRUCTION_TEXT", 5),
				],
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

// 관리자·비담당 조사역은 `access: "META_ONLY"`로 상태·날짜만(11/3 결정, 11/4 채영 필드 확정).
// 허용 필드만 골라 만들어 본문 필드가 새로 생겨도 새지 않게 하고, 본문 키는 빼지 않고 null로 줘요(계약서 2.3).
export function visibleStrDraft(user, draft) {
	if (!canViewStrContent(user, draft))
		return {
			draft_no: draft.draft_no,
			case_no: draft.case_no,
			status: draft.status,
			case_status: draft.case_status,
			produced_at: draft.produced_at,
			access: "META_ONLY",
			facts: null,
			narrative: null,
			latest_verification: null,
			last_rejection: null,
			references: null,
		}
	// eslint-disable-next-line no-unused-vars
	const { assignee_login_id, revisions, ...body } = draft
	return body
}
