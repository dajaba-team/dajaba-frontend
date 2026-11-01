// 개발용 합성 데이터 시연입니다. 실제 API·세션·운영 enum과 분리합니다.
import { users, initialDb } from "./fixtures"
import { ApiError } from "./DemoApiError"
const now = () => new Date().toISOString()
const wait = (ms = 260) => new Promise((resolve) => setTimeout(resolve, ms))
// 일부 409 세부 코드는 명세의 제안 상태이므로 실제 연동 전 서버 계약 확인이 필요합니다.
const error = (status, code, message, details = {}) => {
	throw new ApiError(status, {
		error: {
			code,
			message,
			details,
		},
	})
}
export class DashboardDemoApi {
	db = initialDb()
	verificationUnavailable = false
	currentUser(role) {
		return users[role]
	}
	snapshot() {
		return structuredClone(this.db)
	}
	async reset() {
		await wait(100)
		this.db = initialDb()
		this.verificationUnavailable = false
		return this.snapshot()
	}
	requireRole(role, expected) {
		if (role !== expected) error(403, "FORBIDDEN", `${expected} 권한이 필요한 작업입니다.`)
	}
	history(category, title, detail, actor) {
		this.db.histories.unshift({
			id: `H-${Date.now()}`,
			category,
			title,
			detail,
			actor,
			occurred_at: now(),
		})
	}
	async runBatch(role, type, date) {
		this.requireRole(role, "ADMIN")
		await wait()
		const existing = this.db.batches.find(
			(item) => item.type === type && item.batch_date === date && item.status === "SUCCEEDED",
		)
		if (existing)
			error(409, "BATCH_ALREADY_DONE", "이미 성공한 배치입니다.", {
				batch_run_id: existing.batch_run_id,
			})
		const prerequisites = {
			RULE_SCAN: "LOAD",
			SCORE: "RULE_SCAN",
			SCORE_RETRY: "SCORE",
			OPEN_CASES: "SCORE",
		}
		const required = prerequisites[type]
		if (
			required &&
			!this.db.batches.some((item) => item.type === required && item.status === "SUCCEEDED")
		) {
			error(409, "INVALID_BATCH_SEQUENCE", `${required} 단계 성공 후 실행할 수 있습니다.`)
		}
		if (
			type === "SCORE_RETRY" &&
			!this.db.alerts.some((item) => item.score_status === "FAILED")
		) {
			error(409, "NO_FAILED_SCORES", "재처리할 점수 실패 경보가 없습니다.")
		}
		const run = {
			batch_run_id: `BAT-${type}-${Date.now().toString().slice(-6)}`,
			batch_date: date,
			type,
			status: "SUCCEEDED",
			started_at: now(),
			ended_at: now(),
			input_count: type === "LOAD" ? 18420 : type === "RULE_SCAN" ? 18420 : 3,
			output_count: type === "RULE_SCAN" ? 3 : type === "OPEN_CASES" ? 1 : 2,
			failed_count: type === "SCORE" ? 1 : 0,
			error_message:
				type === "SCORE"
					? "배치는 성공했으나 경보 1건의 AI 점수 요청이 실패했습니다."
					: null,
		}
		if (type === "SCORE_RETRY") {
			this.db.alerts = this.db.alerts.map((item) =>
				item.score_status === "FAILED"
					? {
							...item,
							score_status: "SCORED",
							score: 0.82,
							score_band: "HIGH",
							prediction_id: "PRD-RETRY-143",
						}
					: item,
			)
		}
		if (type === "OPEN_CASES") {
			this.db.alerts = this.db.alerts.map((item) =>
				item.alert_no === "ALT-20220902-000142"
					? {
							...item,
							case_opened: true,
						}
					: item,
			)
		}
		this.db.batches.unshift(run)
		this.history("CASE", `${type} 배치 완료`, run.batch_run_id, "admin01")
		return this.snapshot()
	}
	async updateRule(role, ruleId, version, threshold, reason) {
		this.requireRole(role, "ADMIN")
		await wait()
		const target = this.db.rules.find((item) => item.rule_id === ruleId)
		if (!target) error(404, "RULE_NOT_FOUND", "룰을 찾을 수 없습니다.")
		const currentRule = target
		if (currentRule.version !== version)
			error(409, "CONCURRENT_UPDATE", "다른 사용자가 먼저 룰을 수정했습니다.", {
				latest_version: currentRule.version,
			})
		currentRule.threshold = threshold
		currentRule.version += 1
		currentRule.updated_at = now()
		currentRule.updated_by = "admin01"
		this.history("CASE", "탐지 룰 기준 변경", `${ruleId} · ${reason}`, "admin01")
		return this.snapshot()
	}
	case() {
		return this.db.cases[0]
	}
	requireOwner(role) {
		this.requireRole(role, "INVESTIGATOR")
		if (this.case().assignee_id !== users.INVESTIGATOR.user_id)
			error(403, "CASE_ASSIGNEE_REQUIRED", "담당 조사역만 실행할 수 있습니다.")
	}
	async assign(role) {
		this.requireRole(role, "INVESTIGATOR")
		await wait()
		const item = this.case()
		if (item.status !== "OPEN")
			error(409, "INVALID_CASE_TRANSITION", "OPEN 케이스만 배정할 수 있습니다.")
		item.assignee_id = "inv01"
		item.status = "REVIEWING"
		item.version += 1
		this.history("CASE", "담당 조사역 배정", "OPEN → REVIEWING", "inv01")
		return this.snapshot()
	}
	async saveNote(role, note) {
		this.requireOwner(role)
		await wait()
		if (this.case().status !== "REVIEWING")
			error(409, "INVALID_CASE_TRANSITION", "조사 중에만 메모를 저장할 수 있습니다.")
		if (note.length > 10000)
			error(400, "NOTE_TOO_LONG", "조사 메모는 10,000자 이하로 입력해 주세요.")
		this.case().note = note
		this.history("NOTE", "조사 메모 저장", `${note.length}자`, "inv01")
		return this.snapshot()
	}
	async refreshSummary(role) {
		this.requireOwner(role)
		await wait(450)
		this.case().summary =
			"24시간 동안 31개 상대 계좌에서 USD 320,482가 유입된 뒤 USD 309,200이 두 계좌로 단시간 내 송금되었습니다. 고객 관계와 거래 목적은 추가 확인이 필요합니다."
		this.case().summary_model = "case-summary-1.3"
		this.history("CASE", "AI 조사 요약 생성", "상태 변경 및 STR 생성 없음", "inv01")
		return this.snapshot()
	}
	async escalate(role, comment) {
		this.requireOwner(role)
		await wait()
		const item = this.case()
		if (item.status !== "REVIEWING")
			error(
				409,
				"INVALID_CASE_TRANSITION",
				"REVIEWING 상태에서만 에스컬레이션할 수 있습니다.",
			)
		if (!comment.trim()) error(409, "COMMENT_REQUIRED", "에스컬레이션 사유가 필요합니다.")
		item.status = "ESCALATED"
		item.version += 1
		this.history("CASE", "케이스 에스컬레이션", comment, "inv01")
		return this.snapshot()
	}
	async createDraft(role, scenario = "normal") {
		this.verificationUnavailable = scenario === "verify_error"
		this.requireOwner(role)
		await wait(650)
		const item = this.case()
		if (
			item.status !== "ESCALATED" &&
			item.status !== "DRAFTED" &&
			item.status !== "REJECTED"
		) {
			error(
				409,
				"INVALID_CASE_TRANSITION",
				"ESCALATED 상태에서 최초 초안을 생성할 수 있습니다.",
			)
		}
		const draftId = this.db.drafts.length
			? `DRF-3b81e${this.db.drafts.length + 2}`
			: "DRF-3b81e2"
		const draft = {
			draft_id: draftId,
			case_no: item.case_no,
			status: "ACTIVE",
			version: 0,
			revision_no: null,
			generated_model: "str-narrative-1.6",
			generated_at: now(),
			facts: {
				transaction_count: 47,
				account_count: 34,
				inbound_total: 320482,
				outbound_total: 309200,
				currency: "USD",
				time_window: item.transaction_window,
			},
			sections: [
				{
					section: "SUMMARY",
					text: "대상 계좌에서 단기간 다수 유입 후 급속 이체가 확인되어 의심거래로 검토합니다.",
					evidence_ids: ["TX-220902-4701", "TX-220902-4718", "TX-220902-4721"],
				},
				{
					section: "WHO",
					text: "대상 계좌 010_****8842의 고객 정보는 현재 확인되지 않았으며 거래 상대 계좌는 33개입니다.",
					evidence_ids: ["TX-220902-4701"],
				},
				{
					section: "WHEN",
					text: "거래 시간 창은 2022년 9월 2일 08시부터 9월 3일 08시까지입니다.",
					evidence_ids: ["TX-220902-4701", "TX-220902-4721"],
				},
				{
					section: "HOW",
					text: "9월 3일 입금 이후 USD 309,200이 두 계좌로 빠르게 송금되었습니다.",
					evidence_ids: ["TX-220902-4718", "TX-220902-4721"],
				},
			],
			latest_verification: null,
			submitted_verification_id: null,
		}
		this.db.drafts = [
			draft,
			...this.db.drafts.map((old) => ({
				...old,
				status: "SUPERSEDED",
			})),
		]
		item.current_draft_id = draft.draft_id
		item.status = "DRAFTED"
		item.version += 1
		this.history("STR", "STR 초안 생성", "초안 저장 성공 · 수동 검증 필요", "SYSTEM")
		return this.snapshot()
	}
	async revise(role, changed) {
		this.requireOwner(role)
		await wait()
		const item = this.case()
		if (!["DRAFTED", "REJECTED"].includes(item.status))
			error(409, "DRAFT_LOCKED", "현재 초안은 잠겨 있습니다.")
		// TODO(API 계약 확인 필요): REJECTED → DRAFTED 복귀 HTTP 경로가 확정되지 않아 mock 업무 adapter에서 처리합니다.
		if (item.status === "REJECTED") {
			item.status = "DRAFTED"
			item.version += 1
			item.rejection_comment = null
		}
		const draft = this.db.drafts.find((entry) => entry.draft_id === item.current_draft_id)
		const before = {}
		Object.entries(changed).forEach(([section, text]) => {
			const target = draft.sections.find((entry) => entry.section === section)
			if (!target)
				error(400, "INVALID_SECTION", "허용되지 않은 section입니다.", {
					section,
				})
			const currentSection = target
			if (!text.trim() || text.length > 5000)
				error(400, "INVALID_NARRATIVE", "본문은 1~5,000자로 입력해 주세요.")
			before[section] = currentSection.text
			currentSection.text = text
		})
		draft.version += 1
		draft.revision_no = (draft.revision_no ?? 0) + 1
		if (draft.latest_verification) draft.latest_verification.is_current = false
		this.db.revisions.unshift({
			revision_no: draft.revision_no,
			changed_sections: Object.keys(changed),
			revised_by: "inv01",
			revised_at: now(),
			before,
			after: changed,
		})
		this.history(
			"STR",
			`STR 본문 수정 #${draft.revision_no}`,
			Object.keys(changed).join(", "),
			"inv01",
		)
		return this.snapshot()
	}
	async verify(role, stale = false) {
		this.requireOwner(role)
		if (this.verificationUnavailable) {
			this.verificationUnavailable = false
			error(
				502,
				"VERIFY_UNAVAILABLE",
				"검증 서비스를 사용할 수 없습니다. 초안과 입력은 유지됩니다. 다시 시도하세요.",
			)
		}
		await wait(520)
		if (!["DRAFTED", "REJECTED"].includes(this.case().status))
			error(409, "DRAFT_LOCKED", "현재 상태에서 검증할 수 없습니다.")
		const draft = this.db.drafts.find(
			(entry) => entry.draft_id === this.case().current_draft_id,
		)
		if (!draft) error(404, "DRAFT_NOT_FOUND", "초안이 없습니다.")
		const how = draft.sections.find((entry) => entry.section === "HOW").text
		const passed = !how.includes("9월 3일")
		draft.latest_verification = {
			verification_id: stale ? "VRF-stale-02" : passed ? "VRF-current-03" : "VRF-a71f02",
			revision_no: draft.revision_no,
			is_current: !stale,
			passed,
			verifier_version: "code-2.1+llm-1.4",
			produced_at: now(),
			code_checks: [
				passed
					? {
							id: "DATE_MATCH",
							section: "HOW",
							result: "PASS",
							message: "본문 날짜와 원본 거래일이 일치합니다.",
						}
					: {
							id: "DATE_MATCH",
							section: "HOW",
							result: "FAIL",
							message: "본문 날짜 9월 3일 ≠ 원본 거래일 9월 2일",
						},
			],
			llm_checks: [
				{
					id: "GROUNDING",
					section: "SUMMARY",
					result: "PASS",
					message: "주요 서술이 단락 근거와 연결됩니다.",
				},
			],
		}
		this.history(
			"STR",
			"저장된 본문 검증",
			stale ? "검증 중 다른 탭 수정 감지" : passed ? "통과" : "검사 불통과",
			"inv01",
		)
		return this.snapshot()
	}
	async submit(role) {
		this.requireOwner(role)
		await wait()
		const item = this.case()
		const draft = this.db.drafts.find((entry) => entry.draft_id === item.current_draft_id)
		if (item.status !== "DRAFTED")
			error(409, "INVALID_CASE_TRANSITION", "DRAFTED 상태에서만 승인 요청할 수 있습니다.")
		if (
			!draft.latest_verification?.passed ||
			!draft.latest_verification.is_current ||
			draft.latest_verification.revision_no !== draft.revision_no
		) {
			error(409, "DRAFT_NOT_VERIFIED", "현재 수정본에 대한 통과 검증이 필요합니다.")
		}
		const verification = draft.latest_verification
		item.status = "PENDING_APPROVAL"
		item.version += 1
		item.submitted_revision_no = draft.revision_no
		draft.submitted_verification_id = verification.verification_id
		this.history(
			"CASE",
			"책임자 승인 요청",
			`${draft.draft_id} · ${verification.verification_id}`,
			"inv01",
		)
		return this.snapshot()
	}
	async decide(role, decision, comment) {
		this.requireRole(role, "APPROVER")
		await wait()
		const item = this.case()
		if (item.assignee_id === users.APPROVER.user_id)
			error(409, "SELF_APPROVAL", "자기 승인할 수 없습니다.")
		if (item.status !== "PENDING_APPROVAL")
			error(409, "INVALID_CASE_TRANSITION", "승인 대기 케이스가 아닙니다.")
		if (decision === "reject" && !comment.trim())
			error(409, "COMMENT_REQUIRED", "구체적인 반려 사유를 입력해 주세요.")
		const draft = this.db.drafts.find((entry) => entry.draft_id === item.current_draft_id)
		item.status = decision === "approve" ? "APPROVED" : "REJECTED"
		item.version += 1
		item.rejection_comment = decision === "reject" ? comment : null
		draft.status = decision === "approve" ? "LOCKED" : "ACTIVE"
		this.history(
			"DECISION",
			decision === "approve" ? "책임자 승인" : "책임자 반려",
			comment || draft.submitted_verification_id || "",
			"apr01",
		)
		return this.snapshot()
	}
	async scenario(name) {
		if (name === "reset") return this.reset()
		if (name === "score_failure") {
			this.db.alerts[1].score_status = "FAILED"
			this.db.alerts[1].score = null
			this.db.alerts[1].score_band = null
		}
		if (name === "approved") {
			this.db = initialDb()
			await this.assign("INVESTIGATOR")
			await this.refreshSummary("INVESTIGATOR")
			await this.escalate("INVESTIGATOR", "STR 검토 필요")
			await this.createDraft("INVESTIGATOR")
			await this.revise("INVESTIGATOR", {
				HOW: "9월 2일 입금 이후 USD 309,200이 두 계좌로 빠르게 송금되었습니다.",
			})
			await this.verify("INVESTIGATOR")
			await this.submit("INVESTIGATOR")
			await this.decide("APPROVER", "approve", "")
		}
		if (
			[
				"normal",
				"date_mismatch",
				"edited",
				"stale",
				"verify_error",
				"rejected",
				"superseded",
			].includes(name)
		) {
			this.db = initialDb()
			await this.assign("INVESTIGATOR")
			await this.escalate("INVESTIGATOR", "데모 시나리오 상신")
			await this.createDraft(
				"INVESTIGATOR",
				name === "verify_error" ? "verify_error" : "normal",
			)
			if (["normal", "edited", "stale", "rejected"].includes(name)) {
				await this.revise("INVESTIGATOR", {
					HOW: "9월 2일 입금 이후 USD 309,200이 두 계좌로 빠르게 송금되었습니다.",
				})
			}
			if (["normal", "stale", "rejected", "date_mismatch"].includes(name)) {
				await this.verify("INVESTIGATOR", name === "stale")
			}
			if (name === "rejected") {
				await this.submit("INVESTIGATOR")
				await this.decide(
					"APPROVER",
					"reject",
					"거래 목적과 고객 관계 확인 내용을 보완해 주세요.",
				)
			}
			if (name === "superseded") {
				await this.createDraft("INVESTIGATOR")
			}
		}
		if (name === "conflict") {
			error(
				409,
				"CONCURRENT_UPDATE",
				"다른 탭에서 먼저 저장했습니다. 입력을 보존하고 최신 버전과 비교하세요.",
				{
					latest_version: this.case().version + 1,
				},
			)
		}
		return this.snapshot()
	}
}
