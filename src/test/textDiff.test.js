import { describe, expect, it } from "vitest"
import { diffNarratives, diffStats, diffWords } from "../shared/str/textDiff"
import { baseOptions } from "../features/str/model/changeReview"

const join = (segments, keep) =>
	segments
		.filter((s) => keep.includes(s.type))
		.map((s) => s.text)
		.join("")

describe("단어 단위 비교 (변경 비교·수정 이력)", () => {
	it("이어 붙이면 원래 두 문장이 된다", () => {
		const before = "2022년 9월 3일 하루 동안 USD 12,500.00씩 입금됨."
		const after = "2022년 9월 2일 하루 동안 USD 12,500.00씩 3건 입금됨."
		const segments = diffWords(before, after)
		expect(join(segments, ["same", "del"])).toBe(before)
		expect(join(segments, ["same", "add"])).toBe(after)
		expect(segments.filter((s) => s.type === "del").map((s) => s.text.trim())).toContain("3일")
		expect(diffStats(segments)).toEqual({ added: 2, removed: 1 })
	})

	it("같은 문장이면 바뀐 곳이 없고, 빈 문장에서 쓰면 통째로 추가", () => {
		expect(diffWords("같음", "같음")).toEqual([{ type: "same", text: "같음" }])
		expect(diffWords("", "새 문장")).toEqual([{ type: "add", text: "새 문장" }])
	})

	it("항목 목록 비교 — 지금 순서대로, 기준에 없던 항목은 새 항목", () => {
		const rows = diffNarratives(
			[{ section: "DATE", text: "a" }],
			[
				{ section: "DATE", text: "a" },
				{ section: "OPINION", text: "b" },
			],
		)
		expect(rows.map((row) => [row.section, row.changed, row.base])).toEqual([
			["DATE", false, { section: "DATE", text: "a" }],
			["OPINION", true, null],
		])
	})

	it("비교 기준 — 반려 당시가 먼저, AI 원문·직전 수정본, 지금 수정본과 같은 번호는 빼요", () => {
		expect(baseOptions(1, null)).toEqual([])
		expect(baseOptions(4, 2).map((o) => o.revisionNo)).toEqual([2, 1, 3])
		expect(baseOptions(2, null).map((o) => o.revisionNo)).toEqual([1])
		expect(baseOptions(3, 1).map((o) => o.label)).toEqual([
			"반려 당시 (수정본 1번)",
			"직전 수정본 (수정본 2번)",
		])
	})
})
