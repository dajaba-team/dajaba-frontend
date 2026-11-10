import { describe, expect, it } from "vitest"
import {
	changedSections,
	sectionError,
	strActionsFor,
	textLength,
} from "../features/str/model/strRules"

const draft = (over = {}) => ({
	contentVisible: true,
	status: "ACTIVE",
	availableActions: null,
	narrative: [
		{ section: "DATE", text: "9월 2일" },
		{ section: "OPINION", text: "의견" },
	],
	...over,
})

describe("STR 화면 규칙", () => {
	it("S2가 available_actions를 주면 그대로 쓴다", () => {
		expect(strActionsFor(draft({ availableActions: ["VERIFY"] }), {})).toEqual(["VERIFY"])
		expect(
			strActionsFor(draft({ availableActions: [] }), {
				availableActions: ["GENERATE_DRAFT"],
			}),
		).toEqual([])
	})

	it("S2에 available_actions가 없으면(null) 케이스 C2 동작에서 옮겨 온다 — 임시 다리", () => {
		const drafted = {
			status: "DRAFTED",
			availableActions: ["GENERATE_DRAFT", "CLOSE_WITH_DRAFT"],
		}
		// 검증·승인 요청·초안 있는 종료는 S5·S6 화면과 같이 붙여요 — 지금은 수정·재생성만
		expect(strActionsFor(draft(), drafted)).toEqual(["REVISE", "REGENERATE"])
		// 보완 요청 반려도 고칠 수 있어요
		expect(
			strActionsFor(draft(), { status: "REJECTED", availableActions: ["GENERATE_DRAFT"] }),
		).toEqual(["REVISE", "REGENERATE"])
		// 승인 대기·비담당(케이스 동작 없음)·과거 초안·제한 응답은 아무것도 없음
		expect(
			strActionsFor(draft(), { status: "PENDING_APPROVAL", availableActions: [] }),
		).toEqual([])
		expect(strActionsFor(draft({ status: "SUPERSEDED" }), drafted)).toEqual([])
		expect(strActionsFor({ contentVisible: false }, drafted)).toEqual([])
	})

	it("고친 항목만 보낸다", () => {
		const { narrative } = draft()
		expect(changedSections(narrative, {})).toEqual([])
		expect(changedSections(narrative, { DATE: "9월 2일" })).toEqual([])
		expect(changedSections(narrative, { DATE: "9월 3일" })).toEqual([
			{ section: "DATE", text: "9월 3일" },
		])
	})

	it("빈 항목·5,000자 초과는 막고 글자 수는 NFC로 센다", () => {
		expect(sectionError(" \n")).toMatch("빈 항목")
		expect(sectionError("가".repeat(5000))).toBeNull()
		expect(sectionError("가".repeat(5001))).toMatch("5,000")
		expect(textLength("가")).toBe(1)
	})
})
