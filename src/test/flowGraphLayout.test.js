import { describe, expect, it } from "vitest"
import { layoutFlowGraph } from "../features/cases/components/flowGraphLayout"

describe("자금 흐름 그래프 배치 (SCRUM-247)", () => {
	it("보낸 계좌가 30개여도 한 단에 세로로 놓아, 선이 다른 계좌 위를 지나지 않는다", () => {
		const senders = Array.from({ length: 30 }, (_, index) => `S${index}`)
		const nodes = ["T", ...senders, "R"].map((accountRef) => ({ accountRef }))
		const edges = [
			...senders.map((source) => ({ source, target: "T", amount: "100", currency: "USD" })),
			{ source: "T", target: "R", amount: "100", currency: "USD" },
		]
		const graph = layoutFlowGraph(nodes, edges, "T")
		const target = graph.points.get("T")
		const placed = senders.map((ref) => graph.points.get(ref))

		// 보낸 계좌는 모두 같은 단(대상 왼쪽) — 대상과의 사이에 다른 계좌가 없어요
		expect(new Set(placed.map((point) => point.x)).size).toBe(1)
		expect(placed[0].x).toBeLessThan(target.x)
		expect(graph.points.get("R").x).toBeGreaterThan(target.x)
		// 위아래로 겹치지 않고, 그림 안에 다 들어가요
		placed.slice(1).forEach((point, index) => {
			expect(point.y - placed[index].y).toBeGreaterThan(point.height)
		})
		expect(placed.at(-1).y + placed.at(-1).height / 2).toBeLessThan(graph.height)
		expect(target.y).toBe(graph.height / 2)
	})
})
