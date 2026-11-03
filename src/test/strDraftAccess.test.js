import { describe, expect, it } from "vitest"
import { strApi, toDraft } from "../features/str/api/strApi"
import { resetCases } from "../mocks/handlers"
import { getErrorCode, getErrorMessage } from "../shared/api/apiClient"

const DRAFT_ID = "DRF-2022-000001"
const users = {
	inv01: { id: "1", login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	inv02: { id: "2", login_id: "inv02", display_name: "예시 inv02", role: "INVESTIGATOR" },
	apr01: { id: "3", login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" },
	admin: { id: "4", login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}
// 시드 본문의 한 문장. 제한 응답 어디에도 나오면 안 돼요.
const BODY_SNIPPET = "해외 계좌로 송금"

async function captureError(work) {
	try {
		await work()
	} catch (error) {
		return error
	}
	throw new Error("요청이 실패해야 합니다")
}

describe("STR 초안 조회 — 본문 열람 제한 (SCRUM-110)", () => {
	it.each(["inv01", "apr01"])("%s(담당 조사역·승인자)는 본문과 facts를 받는다", async (who) => {
		resetCases(users[who])
		const draft = await strApi.getDraft(DRAFT_ID)
		expect(draft.contentVisible).toBe(true)
		expect(draft.sections.map((s) => s.section)).toEqual(["WHO", "WHAT"])
		expect(draft.sections[1].text).toContain(BODY_SNIPPET)
		expect(draft.sections[1].evidenceIds).toEqual(["TX-1002", "TX-1003"])
		expect(draft.facts).toMatchObject({ currency: "USD", transactionCount: 12 })
		const revisions = await strApi.getRevisions(DRAFT_ID)
		expect(revisions[0]).toMatchObject({ revisionNo: 1, changedSections: ["WHAT"] })
	})

	it.each(["admin", "inv02"])(
		"%s(관리자·다른 조사역)는 상태·날짜만 받고 본문 필드 자체가 없다",
		async (who) => {
			resetCases(users[who])
			const draft = await strApi.getDraft(DRAFT_ID)
			expect(draft).toEqual({
				draftId: DRAFT_ID,
				caseNo: "CASE-2022-000057",
				status: "ACTIVE",
				createdAt: "2026-11-02T01:10:00Z",
				updatedAt: "2026-11-02T02:30:00Z",
				submittedAt: null,
				decidedAt: null,
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
			created_at: "2026-11-02T01:10:00Z",
			content_visible: false,
			sections: [{ section: "WHAT", text: BODY_SNIPPET }],
			facts: { currency: "USD" },
		})
		expect(draft).not.toHaveProperty("sections")
		expect(draft).not.toHaveProperty("facts")
	})

	it("관리자가 수정 이력을 부르면 403 NOT_STR_VIEWER와 열람 제한 안내를 받는다", async () => {
		resetCases(users.admin)
		const error = await captureError(() => strApi.getRevisions(DRAFT_ID))
		expect(error.response.status).toBe(403)
		expect(getErrorCode(error)).toBe("NOT_STR_VIEWER")
		expect(getErrorMessage(error)).toBe(
			"STR 본문과 수정 이력은 담당 조사역과 승인자만 볼 수 있어요.",
		)
		expect(JSON.stringify(error.response.data)).not.toContain(BODY_SNIPPET)
	})

	it("없는 초안은 404 DRAFT_NOT_FOUND, 로그인 전에는 401이다", async () => {
		resetCases(users.inv01)
		const missing = await captureError(() => strApi.getDraft("DRF-0000-999999"))
		expect(getErrorCode(missing)).toBe("DRAFT_NOT_FOUND")
		resetCases(null)
		const anonymous = await captureError(() => strApi.getDraft(DRAFT_ID))
		expect(anonymous.response.status).toBe(401)
	})
})
