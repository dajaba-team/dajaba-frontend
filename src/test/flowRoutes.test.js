import { describe, expect, it } from "vitest"
import {
	MAX_CHECKED,
	findReturnRoutes,
	hopKind,
	hopTime,
} from "../features/cases/components/flowRoutes"

const edge = (transactionId, source, target, time, scope = "EVIDENCE") => ({
	transactionId,
	source,
	target,
	amount: 100,
	currency: "US Dollar",
	scope,
	ts: `2022-10-31T${time}:00`,
})

describe("경로 지도 — 대상 계좌로 돌아온 길 찾기 (SCRUM-280)", () => {
	it("A → B → C → A 순환을 시간 순서대로 찾는다", () => {
		const edges = [
			// 일부러 시간 순서와 다르게 넣어요
			edge(3, "C", "A", "18:05"),
			edge(1, "A", "B", "10:14"),
			edge(2, "B", "C", "13:40"),
		]
		const routes = findReturnRoutes(edges, "A")
		expect(routes).toHaveLength(1)
		expect(routes[0].map((e) => e.transactionId)).toEqual([1, 2, 3])
	})

	it("시간이 거꾸로 이어지거나 참고 거래(CONTEXT)로만 돌아오면 경로가 아니다", () => {
		// B → A 가 A → B 보다 먼저 일어났으면 돌아온 돈이 아니에요
		expect(
			findReturnRoutes([edge(1, "A", "B", "10:00"), edge(2, "B", "A", "09:00")], "A"),
		).toEqual([])
		// 참고 거래는 근거가 아니라 경로에 넣지 않아요
		expect(
			findReturnRoutes(
				[edge(1, "A", "B", "10:00"), edge(2, "B", "A", "11:00", "CONTEXT")],
				"A",
			),
		).toEqual([])
	})

	it("같은 계좌를 두 번 지나지 않고, 경로는 최대 3개·6단계까지만 찾는다", () => {
		// B ↔ C 를 맴도는 고리는 따라가지 않아요
		const loop = [
			edge(1, "A", "B", "10:00"),
			edge(2, "B", "C", "10:10"),
			edge(3, "C", "B", "10:20"),
			edge(4, "C", "A", "10:30"),
		]
		expect(findReturnRoutes(loop, "A").map((r) => r.map((e) => e.transactionId))).toEqual([
			[1, 2, 4],
		])
		// 돌아오는 길이 5개여도 3개만
		const many = Array.from({ length: 5 }, (_, i) => [
			edge(`o${i}`, "A", `X${i}`, "10:00"),
			edge(`i${i}`, `X${i}`, "A", "11:00"),
		]).flat()
		expect(findReturnRoutes(many, "A")).toHaveLength(3)
		// 7단계가 걸려야 돌아오는 길은 찾지 않아요
		const long = ["A", "B", "C", "D", "E", "F", "G"].map((from, i, all) =>
			edge(i, from, all[i + 1] ?? "A", `1${i}:00`),
		)
		expect(findReturnRoutes(long, "A")).toEqual([])
	})

	it("돌아오는 길이 없거나 거래가 없으면 빈 목록", () => {
		expect(
			findReturnRoutes([edge(1, "A", "B", "10:00"), edge(2, "B", "C", "11:00")], "A"),
		).toEqual([])
		expect(findReturnRoutes([], "A")).toEqual([])
	})

	it("단계 이름과 시각 — 유출·경유 거래·유입, 시각이 없으면 —", () => {
		expect(hopKind(edge(1, "A", "B", "10:00"), "A")).toBe("유출")
		expect(hopKind(edge(2, "B", "C", "10:00"), "A")).toBe("경유 거래")
		expect(hopKind(edge(3, "C", "A", "10:00"), "A")).toBe("유입")
		expect(hopTime("2022-10-31T18:05:00")).toBe("18:05")
		expect(hopTime(null)).toBe("—")
	})

	it("같은 분의 거래는 앞뒤를 몰라 잇지 않는다 — 룰 규칙 9 (SCRUM-296)", () => {
		// 10:00 에 나가서 10:00 에 돌아온 돈은 순서를 몰라 경로가 아니에요
		expect(
			findReturnRoutes([edge(1, "A", "B", "10:00"), edge(2, "B", "A", "10:00")], "A"),
		).toEqual([])
		// 초가 달라도 분이 같으면 마찬가지
		const sameMinute = [
			{ ...edge(1, "A", "B", "10:00"), ts: "2022-10-31T10:00:05" },
			{ ...edge(2, "B", "A", "10:00"), ts: "2022-10-31T10:00:50" },
		]
		expect(findReturnRoutes(sameMinute, "A")).toEqual([])
		// 한 분이라도 늦으면 이어요
		expect(
			findReturnRoutes([edge(1, "A", "B", "10:00"), edge(2, "B", "A", "10:01")], "A"),
		).toHaveLength(1)
	})

	it("시각은 글자가 아니라 Date.parse 로 비교하고, 못 읽는 시각은 뺀다 (SCRUM-296)", () => {
		// 글자로는 "10:30+09:00" > "02:00Z" 지만 실제로는 01:30Z 라 02:00Z 보다 앞이에요
		const zoned = [
			{ ...edge(1, "A", "B", "00:00"), ts: "2022-10-31T10:30:00+09:00" },
			{ ...edge(2, "B", "A", "00:00"), ts: "2022-10-31T02:00:00Z" },
		]
		expect(findReturnRoutes(zoned, "A")).toHaveLength(1)
		expect(
			findReturnRoutes(
				[edge(1, "A", "B", "10:00"), { ...edge(2, "B", "A", "11:00"), ts: "모름" }],
				"A",
			),
		).toEqual([])
	})

	it("길이 없는 큰 그래프(계좌 30·거래 300)도 금방 빈 결과로 끝난다 (SCRUM-296)", () => {
		// 대상 A 로 돌아오는 선이 하나도 없는, 촘촘하고 시간이 이어지는 그래프
		let seed = 7
		const rand = (n) => {
			seed = (seed * 1103515245 + 12345) % 2147483648
			return seed % n
		}
		const accounts = Array.from({ length: 29 }, (_, i) => `X${i}`)
		const edges = Array.from({ length: 300 }, (_, i) => {
			const from = i < 20 ? "A" : accounts[rand(29)]
			let to = accounts[rand(29)]
			if (to === from) to = accounts[(accounts.indexOf(to) + 1) % 29]
			const minute = 10 + Math.floor(i / 6)
			return {
				...edge(i, from, to, "00:00"),
				ts: `2022-10-31T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00`,
			}
		})
		const started = performance.now()
		expect(findReturnRoutes(edges, "A")).toEqual([])
		expect(performance.now() - started).toBeLessThan(200)
	})

	it(`확인한 선이 ${MAX_CHECKED}개를 넘으면 찾다 말고 빈 결과 (SCRUM-296)`, () => {
		// B 에서 나가는 선이 상한보다 많고, A 로 돌아오는 선은 그 뒤에 있어요 — 찾기 전에 멈춰요
		const fan = [
			edge(1, "A", "B", "10:00"),
			...Array.from({ length: MAX_CHECKED + 5 }, (_, i) =>
				edge(`f${i}`, "B", `Y${i}`, "10:01"),
			),
			edge(2, "B", "A", "10:02"),
		]
		expect(findReturnRoutes(fan, "A")).toEqual([])
	})
})
