// 자금 흐름 그래프(C5)의 거래 선에서 "대상 계좌에서 나간 돈이 다시 대상 계좌로 돌아온 길"을 찾아요.
// 화면이 시간 순서로 찾은 길이고 룰 판정(rule_facts.paths)이 아니에요 — 경로 지도는 R04_CYCLE 케이스에서만 써요.
// 룰처럼 "같은 분은 앞뒤를 모른다"(rules.md 규칙 9): 다음 거래는 앞 거래보다 늦은 분이어야 이어요.
// 한 길에서 같은 계좌를 두 번 지나지 않아요. 시각은 Date.parse 로 읽어 비교하고, 못 읽는 거래는 빼요.
// 길이 없는 큰 그래프에서 오래 돌지 않게, 확인한 선이 MAX_CHECKED 를 넘으면 빈 결과로 끝내요.
const MAX_STEPS = 6
const MAX_ROUTES = 3
export const MAX_CHECKED = 2000

/** 시각 → 분 단위 숫자. 못 읽으면 NaN. */
function minuteOf(ts) {
	return Math.floor(Date.parse(String(ts ?? "")) / 60000)
}

/** 분이 오름차순인 목록에서 minute 보다 늦은 분이 처음 나오는 자리. */
function firstAfter(list, minute) {
	let low = 0
	let high = list.length
	while (low < high) {
		const mid = (low + high) >> 1
		if (list[mid].minute <= minute) low = mid + 1
		else high = mid
	}
	return low
}

export function findReturnRoutes(edges, targetRef) {
	// 출발 계좌별로 묶고, 묶음 안은 분 순서(같은 분이면 받은 순서)로 둬요.
	const bySource = new Map()
	edges.forEach((edge, index) => {
		if (edge.scope === "CONTEXT") return
		const minute = minuteOf(edge.ts)
		if (Number.isNaN(minute)) return
		const list = bySource.get(edge.source) ?? []
		list.push({ edge, minute, index })
		bySource.set(edge.source, list)
	})
	bySource.forEach((list) => list.sort((a, b) => a.minute - b.minute || a.index - b.index))

	const routes = []
	let checked = 0
	let exhausted = false
	const walk = (path, lastMinute, visited) => {
		if (exhausted || routes.length >= MAX_ROUTES || path.length >= MAX_STEPS) return
		const next = bySource.get(path.at(-1).target) ?? []
		for (let i = firstAfter(next, lastMinute); i < next.length; i += 1) {
			if (routes.length >= MAX_ROUTES) return
			checked += 1
			if (checked > MAX_CHECKED) {
				exhausted = true
				return
			}
			const { edge, minute } = next[i]
			if (edge.target === targetRef) {
				routes.push([...path, edge])
				continue
			}
			if (visited.has(edge.target)) continue
			walk([...path, edge], minute, new Set(visited).add(edge.target))
			if (exhausted) return
		}
	}
	for (const { edge, minute } of bySource.get(targetRef) ?? []) {
		if (exhausted || routes.length >= MAX_ROUTES) break
		if (edge.target === targetRef) continue
		walk([edge], minute, new Set([targetRef, edge.target]))
	}
	return exhausted ? [] : routes
}

// 한 줄에 놓는 단계 수. 이보다 길면 경로가 하나여도 다음 줄로 이어 그려요(가로 스크롤 없음).
// 다음 줄은 앞 줄 마지막 계좌를 "이어서"로 한 번 더 놓고 시작해요.
export const STEPS_PER_ROW = 3

/** 경로를 STEPS_PER_ROW 단계씩 줄로 나눠요. 줄마다 { start, hops } — start 는 첫 단계의 순번(0부터). */
export function routeRows(route) {
	const rows = []
	for (let start = 0; start < route.length; start += STEPS_PER_ROW) {
		rows.push({ start, hops: route.slice(start, start + STEPS_PER_ROW) })
	}
	return rows
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
