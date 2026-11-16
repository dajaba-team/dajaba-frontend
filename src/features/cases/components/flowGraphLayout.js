// 자금 흐름 그래프 배치 — 돈이 왼쪽에서 오른쪽으로 흐르게 계좌를 세로 줄(단)에 놓아요.
// 대상 계좌가 가운데 단(0), 대상에게 보낸 계좌는 왼쪽(-1), 대상이 보낸 계좌는 오른쪽(+1),
// 대상과 직접 닿지 않는 경유 계좌는 이어진 계좌의 바깥쪽 단에 놓아요. 금액은 더하거나 환산하지 않아요.
export const NODE_WIDTH = 148
export const NODE_HEIGHT = 36
export const TARGET_WIDTH = 176
export const TARGET_HEIGHT = 60
const COLUMN_GAP = 270
const ROW_GAP = 58
// 한 단에 계좌가 많으면 줄 간격을 좁혀요. 단을 옆으로 쪼개면 바깥 계좌의 선이 안쪽 계좌 위를 지나가서, 줄만 늘려요.
const DENSE_ROW_GAP = 46
const DENSE_ROWS = 9
const PADDING_X = 36
const PADDING_Y = 40
const MIN_HEIGHT = 320
const ARROW_GAP = 9

/** 선 종류 — 대상 계좌가 받으면 유입, 보내면 유출, 끼지 않으면 경유. */
export function edgeKind(edge, targetRef) {
	if (edge.target === targetRef) return "in"
	if (edge.source === targetRef) return "out"
	return "via"
}

function assignLayers(nodes, edges, targetRef) {
	const neighbors = new Map()
	const link = (from, other, step) => {
		if (!neighbors.has(from)) neighbors.set(from, [])
		neighbors.get(from).push({ other, step })
	}
	edges.forEach((edge) => {
		if (edge.source === edge.target) return
		link(edge.source, edge.target, 1)
		link(edge.target, edge.source, -1)
	})
	const layers = new Map()
	const spread = (start, layer) => {
		layers.set(start, layer)
		const queue = [start]
		while (queue.length) {
			const current = queue.shift()
			const at = layers.get(current)
			for (const { other, step } of neighbors.get(current) ?? []) {
				if (layers.has(other)) continue
				// 가운데 단은 대상 계좌 자리라, 그리로 들어갈 계좌는 반대로 한 단 더 바깥에 놓아요.
				layers.set(other, at + step === 0 ? at - step : at + step)
				queue.push(other)
			}
		}
	}
	if (nodes.some((node) => node.accountRef === targetRef)) spread(targetRef, 0)
	// 대상 계좌와 이어지지 않은 계좌 묶음 — 보내는 쪽이면 왼쪽, 받기만 하면 오른쪽에서 시작해요.
	nodes.forEach((node) => {
		if (layers.has(node.accountRef)) return
		const sends = edges.some(
			(edge) => edge.source === node.accountRef && edge.target !== node.accountRef,
		)
		spread(node.accountRef, sends ? -1 : 1)
	})
	return layers
}

function side(point, towardRight) {
	return point.x + (towardRight ? point.width / 2 : -point.width / 2)
}

function bezierMiddle(p0, p1, p2, p3) {
	return {
		x: (p0.x + 3 * p1.x + 3 * p2.x + p3.x) / 8,
		y: (p0.y + 3 * p1.y + 3 * p2.y + p3.y) / 8,
	}
}

function edgePath(from, to, offset) {
	if (from === to) {
		// 같은 계좌 안에서 돈 거래 — 계좌 위로 작은 고리.
		const top = from.y - from.height / 2
		const start = { x: from.x - 22 + offset, y: top }
		const end = { x: from.x + 22 + offset, y: top - ARROW_GAP + 6 }
		const c1 = { x: start.x - 34, y: top - 62 }
		const c2 = { x: end.x + 34, y: top - 62 }
		return { start, c1, c2, end }
	}
	if (from.x === to.x) {
		// 같은 단 안의 거래 — 오른쪽으로 불룩하게.
		const start = { x: side(from, true), y: from.y + offset }
		const end = { x: side(to, true) + ARROW_GAP, y: to.y + offset }
		const bulge = 64 + Math.abs(offset) * 2
		return {
			start,
			c1: { x: start.x + bulge, y: start.y },
			c2: { x: end.x + bulge, y: end.y },
			end,
		}
	}
	const forward = to.x > from.x
	const start = { x: side(from, forward), y: from.y + offset }
	const end = { x: side(to, !forward) + (forward ? -ARROW_GAP : ARROW_GAP), y: to.y + offset }
	const bend = (end.x - start.x) / 2
	return {
		start,
		c1: { x: start.x + bend, y: start.y },
		c2: { x: end.x - bend, y: end.y },
		end,
	}
}

/**
 * @returns {{ width: number, height: number, points: Map<string, object>, edges: object[] }}
 * points: accountRef → { x, y, width, height } (가운데 좌표). edges: 원래 순서 그대로 + kind·d·labelAt·weight.
 */
export function layoutFlowGraph(nodes, edges, targetRef) {
	const layers = assignLayers(nodes, edges, targetRef)
	const byLayer = new Map()
	nodes.forEach((node) => {
		const layer = layers.get(node.accountRef)
		if (!byLayer.has(layer)) byLayer.set(layer, [])
		byLayer.get(layer).push(node)
	})
	// 한 단은 세로 한 줄 — 계좌가 많으면 그림이 아래로 길어지고, 무대가 세로로 스크롤돼요.
	const columns = [...byLayer.keys()].sort((a, b) => a - b).map((layer) => byLayer.get(layer))
	const rowGap = (column) => (column.length > DENSE_ROWS ? DENSE_ROW_GAP : ROW_GAP)
	const tallest = Math.max(...columns.map((column) => (column.length - 1) * rowGap(column)), 0)
	const height = Math.max(MIN_HEIGHT, PADDING_Y * 2 + TARGET_HEIGHT + tallest)
	const width = PADDING_X * 2 + TARGET_WIDTH + (columns.length - 1) * COLUMN_GAP
	const points = new Map()
	columns.forEach((column, columnIndex) => {
		const x = PADDING_X + TARGET_WIDTH / 2 + columnIndex * COLUMN_GAP
		const gap = rowGap(column)
		const top = height / 2 - ((column.length - 1) * gap) / 2
		column.forEach((node, rowIndex) => {
			const target = node.accountRef === targetRef
			points.set(node.accountRef, {
				x,
				y: top + rowIndex * gap,
				width: target ? TARGET_WIDTH : NODE_WIDTH,
				height: target ? TARGET_HEIGHT : NODE_HEIGHT,
			})
		})
	})

	// 같은 두 계좌 사이 거래가 여러 건이면 위아래로 조금씩 벌려요.
	const pairs = new Map()
	edges.forEach((edge) => {
		const key = [edge.source, edge.target].sort().join("|")
		if (!pairs.has(key)) pairs.set(key, [])
		pairs.get(key).push(edge)
	})
	// 선 굵기는 같은 통화 안에서만 비교해요(환산 없음).
	const maxByCurrency = new Map()
	edges.forEach((edge) => {
		const amount = Math.abs(Number(edge.amount)) || 0
		maxByCurrency.set(edge.currency, Math.max(maxByCurrency.get(edge.currency) ?? 0, amount))
	})

	const placed = edges.map((edge) => {
		const from = points.get(edge.source)
		const to = points.get(edge.target)
		if (!from || !to) return { ...edge, kind: edgeKind(edge, targetRef), d: null }
		const siblings = pairs.get([edge.source, edge.target].sort().join("|"))
		const step = Math.min(8, 26 / siblings.length)
		const offset = (siblings.indexOf(edge) - (siblings.length - 1) / 2) * step
		const { start, c1, c2, end } = edgePath(from, to, offset)
		const max = maxByCurrency.get(edge.currency)
		const ratio = max > 0 ? Math.sqrt((Math.abs(Number(edge.amount)) || 0) / max) : 0
		return {
			...edge,
			kind: edgeKind(edge, targetRef),
			d: `M${start.x},${start.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`,
			labelAt: bezierMiddle(start, c1, c2, end),
			weight: 1.5 + 2.5 * ratio,
		}
	})
	return { width, height, points, edges: placed }
}
