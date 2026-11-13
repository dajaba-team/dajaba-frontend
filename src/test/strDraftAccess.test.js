import { describe, expect, it } from "vitest"
import { strApi, toDraft } from "../features/str/api/strApi"
import { resetCases } from "../mocks/handlers"
import { AI_FACTS_EXAMPLE } from "../mocks/strDrafts"
import { apiClient, getErrorCode } from "../shared/api/apiClient"
import { revisionLabel } from "../shared/str/revisionLabel"

const DRAFT_NO = "DRF-000123"
const users = {
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	inv02: { id: 2, login_id: "inv02", display_name: "예시 inv02", role: "INVESTIGATOR" },
	apr01: { id: 3, login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" },
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}
// 시드 본문(명세 예시)의 문장 조각. 제한 응답 어디에도 나오면 안 돼요.
const BODY_SNIPPET = "타행 두 계좌로 빠져나감"

async function captureError(work) {
	try {
		await work()
	} catch (error) {
		return error
	}
	throw new Error("요청이 실패해야 합니다")
}

describe("STR 초안 조회 — 본문 열람 제한 (SCRUM-110, STR 명세 2·4번)", () => {
	it.each(["inv01", "apr01"])(
		"%s(담당 조사역·승인자)는 명세 모양의 본문을 받는다",
		async (who) => {
			resetCases(users[who])
			const draft = await strApi.getDraft(DRAFT_NO)
			expect(draft).toMatchObject({
				draftNo: DRAFT_NO,
				caseNo: "CASE-2022-000057",
				status: "ACTIVE",
				caseStatus: "DRAFTED",
				access: "FULL",
				contentVisible: true,
				currentRevisionNo: 2,
				version: 1,
				caseVersion: 6,
			})
			expect(draft.narrative.map((s) => s.section)).toEqual(["INSTRUMENT", "METHOD"])
			expect(draft.narrative[1]).toEqual({
				section: "METHOD",
				label: null,
				text: expect.stringContaining("9월 2일"),
				cites: [],
				evidenceIds: [5121008, 5121011],
			})
			// 11/4 S2에 더해진 키 — 시드엔 값이 없어 비어 있어요.
			expect(draft).toMatchObject({
				lastRejection: null,
				suspicionTypes: [],
				suspicionTypesRecommended: [],
				suspicionLevelBranch: null,
				suspicionLevelHq: null,
				availableActions: [],
			})
			// facts는 AI facts 그대로 — 받은 그대로 넘기는지만 봐요(Q15). 모양이 바뀌어도 이 단언은 안 흔들려요.
			expect(draft.facts).toEqual(AI_FACTS_EXAMPLE)
			expect(draft.latestVerification).toMatchObject({
				verificationId: "VRF-a71f02",
				revisionNo: 2,
				isCurrent: true,
				passed: true,
				status: "PASSED",
			})
		},
	)

	it("검증 결과는 계약서 S5 모양(코드 검사 5종·AI 평가 5종)으로 옮긴다", async () => {
		resetCases(users.inv01)
		const { latestVerification } = await strApi.getDraft(DRAFT_NO)
		expect(latestVerification.codeChecks.map((item) => item.check)).toEqual([
			"AMOUNT_MATCH",
			"DATE_MATCH",
			"COUNT_MATCH",
			"ACCOUNT_ID_MATCH",
			"EVIDENCE_IN_SCOPE",
		])
		expect(latestVerification.codeChecks[1]).toEqual({
			check: "DATE_MATCH",
			section: "METHOD",
			draftValue: "2022-09-02",
			sourceValue: "2022-09-02",
			match: true,
			reason: null,
		})
		expect(latestVerification.llmChecks).toHaveLength(5)
		expect(latestVerification.llmChecks[0]).toEqual({
			check: "FIVE_W_ONE_H_COMPLETE",
			comment: expect.any(String),
			score: 4,
		})
	})

	it("코드 검사가 실패해 평가자를 안 돌렸으면 llmChecks는 빈 배열이 아니라 null이다", () => {
		const draft = toDraft({
			draft_no: DRAFT_NO,
			access: "FULL",
			latest_verification: {
				passed: false,
				status: "CODE_FAILED",
				code_checks: [
					{
						check: "DATE_MATCH",
						section: "DATE",
						draft_value: "2022-09-03",
						source_value: "2022-09-02",
						match: false,
						reason: "MISMATCH",
					},
				],
				llm_checks: null,
			},
		})
		expect(draft.latestVerification.codeChecks[0]).toMatchObject({
			sourceValue: "2022-09-02",
			match: false,
			reason: "MISMATCH",
		})
		expect(draft.latestVerification.llmChecks).toBeNull()
	})

	it("수정 이력 목록에는 본문이 없고, revision_no로 한 행의 전·후 본문을 받는다", async () => {
		resetCases(users.inv01)
		const list = await strApi.getRevisions(DRAFT_NO)
		expect(list.currentRevisionNo).toBe(2)
		expect(list.items.map((item) => [item.revisionNo, item.aiOriginal])).toEqual([
			[2, false],
			[1, true],
		])
		expect(JSON.stringify(list)).not.toContain(BODY_SNIPPET)
		const second = await strApi.getRevision(DRAFT_NO, 2)
		expect(second.narrativeBefore[0].text).toContain("9월 3일")
		expect(second.narrativeAfter[0].text).toContain("9월 2일")
		const original = await strApi.getRevision(DRAFT_NO, 1)
		expect(original).toMatchObject({ editedBy: "SYSTEM", narrativeBefore: [] })
	})

	it("수정본 이름은 서버 ai_original을 먼저 보고, 없을 때만 1번을 AI 원문으로 본다", () => {
		expect(revisionLabel(1)).toBe("수정본 1번 (AI 원문)")
		expect(revisionLabel(1, false)).toBe("수정본 1번")
		expect(revisionLabel(3, true)).toBe("수정본 3번 (AI 원문)")
		expect(revisionLabel(null, true)).toBe("-")
	})

	it("저장 응답(S3)의 needs_verification·변경 항목을 옮긴다", async () => {
		resetCases(users.inv01)
		const saved = await strApi.saveRevision({
			draftNo: "DRF-000124",
			caseVersion: 3,
			sections: [{ section: "PLACE", text: "고친 장소" }],
		})
		expect(saved).toMatchObject({
			revisionNo: 2,
			changedSections: ["PLACE"],
			editedBy: "inv01",
			needsVerification: true,
			caseStatus: null,
		})
	})

	it.each(["admin", "inv02"])(
		"%s(관리자·비담당 조사역)는 META_ONLY로 상태·날짜만 받고 본문은 null이다",
		async (who) => {
			resetCases(users[who])
			// 서버 응답: 본문 키는 빠지지 않고 null (계약서 2.3, 11/4 채영).
			const { data } = await apiClient.get(`/api/v1/str-drafts/${DRAFT_NO}`)
			expect(data).toMatchObject({
				access: "META_ONLY",
				facts: null,
				narrative: null,
				latest_verification: null,
				last_rejection: null,
				references: null,
			})
			expect(JSON.stringify(data)).not.toContain(BODY_SNIPPET)
			// 화면 모델: 상태·날짜만.
			const draft = await strApi.getDraft(DRAFT_NO)
			expect(draft).toEqual({
				draftNo: DRAFT_NO,
				caseNo: "CASE-2022-000057",
				status: "ACTIVE",
				caseStatus: "DRAFTED",
				producedAt: "2026-10-21T10:15:02Z",
				access: "META_ONLY",
				contentVisible: false,
			})
		},
	)

	it("S2 추가 필드(label·last_rejection·의심 유형·정도·available_actions)를 옮긴다", () => {
		const draft = toDraft({
			draft_no: DRAFT_NO,
			access: "FULL",
			narrative: [{ section: "SUBJECT", label: "의심스러운 거래자 관련", text: "t" }],
			last_rejection: {
				reason_code: "NEED_REVISION",
				comment: "근거 보완",
				revision_no: 2,
				decided_by: "apr01",
				decided_at: "2026-10-22T09:00:00Z",
				narrative_unchanged: false,
			},
			suspicion_types: ["VI-4"],
			suspicion_types_recommended: ["VI-4"],
			suspicion_level_branch: 4,
			suspicion_level_hq: 3,
			available_actions: ["REVISE", "VERIFY"],
		})
		expect(draft.narrative[0].label).toBe("의심스러운 거래자 관련")
		expect(draft).toMatchObject({
			lastRejection: {
				reasonCode: "NEED_REVISION",
				comment: "근거 보완",
				revisionNo: 2,
				decidedBy: "apr01",
				decidedAt: "2026-10-22T09:00:00Z",
				narrativeUnchanged: false,
			},
			suspicionTypes: ["VI-4"],
			suspicionTypesRecommended: ["VI-4"],
			suspicionLevelBranch: 4,
			suspicionLevelHq: 3,
			availableActions: ["REVISE", "VERIFY"],
		})
	})

	it("S2에 없는 키 — available_actions 없음은 null, is_current가 없으면 수정본 번호로 판단", () => {
		const draft = toDraft({
			draft_no: DRAFT_NO,
			access: "FULL",
			case_no: "CASE-2022-000057",
			status: "ACTIVE",
			version: 0,
			case_version: 2,
			produced_at: "2026-11-10T00:00:00Z",
			facts: { subject: { account_no: "10_****BD30", account_ref: "ACR-0123456789AB" } },
			narrative: [{ section: "DATE", text: "t", cites: ["period"], evidence_ids: [104221] }],
			current_revision_no: 2,
			latest_verification: {
				verification_id: "VRF-1",
				revision_no: 1,
				status: "PASSED",
				passed: true,
				code_checks: [],
				llm_checks: [],
			},
		})
		expect(draft.availableActions).toBeNull()
		expect(draft.caseStatus).toBeNull()
		expect(draft.narrative[0]).toMatchObject({ label: null, cites: ["period"] })
		// 수정본 1번을 검증했는데 지금은 2번 — 예전 통과는 지금 본문의 통과가 아니에요.
		expect(draft.latestVerification.isCurrent).toBe(false)
	})

	it("서버가 실수로 본문을 같이 보내도 FULL이 아니면 화면 모델에 옮기지 않는다", () => {
		const draft = toDraft({
			draft_no: DRAFT_NO,
			case_no: "CASE-2022-000057",
			status: "ACTIVE",
			access: "META_ONLY",
			narrative: [{ section: "METHOD", text: BODY_SNIPPET }],
			facts: { period: AI_FACTS_EXAMPLE.period },
		})
		expect(draft).not.toHaveProperty("narrative")
		expect(draft).not.toHaveProperty("facts")
		// access가 없거나 모르는 값이어도 본문을 열지 않아요.
		expect(toDraft({ draft_no: DRAFT_NO, narrative: [] }).contentVisible).toBe(false)
	})

	it.each([
		// BE ListStrRevisions는 관리자도 비담당과 같이 NOT_ASSIGNEE예요(URL 역할 규칙 없음).
		["admin", "NOT_ASSIGNEE"],
		["inv02", "NOT_ASSIGNEE"],
	])("%s가 수정 이력을 부르면 403 %s이고 본문이 없다", async (who, code) => {
		resetCases(users[who])
		const error = await captureError(() => strApi.getRevision(DRAFT_NO, 2))
		expect(error.response.status).toBe(403)
		expect(getErrorCode(error)).toBe(code)
		expect(JSON.stringify(error.response.data)).not.toContain(BODY_SNIPPET)
	})

	it("없는 초안은 404 DRAFT_NOT_FOUND, 로그인 전에는 401이다", async () => {
		resetCases(users.inv01)
		const missing = await captureError(() => strApi.getDraft("DRF-000000"))
		expect(getErrorCode(missing)).toBe("DRAFT_NOT_FOUND")
		resetCases(null)
		const anonymous = await captureError(() => strApi.getDraft(DRAFT_NO))
		expect(anonymous.response.status).toBe(401)
	})
})
