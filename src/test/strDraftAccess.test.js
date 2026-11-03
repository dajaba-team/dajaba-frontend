import { describe, expect, it } from "vitest"
import { strApi, toDraft } from "../features/str/api/strApi"
import { resetCases } from "../mocks/handlers"
import { getErrorCode } from "../shared/api/apiClient"

const DRAFT_ID = "DRF-3b81e2"
const users = {
	inv01: { id: "1", login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	inv02: { id: "2", login_id: "inv02", display_name: "예시 inv02", role: "INVESTIGATOR" },
	apr01: { id: "3", login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" },
	admin: { id: "4", login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
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
			const draft = await strApi.getDraft(DRAFT_ID)
			expect(draft).toMatchObject({
				draftId: DRAFT_ID,
				caseNo: "CASE-2022-000057",
				status: "ACTIVE",
				caseStatus: "DRAFTED",
				contentVisible: true,
				currentRevisionNo: 2,
				version: 1,
				caseVersion: 6,
			})
			expect(draft.narrative.map((s) => s.section)).toEqual(["INSTRUMENT", "METHOD"])
			expect(draft.narrative[1]).toEqual({
				section: "METHOD",
				text: expect.stringContaining("9월 2일"),
				evidenceIds: [5121008, 5121011],
			})
			expect(draft.facts).toMatchObject({ currency: "KRW", inboundCount: 47 })
			expect(draft.latestVerification).toMatchObject({
				verificationId: "VRF-a71f02",
				revisionNo: 2,
				isCurrent: true,
				passed: true,
			})
		},
	)

	it("수정 이력 목록에는 본문이 없고, revision_no로 한 행의 전·후 본문을 받는다", async () => {
		resetCases(users.inv01)
		const items = await strApi.getRevisions(DRAFT_ID)
		expect(items.map((item) => item.revisionNo)).toEqual([2, 1])
		expect(JSON.stringify(items)).not.toContain(BODY_SNIPPET)
		const second = await strApi.getRevision(DRAFT_ID, 2)
		expect(second.narrativeBefore[0].text).toContain("9월 3일")
		expect(second.narrativeAfter[0].text).toContain("9월 2일")
		const original = await strApi.getRevision(DRAFT_ID, 1)
		expect(original).toMatchObject({ editedBy: "SYSTEM", narrativeBefore: [] })
	})

	it.each(["admin", "inv02"])(
		"%s(관리자·비담당 조사역)는 상태·날짜만 받고 본문 키 자체가 없다",
		async (who) => {
			resetCases(users[who])
			const draft = await strApi.getDraft(DRAFT_ID)
			expect(draft).toEqual({
				draftId: DRAFT_ID,
				caseNo: "CASE-2022-000057",
				status: "ACTIVE",
				caseStatus: "DRAFTED",
				producedAt: "2026-10-21T10:15:02Z",
				contentVisible: false,
			})
			expect(JSON.stringify(draft)).not.toContain(BODY_SNIPPET)
		},
	)

	it("서버가 실수로 본문을 같이 보내도 제한 응답이면 화면 모델에 옮기지 않는다", () => {
		const draft = toDraft({
			draft_id: DRAFT_ID,
			case_no: "CASE-2022-000057",
			status: "ACTIVE",
			content_visible: false,
			narrative: [{ section: "METHOD", text: BODY_SNIPPET }],
			facts: { currency: "KRW" },
		})
		expect(draft).not.toHaveProperty("narrative")
		expect(draft).not.toHaveProperty("facts")
	})

	it.each([
		["admin", "FORBIDDEN"],
		["inv02", "NOT_ASSIGNEE"],
	])("%s가 수정 이력을 부르면 403 %s이고 본문이 없다", async (who, code) => {
		resetCases(users[who])
		const error = await captureError(() => strApi.getRevision(DRAFT_ID, 2))
		expect(error.response.status).toBe(403)
		expect(getErrorCode(error)).toBe(code)
		expect(JSON.stringify(error.response.data)).not.toContain(BODY_SNIPPET)
	})

	it("없는 초안은 404 DRAFT_NOT_FOUND, 로그인 전에는 401이다", async () => {
		resetCases(users.inv01)
		const missing = await captureError(() => strApi.getDraft("DRF-000000"))
		expect(getErrorCode(missing)).toBe("DRAFT_NOT_FOUND")
		resetCases(null)
		const anonymous = await captureError(() => strApi.getDraft(DRAFT_ID))
		expect(anonymous.response.status).toBe(401)
	})
})
