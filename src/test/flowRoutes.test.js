import { describe, expect, it } from "vitest"
import { findReturnRoutes, hopKind, hopTime } from "../features/cases/components/flowRoutes"

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
})
