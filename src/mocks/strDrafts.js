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
		// 케이스 1001의 지금 초안 — 서술부 7항목(narrative_v2, 11/6부터 새 초안). 본문은 AI_FACTS_EXAMPLE 값에 맞춘 예시예요.
		// label은 null로 둬서 프론트 제목 표(sectionTitles)로 보이는지 확인해요.
		aiOriginalDraft({
			draft_no: "DRF-000124",
			case_no: "CASE-2022-001001",
			case_status: "DRAFTED",
			status: "ACTIVE",
			generator_version: "str-gen-0.2.0+narrative_v2",
			produced_at: "2026-11-05T11:30:00Z",
			narrative: NARRATIVE_V2,
			// 코드 검사 실패 예시(SCRUM-116) — 날짜 한 곳 못 읽음·한 곳 빠짐, 건수 검사 줄 없음(SCRUM-60 전), AI 평가 안 함(null).
			latest_verification: {
				verification_id: "VRF-b20c11",
				draft_no: "DRF-000124",
				generation_id: "GEN-DRF-000124",
				revision_no: 1,
				narrative_sha256: "예시-해시-124",
				is_current: true,
				passed: false,
				status: "CODE_FAILED",
				verifier_version: "str-verify-0.1.0",
				produced_at: "2026-11-05T11:32:10Z",
				code_checks: [
					codeCheck("AMOUNT_MATCH", "INSTRUMENT", "USD 42,750.50", "42750.50"),
					codeCheck("DATE_MATCH", "DATE", "2022-09-02", "2022-09-02"),
					{
						...codeCheck("DATE_MATCH", "METHOD", "9월 초", "2022-09-02"),
						match: false,
						reason: "UNPARSED",
					},
					{
						...codeCheck("DATE_MATCH", "GROUNDS", null, "2022-09-02"),
						match: false,
						reason: "MISSING",
					},
					codeCheck("ACCOUNT_ID_MATCH", "SUBJECT", "010_8000EBD30", "010_8000EBD30"),
					codeCheck("EVIDENCE_IN_SCOPE", "INSTRUMENT", null, null),
				],
				llm_checks: null,
			},
		}),
		// 케이스 1003의 승인본 — 옛 6섹션(narrative_v1). 7항목 전환 뒤에도 그대로 남아 보여야 해요.
		aiOriginalDraft({
			draft_no: "DRF-000098",
			case_no: "CASE-2022-001003",
			case_status: "APPROVED",
			status: "LOCKED",
			generator_version: "str-gen-0.1.0",
			produced_at: "2026-10-30T09:00:00Z",
			narrative: NARRATIVE_V1,
		}),
	]
}

const v2 = (section, text, evidenceIds = []) => ({
	section,
	label: null,
	text,
	evidence_ids: evidenceIds,
})
const NARRATIVE_V2 = [
	v2(
		"SUBJECT",
		"개인사업자 Sole Proprietorship #50438(소매업, 위험등급 낮음) 명의 계좌 010_8000EBD30.",
	),
	v2("DATE", "2022-09-02 00:14 ~ 22:51, 하루 동안.", [104221, 104301]),
	v2("PLACE", "보고 기관 Portugal Bank #4507. 보낸 쪽 3개 계좌는 모두 타행이에요."),
	v2("INSTRUMENT", "ACH 이체 3건, 합계 USD 42,750.50.", [104221, 104233, 104301]),
	v2(
		"METHOD",
		"서로 다른 3개 계좌가 하루 안에 한 계좌로 입금(FAN_IN).\n건당 USD 12,500.00 ~ 16,800.50.",
		[104221, 104233, 104301],
	),
	v2(
		"GROUNDS",
		"평소 매출 입금 계좌인데 처음 보는 상대 3곳에서 짧은 시간에 몰려 들어옴. 이전 경보 1건.",
	),
	v2("OPINION", "자금 출처 확인이 필요해 보여요. 최종 판단은 담당 조사역이 해요."),
]
const v1 = (section, text, evidenceIds = []) => ({ section, text, evidence_ids: evidenceIds })
const NARRATIVE_V1 = [
	v1("SUMMARY", "대상 계좌에 하루 동안 타행 3개 계좌에서 ACH 입금 3건."),
	v1("WHO", "개인사업자 Sole Proprietorship #50438."),
	v1("WHAT_WHEN_WHERE", "2022-09-02, Portugal Bank #4507 계좌로 USD 42,750.50.", [104221]),
	v1("HOW", "여러 계좌에서 한 계좌로 모이는 입금.", [104221, 104233, 104301]),
	v1("WHY_SUSPICIOUS", "평소 거래 상대가 아닌 계좌에서 짧은 시간에 몰려 들어옴."),
	v1("CONCLUSION", "의심거래로 보고가 필요해 보여요."),
]

// AI 원문(수정본 1번)만 있는 초안. 키는 위 DRF-000123과 같은 S2 모양이에요.
function aiOriginalDraft({ narrative, ...fields }) {
	return {
		assignee_login_id: "inv01",
		access: "FULL",
		generation_id: `GEN-${fields.draft_no}`,
		case_version: 3,
		version: 1,
		facts: AI_FACTS_EXAMPLE,
		narrative,
		current_revision_no: 1,
		last_rejection: null,
		suspicion_types: [],
		suspicion_types_recommended: [],
		suspicion_level_branch: null,
		suspicion_level_hq: null,
		available_actions: [],
		report: null,
		references: null,
		latest_verification: null,
		revisions: [
			{
				revision_no: 1,
				changed_sections: [],
				edited_by: "SYSTEM",
				edited_at: fields.produced_at,
				narrative_before: [],
				narrative_after: narrative,
			},
		],
		...fields,
	}
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
// item(케이스)이 있으면 케이스 상태·version·available_actions·is_current를 그때그때 계산해 넣어요(S3·S5·S6 뒤에도 맞게).
export function visibleStrDraft(user, draft, item = null, actionsOf = null) {
	const caseStatus = item?.current_draft_no === draft.draft_no ? item.status : draft.case_status
	if (!canViewStrContent(user, draft))
		return {
			draft_no: draft.draft_no,
			case_no: draft.case_no,
			status: draft.status,
			case_status: caseStatus,
			produced_at: draft.produced_at,
			access: "META_ONLY",
			facts: null,
			narrative: null,
			latest_verification: null,
			last_rejection: null,
			references: null,
		}
	// eslint-disable-next-line no-unused-vars
	const { assignee_login_id, revisions, rejected_narrative, ...body } = draft
	const verification = draft.latest_verification
	return {
		...body,
		case_status: caseStatus,
		case_version: item ? item.version : draft.case_version,
		available_actions:
			item && actionsOf ? actionsOf(user, item, draft) : draft.available_actions,
		latest_verification: verification
			? {
					...verification,
					// BE GetStrDraft처럼 늘 지금 수정본 번호로 계산해요 — 시드에 적힌 값은 저장 뒤 틀려져요.
					is_current: verification.revision_no === draft.current_revision_no,
				}
			: null,
	}
}
