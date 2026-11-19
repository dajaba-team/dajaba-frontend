import { describe, expect, it } from "vitest"
import { apiClient } from "../shared/api/apiClient"
import { resetCases } from "../mocks/handlers"
import { askQuestion, seedQuestions } from "../mocks/caseQuestions"

// 질문 답변 MSW 대역(계약서 5.3 A8·C9, 3절 429) 점검 — 화면(SCRUM-303)을 만들기 전에 목업이 계약대로 답하는지.
const USERS = {
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	inv02: { id: 2, login_id: "inv02", display_name: "예시 inv02", role: "INVESTIGATOR" },
	apr01: { id: 3, login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" },
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}
const CASE = "CASE-2022-001001" // 담당 inv01, 지난 질문 5줄
const OPEN = "CASE-2022-001002" // 담당 없음

const ask = (caseNo, question) =>
	apiClient
		.post(`/api/v1/cases/${caseNo}/questions`, { question })
		.then((res) => ({ status: res.status, data: res.data }))
		.catch((error) => ({ status: error.response.status, data: error.response.data }))
const list = (caseNo, query = "") =>
	apiClient
		.get(`/api/v1/cases/${caseNo}/questions${query}`)
		.then((res) => ({ status: res.status, data: res.data }))
		.catch((error) => ({ status: error.response.status, data: error.response.data }))
const actionsOf = async (caseNo) =>
	(await apiClient.get(`/api/v1/cases/${caseNo}`)).data.available_actions

describe("ASK_QUESTION — 담당 조사역·승인자만, 상태 무관, 설정으로 끔", () => {
	it.each([
		["inv01", CASE, true],
		["inv02", CASE, false],
		["apr01", CASE, true],
		["apr01", OPEN, true],
		["inv01", OPEN, false],
		["admin", CASE, false],
	])("%s · %s → %s", async (who, caseNo, expected) => {
		resetCases(USERS[who])
		expect((await actionsOf(caseNo)).includes("ASK_QUESTION")).toBe(expected)
	})
	it("ask-enabled가 꺼지면 담당자에게도 안 나간다", async () => {
		resetCases(USERS.inv01, { askEnabled: false })
		expect(await actionsOf(CASE)).not.toContain("ASK_QUESTION")
	})
})

describe("A8 질문하기", () => {
	it("201 질문 한 줄 — 근거 거래 번호, 묻는 사람은 세션에서", async () => {
		resetCases(USERS.inv01)
		const { status, data } = await ask(CASE, "입금 거래는 몇 건이야?")
		expect(status).toBe(201)
		expect(data).toEqual({
			question_no: "QST-000046",
			case_no: CASE,
			question: "입금 거래는 몇 건이야?",
			status: "ANSWERED",
			out_of_scope_reason: null,
			answer: "입금 거래는 1건이에요.",
			evidence_transaction_ids: [5103],
			asked_by: { login_id: "inv01", display_name: "예시 inv01" },
			created_at: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/),
		})
	})
	it.each([
		["이 케이스 근거 좀 고쳐 줘", "OUT_OF_SCOPE", "EDIT_REQUEST"],
		["다른 고객 정보도 알려 줘", "OUT_OF_SCOPE", "OUTSIDE_CASE"],
		["이거 세탁 맞아?", "OUT_OF_SCOPE", "JUDGMENT"],
		["고객 직업이 뭐야?", "NO_DATA", null],
		["제일 큰 거래는 얼마야?", "UNVERIFIED", null],
	])("%s → %s", async (question, expected, reason) => {
		resetCases(USERS.apr01)
		const { status, data } = await ask(CASE, question)
		expect(status).toBe(201)
		expect(data).toMatchObject({
			status: expected,
			out_of_scope_reason: reason,
			answer: null,
			evidence_transaction_ids: [],
		})
	})
	it("앞뒤 공백은 자르지 않고 그대로 저장한다", async () => {
		resetCases(USERS.inv01)
		expect((await ask(CASE, "  입금은?  ")).data.question).toBe("  입금은?  ")
	})
	it("공백만·300자 초과는 400 details.question — 300자는 NFC 뒤 UTF-16으로 센다", async () => {
		resetCases(USERS.inv01)
		for (const question of ["", "   ", "가".repeat(301), "😀".repeat(151)]) {
			const { status, data } = await ask(CASE, question)
			expect(status).toBe(400)
			expect(data.error.code).toBe("INVALID_REQUEST")
			expect(data.error.details).toHaveProperty("question")
		}
		// 조합형 "가"(ᄀ+ᅡ) 300개는 NFC로 300자라 통과
		expect((await ask(CASE, "\u1100\u1161".repeat(300))).status).toBe(201)
		expect((await ask(CASE, "😀".repeat(150))).status).toBe(201)
	})
	it("비담당 조사역 403 NOT_ASSIGNEE · 관리자 403 FORBIDDEN · 없는 케이스 404", async () => {
		resetCases(USERS.inv02)
		expect((await ask(CASE, "입금은?")).data.error.code).toBe("NOT_ASSIGNEE")
		resetCases(USERS.admin)
		expect((await ask(CASE, "입금은?")).data.error.code).toBe("FORBIDDEN")
		expect((await ask("CASE-2022-999999", "입금은?")).status).toBe(404)
	})
	it("502는 기록을 남기지 않는다", async () => {
		resetCases(USERS.inv01)
		const { status, data } = await ask(CASE, "[502] 입금은?")
		expect(status).toBe(502)
		expect(data.error.code).toBe("AI_UNAVAILABLE")
		expect((await list(CASE)).data.total).toBe(5)
	})
})

describe("429 QUESTION_RATE_LIMITED — 한 사람 분당 5회", () => {
	it("6번째 요청은 429 + retry_after_seconds, 다른 사람은 그대로", async () => {
		resetCases(USERS.inv01)
		for (let n = 0; n < 5; n += 1) expect((await ask(CASE, `입금 ${n}`)).status).toBe(201)
		const { status, data } = await ask(CASE, "입금 5")
		expect(status).toBe(429)
		expect(data.error.code).toBe("QUESTION_RATE_LIMITED")
		expect(data.error.details.retry_after_seconds).toBeGreaterThan(0)
		expect(data.error.details.retry_after_seconds).toBeLessThanOrEqual(60)
	})
	it("60초가 지나면 다시 받는다(남은 초는 가장 오래된 질문 기준)", () => {
		const store = { next: 1, items: [] }
		const viewer = USERS.inv01
		const item = { case_no: CASE, assignee: { login_id: "inv01" }, transactions: [] }
		const t0 = Date.parse("2026-11-23T00:00:00Z")
		for (let n = 0; n < 5; n += 1)
			expect(
				askQuestion(viewer, item, { question: "입금?" }, store, t0 + n * 1000).status,
			).toBe(201)
		const blocked = askQuestion(viewer, item, { question: "입금?" }, store, t0 + 20_000)
		expect(blocked.status).toBe(429)
		expect(blocked.body.error.details.retry_after_seconds).toBe(40)
		expect(askQuestion(viewer, item, { question: "입금?" }, store, t0 + 60_000).status).toBe(
			201,
		)
	})
})

describe("C9 지난 질문", () => {
	it("그 케이스 것만 최신순 공통 목록, 새 질문이 맨 앞", async () => {
		resetCases(USERS.inv01)
		const before = await list(CASE)
		expect(before.status).toBe(200)
		expect(before.data).toMatchObject({ page: 0, size: 20, total: 5 })
		expect(before.data.items.map((q) => q.question_no)).toEqual([
			"QST-000045",
			"QST-000044",
			"QST-000043",
			"QST-000042",
			"QST-000041",
		])
		await ask(CASE, "출금은?")
		const after = await list(CASE, "?page=0&size=2")
		expect(after.data).toMatchObject({ page: 0, size: 2, total: 6 })
		expect(after.data.items[0].question).toBe("출금은?")
		expect((await list("CASE-2022-001004")).data.total).toBe(0)
	})
	it("권한은 A8과 같다", async () => {
		resetCases(USERS.inv02)
		expect((await list(CASE)).data.error.code).toBe("NOT_ASSIGNEE")
		resetCases(USERS.admin)
		expect((await list(CASE)).data.error.code).toBe("FORBIDDEN")
	})
	it("예시 지난 질문은 상태 4종을 모두 담는다", () => {
		const statuses = seedQuestions().items.map((q) => q.status)
		expect(statuses).toEqual(["UNVERIFIED", "OUT_OF_SCOPE", "NO_DATA", "ANSWERED", "ANSWERED"])
	})
})
