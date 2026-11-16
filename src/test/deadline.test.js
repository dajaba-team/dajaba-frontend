import { describe, expect, it } from "vitest"
import {
	businessDate,
	deadlineDate,
	deadlineStatus,
	deadlineText,
} from "../features/approvals/model/deadline"

// 3영업일 마감(SCRUM-111) — 승인 다음 영업일이 1일째, 3영업일째 23:59(한국 시각), 공휴일 미반영.
describe("보고 마감", () => {
	it("한국 날짜로 자른다 — UTC 15시 이후는 한국 다음 날", () => {
		expect(businessDate("2026-11-12T14:59:59Z")).toBe("2026-11-12")
		expect(businessDate("2026-11-12T15:00:00Z")).toBe("2026-11-13")
	})

	it("금요일 승인이면 주말을 건너 다음 주 수요일이 마감", () => {
		// 2026-11-13(금) 10:00 KST
		expect(deadlineDate("2026-11-13T01:00:00Z")).toBe("2026-11-18")
	})

	it("월요일 승인이면 목요일이 마감", () => {
		expect(deadlineDate("2026-11-16T01:00:00Z")).toBe("2026-11-19")
	})

	it("남은 영업일은 오늘 다음 날부터 마감일까지 — 주말엔 줄지 않는다", () => {
		const approved = "2026-11-13T01:00:00Z" // 금 → 마감 11/18(수)
		expect(deadlineStatus(approved, new Date("2026-11-13T05:00:00Z"))).toEqual({
			deadline: "2026-11-18",
			remaining: 3,
			state: "OPEN",
		})
		expect(deadlineStatus(approved, new Date("2026-11-14T05:00:00Z")).remaining).toBe(3) // 토
		expect(deadlineStatus(approved, new Date("2026-11-17T05:00:00Z")).remaining).toBe(1) // 화
	})

	it("마감일 당일은 '오늘 마감', 다음 날부터는 '마감 지남'", () => {
		const approved = "2026-11-13T01:00:00Z"
		const today = deadlineStatus(approved, new Date("2026-11-18T14:00:00Z")) // 11/18 23:00 KST
		expect(today.state).toBe("TODAY")
		expect(deadlineText(today)).toBe("오늘 마감 · 11/18 23:59 · 공휴일 미반영")
		const after = deadlineStatus(approved, new Date("2026-11-18T15:00:00Z")) // 11/19 00:00 KST
		expect(after.state).toBe("OVERDUE")
		expect(deadlineText(after)).toBe("마감 지남 · 11/18 23:59 · 공휴일 미반영")
	})

	it("배지 글자에 남은 영업일·마감 시각·공휴일 미반영이 들어간다", () => {
		const status = deadlineStatus("2026-11-13T01:00:00Z", new Date("2026-11-13T05:00:00Z"))
		expect(deadlineText(status)).toBe("마감까지 3영업일 · 11/18 23:59 · 공휴일 미반영")
	})
})
