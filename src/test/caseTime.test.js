import { describe, expect, it } from "vitest"
import { formatDataMinute, formatSystemMinute } from "../features/cases/caseTime"
import { formatDataTime, formatSystemTime } from "../shared/format/time"

describe("케이스 상세 시각 — 분까지", () => {
	it("데이터 시각은 초를 떼고, 형식은 공용 함수와 같다", () => {
		expect(formatDataTime("2022-10-31T09:00:00")).toBe("2022-10-31 09:00:00")
		expect(formatDataMinute("2022-10-31T09:00:00")).toBe("2022-10-31 09:00")
	})
	it("처리 시각도 초만 뗀다", () => {
		const v = "2026-11-02T01:13:45Z"
		expect(formatSystemMinute(v)).toBe(formatSystemTime(v).slice(0, -3))
	})
	it("시각 꼴이 아니면(값 없음 표시 등) 그대로", () => {
		expect(formatDataMinute(null)).toBe(formatDataTime(null))
	})
})
