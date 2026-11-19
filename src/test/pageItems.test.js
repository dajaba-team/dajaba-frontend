import { describe, expect, it } from "vitest"
import { pageItems } from "../shared/ui/pageItems"

describe("pageItems — 페이지 넘김에 보일 번호 (SCRUM-285)", () => {
	it("페이지가 적으면 모두 보여 준다", () => {
		expect(pageItems(1, 1)).toEqual([1])
		expect(pageItems(2, 4)).toEqual([1, 2, 3, 4])
	})
	it("처음·끝·지금 앞뒤만 남기고 사이는 줄인다", () => {
		expect(pageItems(1, 7)).toEqual([1, 2, "gap-7", 7])
		expect(pageItems(5, 10)).toEqual([1, "gap-4", 4, 5, 6, "gap-10", 10])
		expect(pageItems(10, 10)).toEqual([1, "gap-9", 9, 10])
	})
	it("한 칸만 비면 … 대신 그 번호를 넣는다", () => {
		expect(pageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
	})
})
