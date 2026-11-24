import { describe, expect, it } from "vitest"
import { backoffMs, createFailureCounter, MAX_BACKOFF_MS } from "../shared/jobs/failureBackoff"

// 작업 추적 실패 간격(9/7 점검 BH-FE-06) — 연속 실패 수는 조회 상태로 따로 세요.
const failed = (at) => ({ status: "error", errorUpdatedAt: at })
const succeeded = (at) => ({ status: "success", dataUpdatedAt: at, errorUpdatedAt: 0 })
const fetching = { status: "pending", errorUpdatedAt: 0 }

describe("backoffMs", () => {
	it("연속 실패 0·1·2·3·4번 → 기본·2·4·8·16배", () => {
		expect([0, 1, 2, 3, 4].map((n) => backoffMs(1000, n))).toEqual([
			1000, 2000, 4000, 8000, 16000,
		])
	})

	it("최대 30초에서 멈춘다", () => {
		expect(MAX_BACKOFF_MS).toBe(30_000)
		expect(backoffMs(1000, 5)).toBe(30_000)
		expect(backoffMs(1000, 50)).toBe(30_000)
		expect(backoffMs(100, 3, 500)).toBe(500)
	})
})

describe("createFailureCounter", () => {
	it("새 실패마다 1씩, 같은 실패 상태로 여러 번 불러도 그대로", () => {
		const counter = createFailureCounter()
		expect(counter.observe("A:1", fetching)).toBe(0)
		expect(counter.observe("A:1", failed(100))).toBe(1)
		expect(counter.observe("A:1", failed(100))).toBe(1)
		expect(counter.observe("A:1", failed(100))).toBe(1)
		expect(counter.observe("A:1", failed(200))).toBe(2)
		expect(counter.observe("A:1", failed(300))).toBe(3)
		expect(counter.observe("A:1", failed(300))).toBe(3)
	})

	it("요청을 시작한 상태(실패도 성공도 아님)는 수를 바꾸지 않는다", () => {
		const counter = createFailureCounter()
		counter.observe("A:1", failed(100))
		counter.observe("A:1", failed(200))
		expect(counter.observe("A:1", fetching)).toBe(2)
	})

	it("성공하면 0, 그 뒤 실패는 1부터", () => {
		const counter = createFailureCounter()
		counter.observe("A:1", failed(100))
		counter.observe("A:1", failed(200))
		expect(counter.observe("A:1", succeeded(300))).toBe(0)
		expect(counter.observe("A:1", { ...failed(400), dataUpdatedAt: 300 })).toBe(1)
	})

	it("작업 두 개가 서로 수를 섞지 않는다", () => {
		const counter = createFailureCounter()
		counter.observe("A:1", failed(100))
		counter.observe("A:1", failed(200))
		expect(counter.observe("A:2", failed(200))).toBe(1)
		expect(counter.observe("A:1", failed(200))).toBe(2)
		expect(counter.observe("B:1", succeeded(200))).toBe(0)
		expect(counter.observe("A:1", failed(200))).toBe(2)
	})

	it("forget·keep·clear 뒤에는 0부터 다시 센다", () => {
		const counter = createFailureCounter()
		counter.observe("A:1", failed(100))
		counter.observe("A:2", failed(100))
		counter.observe("A:3", failed(100))
		counter.forget("A:1")
		expect(counter.observe("A:1", fetching)).toBe(0)
		counter.keep(["A:2"])
		expect(counter.observe("A:2", fetching)).toBe(1)
		expect(counter.observe("A:3", fetching)).toBe(0)
		counter.clear()
		expect(counter.observe("A:2", fetching)).toBe(0)
	})
})
