import { describe, expect, it } from "vitest"
import { formatScore, DASHBOARD_SCORE_DECIMALS } from "../shared/format/score"

describe("점수 표기 [SCRUM-347]", () => {
	it("부동소수점 끝자리를 정리해 소수 넷째 자리까지 보여 준다", () => {
		expect(formatScore(0.8600000000000001)).toBe("0.8600")
		expect(formatScore(0.39999999999999997)).toBe("0.4000") // 계산 오차 — 뜻은 0.40
		expect(formatScore(0.7272)).toBe("0.7272")
		expect(formatScore(0.29)).toBe("0.2900")
		expect(formatScore(1)).toBe("1.0000")
		expect(formatScore(0)).toBe("0.0000")
	})
	it("반올림하지 않고 버린다 — HIGH 경계 바로 아래가 경계값으로 보이지 않게", () => {
		expect(formatScore(0.69996)).toBe("0.6999")
		expect(formatScore(0.70004)).toBe("0.7000")
	})
	it("숫자 글자도 받고, 값이 없거나 숫자가 아니면 null", () => {
		expect(formatScore("0.15")).toBe("0.1500")
		expect(formatScore(null)).toBeNull()
		expect(formatScore(undefined)).toBeNull()
		expect(formatScore("")).toBeNull()
		expect(formatScore("abc")).toBeNull()
	})
	it("대시보드는 소수 둘째 자리까지 버린다 [SCRUM-392]", () => {
		expect(formatScore(0.9233, DASHBOARD_SCORE_DECIMALS)).toBe("0.92")
		expect(formatScore(0.94, DASHBOARD_SCORE_DECIMALS)).toBe("0.94")
		expect(formatScore(0.8600000000000001, DASHBOARD_SCORE_DECIMALS)).toBe("0.86")
		expect(formatScore(0.29, DASHBOARD_SCORE_DECIMALS)).toBe("0.29")
		expect(formatScore(0.69996, DASHBOARD_SCORE_DECIMALS)).toBe("0.69") // 반올림하면 0.70 — MEDIUM 배지와 어긋남
		expect(formatScore(1, DASHBOARD_SCORE_DECIMALS)).toBe("1.00")
		expect(formatScore(null, DASHBOARD_SCORE_DECIMALS)).toBeNull()
	})
})
