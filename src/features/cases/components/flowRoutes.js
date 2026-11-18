// 자금 흐름 그래프(C5)의 거래 선에서 "대상 계좌에서 나간 돈이 다시 대상 계좌로 돌아온 길"을 찾아요.
// 시간 순서를 지키고(다음 거래는 앞 거래와 같거나 늦게), 한 길에서 같은 계좌를 두 번 지나지 않아요.
// 경로 지도(CaseRouteMap)는 이 결과만 그리고, 길이 없으면 전체 그래프를 그대로 보여 줘요.
const MAX_STEPS = 6
const MAX_ROUTES = 3

export function findReturnRoutes(edges, targetRef) {
	const ordered = edges
		.filter((edge) => edge.scope !== "CONTEXT")
		.slice()
		.sort((a, b) => String(a.ts).localeCompare(String(b.ts)))
	const routes = []
	const walk = (path, visited) => {
		if (routes.length >= MAX_ROUTES || path.length >= MAX_STEPS) return
		const last = path.at(-1)
		for (const edge of ordered) {
			if (routes.length >= MAX_ROUTES) return
			if (edge.source !== last.target || String(edge.ts) < String(last.ts)) continue
			if (edge.target === targetRef) {
				routes.push([...path, edge])
				continue
			}
			if (visited.has(edge.target)) continue
			walk([...path, edge], new Set(visited).add(edge.target))
		}
	}
	ordered
		.filter((edge) => edge.source === targetRef && edge.target !== targetRef)
		.forEach((first) => walk([first], new Set([targetRef, first.target])))
	return routes
}

/** 시각 "2022-10-31T10:14:00" → "10:14" */
export function hopTime(ts) {
	const match = /T(\d{2}:\d{2})/.exec(String(ts ?? ""))
	return match ? match[1] : "—"
}

/** 대상 계좌 기준 한 단계의 이름 — 나간 돈 · 들어온 돈 · 그 사이 경유. */
export function hopKind(edge, targetRef) {
	if (edge.source === targetRef) return "유출"
	if (edge.target === targetRef) return "유입"
	return "경유 거래"
}
