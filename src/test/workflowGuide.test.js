import { describe, expect, it } from "vitest"
import {
	approvalListWorkflowGuide,
	caseDetailWorkflowGuide,
	caseListWorkflowGuide,
	strWorkflowGuide,
} from "../shared/ui/workflowGuide"

describe("SCRUM-330 역할별 업무 흐름 안내", () => {
	it("조사역은 목록에서 케이스 확인부터 시작한다", () => {
		expect(caseListWorkflowGuide("INVESTIGATOR")).toContain("1. 케이스 확인")
		expect(caseListWorkflowGuide("APPROVER")).toBeNull()
	})

	it("조사역 케이스 상세는 서버가 허용한 다음 행동을 안내한다", () => {
		expect(
			caseDetailWorkflowGuide(
				{ availableActions: ["ESCALATE", "CLOSE"], currentDraftNo: null },
				"INVESTIGATOR",
			),
		).toContain("2. 조사")
		expect(
			caseDetailWorkflowGuide(
				{ availableActions: ["GENERATE_DRAFT"], currentDraftNo: null },
				"INVESTIGATOR",
			),
		).toContain("3. STR 작성")
	})

	it("조사역 STR은 검증·승인 요청·반려 보완·승인 대기를 구분한다", () => {
		const detail = { status: "DRAFTED", availableActions: [] }
		expect(
			strWorkflowGuide({
				role: "INVESTIGATOR",
				detail,
				draft: { availableActions: ["VERIFY"], verification: null },
			}),
		).toContain("4. 검증")
		expect(
			strWorkflowGuide({
				role: "INVESTIGATOR",
				detail,
				draft: {
					availableActions: ["SUBMIT"],
					verification: { isCurrent: true, passed: true },
				},
			}),
		).toContain("4. 승인 요청")
		expect(
			strWorkflowGuide({
				role: "INVESTIGATOR",
				detail: { ...detail, status: "REJECTED" },
				draft: { availableActions: ["REVISE", "VERIFY"] },
			}),
		).toContain("3. 보완")
		expect(
			strWorkflowGuide({
				role: "INVESTIGATOR",
				detail: { ...detail, status: "PENDING_APPROVAL" },
				draft: { availableActions: [] },
			}),
		).toContain("5. 승인 대기")
	})

	it("승인자는 승인함에서 요청을 열고 초안에서 승인·반려한다", () => {
		expect(approvalListWorkflowGuide("APPROVER", 2)).toContain("1. 승인 요청 확인")
		expect(
			strWorkflowGuide({
				role: "APPROVER",
				detail: { status: "PENDING_APPROVAL" },
				draft: { availableActions: ["APPROVE", "REJECT"] },
			}),
		).toContain("2. 승인 결정")
	})
})
