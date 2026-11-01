import { describe, expect, it } from "vitest"
import { formatDataTime, formatSystemTime } from "../shared/format/time"

describe("시각 표기 [BE 미결 27]", () => {
	it("시스템 시각(UTC Z)은 로컬 시각으로 바꾼다", () => {
		expect(formatSystemTime("2026-10-30T05:12:00Z", { timeZone: "Asia/Seoul" })).toBe(
			"2026-10-30 14:12:00",
		)
		expect(formatSystemTime("2026-10-30T05:12:00Z", { timeZone: "UTC" })).toBe(
			"2026-10-30 05:12:00",
		)
	})
	it("Z가 아닌 값은 계약 위반이라 바꾸지 않고 그대로 보여 준다", () => {
		expect(formatSystemTime("2022-09-02T09:00:00")).toBe("2022-09-02T09:00:00")
		expect(formatSystemTime(null)).toBe("")
	})
	it("데이터 시각(ts·window_*·reference_ts)은 시간대를 붙이거나 옮기지 않는다", () => {
		expect(formatDataTime("2022-09-02T23:59:59")).toBe("2022-09-02 23:59:59")
		expect(formatDataTime(undefined)).toBe("")
	})
})
