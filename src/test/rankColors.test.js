import { describe, expect, it } from "vitest"
import { rankColors } from "../features/overview/model/analytics"

describe("rankColors", () => {
	it("8건이면 2개씩 4단계 — 맨 위 빨강, 맨 아래 회색", () => {
		const colors = rankColors(8)
		expect(colors).toHaveLength(8)
		expect(new Set(colors).size).toBe(4)
		expect(colors[0]).toBe("#f04452")
		expect(colors[1]).toBe("#f04452")
		expect(colors[7]).toBe("#c5cbd5")
		expect(colors[6]).toBe("#c5cbd5")
	})

	it("1건이면 빨강 하나", () => {
		expect(rankColors(1)).toEqual(["#f04452"])
	})

	it("0건이면 빈 배열", () => {
		expect(rankColors(0)).toEqual([])
	})
})
