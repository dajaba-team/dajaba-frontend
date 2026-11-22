import { describe, expect, it } from "vitest"
import { groupDigits } from "../shared/format/amount"

describe("금액 문자열 천 단위 쉼표 [11/21 PDF 리뷰]", () => {
	it("받은 소수 자릿수 그대로 쉼표만 넣는다", () => {
		expect(groupDigits("62992819.38")).toBe("62,992,819.38")
		expect(groupDigits("42750.50")).toBe("42,750.50")
		expect(groupDigits("1234567.000001")).toBe("1,234,567.000001")
		expect(groupDigits("100")).toBe("100")
		expect(groupDigits("-1234.5")).toBe("-1,234.5")
		expect(groupDigits(42750)).toBe("42,750")
	})
	it("Number로 바꾸지 않아 큰 수도 자릿수가 안 바뀐다", () => {
		expect(groupDigits("12345678901234567890.123456")).toBe("12,345,678,901,234,567,890.123456")
	})
	it("숫자 모양이 아니면 받은 그대로", () => {
		expect(groupDigits("abc")).toBe("abc")
		expect(groupDigits("1,234")).toBe("1,234")
		expect(groupDigits("")).toBe("")
		expect(groupDigits(null)).toBe(null)
		expect(groupDigits(undefined)).toBe(undefined)
	})
})
