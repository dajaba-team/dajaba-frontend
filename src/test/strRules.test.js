import { describe, expect, it } from "vitest"
import {
	changedSections,
	sectionError,
	strActionsFor,
	submitBlockReason,
	textLength,
	verificationState,
	mismatchMarks,
	valueCandidates,
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
const passed = { verificationId: "V1", isCurrent: true, status: "PASSED", passed: true }

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
		expect(strActionsFor(draft(), drafted)).toEqual([
			"REVISE",
			"VERIFY",
			"SUBMIT",
			"REGENERATE",
			"CLOSE_WITH_DRAFT",
		])
		// 보완 요청 반려 — 저장해서 DRAFTED가 되기 전엔 검증·승인 요청 없음(BE #95: 검증도 DRAFTED에서만)
		expect(
			strActionsFor(draft(), { status: "REJECTED", availableActions: ["GENERATE_DRAFT"] }),
		).toEqual(["REVISE", "REGENERATE"])
		// 승인 대기·비담당(케이스 동작 없음)·과거 초안·제한 응답은 아무것도 없음
		expect(
			strActionsFor(draft(), { status: "PENDING_APPROVAL", availableActions: [] }),
		).toEqual([])
		expect(strActionsFor(draft({ status: "SUPERSEDED" }), drafted)).toEqual([
			"CLOSE_WITH_DRAFT",
		])
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

	it("검증 상태 — 미저장·없음·지난 결과·통과·불통과·검증 못 함을 구분한다", () => {
		expect(verificationState(passed, { dirty: true })).toBe("UNSAVED")
		expect(verificationState(null)).toBe("NONE")
		expect(verificationState({ ...passed, isCurrent: false })).toBe("STALE")
		expect(verificationState(passed)).toBe("PASSED")
		expect(verificationState({ ...passed, status: "CODE_FAILED", passed: false })).toBe(
			"CODE_FAILED",
		)
		expect(
			verificationState({ isCurrent: true, status: "VERIFY_UNAVAILABLE", passed: false }),
		).toBe("VERIFY_UNAVAILABLE")
	})

	it("승인 요청은 저장·현재 저장본 통과·유형·지점 정도가 모두 있어야 한다", () => {
		const base = {
			actions: ["SUBMIT"],
			caseStatus: "DRAFTED",
			dirty: false,
			verification: passed,
			types: ["T"],
			level: 3,
		}
		expect(submitBlockReason(base)).toBeNull()
		expect(submitBlockReason({ ...base, actions: [] })).toMatch("할 수 없는")
		expect(submitBlockReason({ ...base, actions: [], caseStatus: "REJECTED" })).toMatch(
			"고쳐 저장",
		)
		expect(submitBlockReason({ ...base, dirty: true })).toMatch("저장")
		expect(
			submitBlockReason({ ...base, verification: { ...passed, isCurrent: false } }),
		).toMatch("검증 통과")
		expect(submitBlockReason({ ...base, types: [] })).toMatch("유형")
		expect(submitBlockReason({ ...base, level: null })).toMatch("지점 의심 정도")
	})

	it("불일치 본문 값을 본문 글자 모양으로 찾아 밑줄 범위를 준다", () => {
		expect(valueCandidates("2022-09-03")).toEqual(
			expect.arrayContaining(["2022년 9월 3일", "9월 3일", "2022-09-03"]),
		)
		expect(valueCandidates("42750.00")).toEqual(
			expect.arrayContaining(["42,750.00", "42,750", "42750"]),
		)
		const text = "2022년 9월 3일 하루 동안 USD 42,750.00이 들어옴."
		const date = { check: "DATE_MATCH", match: false, draftValue: "2022-09-03" }
		const amount = { check: "AMOUNT_MATCH", match: false, draftValue: "42750.00" }
		const passed = { check: "COUNT_MATCH", match: true, draftValue: "3" }
		const marks = mismatchMarks(text, [amount, date, passed])
		expect(marks.map((m) => text.slice(m.start, m.end))).toEqual([
			"2022년 9월 3일",
			"42,750.00",
		])
		expect(marks[0].check).toBe(date)
	})

	it("숫자 일부·못 찾은 값·빈 값엔 밑줄을 긋지 않는다", () => {
		const three = { check: "COUNT_MATCH", match: false, draftValue: "3" }
		expect(mismatchMarks("13건이 들어옴", [three])).toEqual([])
		expect(mismatchMarks("3건, 13건", [three]).map((m) => m.start)).toEqual([0])
		expect(mismatchMarks("9월 초", [{ match: false, draftValue: "2022-09-03" }])).toEqual([])
		expect(mismatchMarks("본문", [{ match: false, draftValue: null }])).toEqual([])
	})
})
