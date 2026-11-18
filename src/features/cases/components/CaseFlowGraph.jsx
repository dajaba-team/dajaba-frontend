import { useEffect, useMemo, useRef, useState } from "react"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatDataTime } from "../../../shared/format/time"
import { useCaseGraph } from "../hooks/useCases"
import { formatAmount } from "./caseMoney"
import { layoutFlowGraph } from "./flowGraphLayout"
import { findReturnRoutes } from "./flowRoutes"
import CaseRouteMap from "./CaseRouteMap"

// 자금 흐름 그래프 — 계약서 C5 `GET /cases/{case_no}/graph`. 노드 = 계좌(account_ref), 선 = 거래 하나.
// 돈이 왼쪽 → 오른쪽으로 흐르게 놓아요: 보낸 계좌 · 대상 계좌(가운데) · 받은 계좌. 배치는 flowGraphLayout.
// 선 색은 대상 계좌 기준(유입·유출·경유)이고 범례에 글자로도 적어요. 참고 거래(CONTEXT)는 점선.
// 선 굵기는 같은 통화 안에서만 비교해요. 잘리면 "전체 N건 중 M건" — 미리보기로 합계를 내지 않아요.
const KINDS = [
	["in", "유입"],
	["out", "유출"],
	["via", "경유"],
]
const KIND_LABELS = Object.fromEntries(KINDS)
const KIND_HINTS = {
	in: "대상 계좌가 받은 거래",
	out: "대상 계좌가 보낸 거래",
	via: "대상 계좌가 끼지 않은 거래",
}

function edgeKey(edge, index) {
	return `${edge.transactionId}-${index}`
}

function FlowGraphDetail({ active, graph, accountNos, accountRef }) {
	if (!active) {
		return (
			<p className="flow-graph-hint">
				선이나 계좌에 마우스를 올리면 거래 내용이 보여요. 누르면 고정돼요. 계좌는 Tab으로
				옮기고 Enter로 고정할 수 있어요.
			</p>
		)
	}
	if (active.type === "edge") {
		const edge = active.edge
		return (
			<p>
				<span className={`flow-graph-swatch is-${edge.kind}`} aria-hidden="true" />
				<strong>{KIND_LABELS[edge.kind]}</strong>
				{edge.scope === "CONTEXT" && <span> · 참고 거래</span>}
				<span> · 거래 {edge.transactionId}</span>
				<span> · {formatDataTime(edge.ts)}</span>
				<span className="flow-graph-mono">
					{" "}
					· {accountNos.get(edge.source) ?? edge.source} →{" "}
					{accountNos.get(edge.target) ?? edge.target}
				</span>
				<strong className="flow-graph-amount">
					{formatAmount(edge.amount, edge.currency)}
				</strong>
			</p>
		)
	}
	// 계좌 — 건수만 세요. 통화가 섞일 수 있어 금액은 더하지 않아요.
	const sent = graph.edges.filter((edge) => edge.source === active.ref).length
	const received = graph.edges.filter((edge) => edge.target === active.ref).length
	return (
		<p>
			<strong className="flow-graph-mono">{accountNos.get(active.ref)}</strong>
			{active.ref === accountRef && <span> · 조사 대상 계좌</span>}
			<span>
				{" "}
				· 이 그림에서 보낸 거래 {sent}건 · 받은 거래 {received}건
			</span>
		</p>
	)
}

function FlowGraphView({ data, accountRef }) {
	const [hovered, setHovered] = useState(null)
	const [pinned, setPinned] = useState(null)
	const graph = useMemo(
		() => layoutFlowGraph(data.nodes, data.edges, accountRef),
		[data, accountRef],
	)
	const accountNos = useMemo(
		() => new Map(data.nodes.map((node) => [node.accountRef, node.accountNo])),
		[data],
	)
	const counts = useMemo(() => {
		const result = { in: 0, out: 0, via: 0, context: 0 }
		graph.edges.forEach((edge) => {
			result[edge.kind] += 1
			if (edge.scope === "CONTEXT") result.context += 1
		})
		return result
	}, [graph])

	// 계좌가 많아 무대가 스크롤되면, 처음에는 가운데(조사 대상 계좌)가 보이게 맞춰요.
	const stageRef = useRef(null)
	useEffect(() => {
		const stage = stageRef.current
		if (!stage) return
		stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2
		stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2
	}, [graph])

	const active = hovered ?? pinned
	const isEdgeActive = (edge, key) =>
		active?.type === "edge"
			? active.key === key
			: active?.type === "node" && (edge.source === active.ref || edge.target === active.ref)
	const isNodeActive = (ref) =>
		active?.type === "edge"
			? active.edge.source === ref || active.edge.target === ref
			: active?.type === "node" &&
				(active.ref === ref ||
					graph.edges.some(
						(edge) =>
							(edge.source === active.ref && edge.target === ref) ||
							(edge.target === active.ref && edge.source === ref),
					))
	const same = (a, b) => a && b && a.type === b.type && a.key === b.key && a.ref === b.ref
	const handlers = (item) => ({
		onMouseEnter: () => setHovered(item),
		onMouseLeave: () => setHovered(null),
		onClick: (event) => {
			event.stopPropagation()
			setPinned(same(pinned, item) ? null : item)
		},
	})
	// 계좌는 키보드로도 — Tab 으로 옮기면 올린 것과 같고, Enter·Space 로 고정해요. 선(거래)은 [근거 거래] 탭 표에서 봐요.
	const nodeKeys = (item) => ({
		role: "button",
		tabIndex: 0,
		"aria-pressed": Boolean(same(pinned, item)),
		onFocus: () => setHovered(item),
		onBlur: () => setHovered(null),
		onKeyDown: (event) => {
			if (event.key !== "Enter" && event.key !== " ") return
			event.preventDefault()
			setPinned(same(pinned, item) ? null : item)
		},
	})
	const activeEdge = active?.type === "edge" ? active.edge : null
	const amountLabel = activeEdge ? formatAmount(activeEdge.amount, activeEdge.currency) : ""
	const labelWidth = amountLabel.length * 6.8 + 20

	return (
		<div className="flow-graph">
			<div className="flow-graph-head">
				<p className="flow-graph-stats">
					계좌 <strong>{data.nodes.length}</strong>
					<span aria-hidden="true"> · </span>
					거래 <strong>{graph.edges.length}</strong>
				</p>
				<ul className="flow-graph-legend" aria-label="범례">
					{KINDS.filter(([kind]) => counts[kind] > 0).map(([kind, label]) => (
						<li key={kind} title={KIND_HINTS[kind]}>
							<span className={`flow-graph-swatch is-${kind}`} aria-hidden="true" />
							{label} {counts[kind]}건
						</li>
					))}
					{counts.context > 0 && (
						<li>
							<span className="flow-graph-swatch is-context" aria-hidden="true" />
							점선 = 참고 거래 {counts.context}건
						</li>
					)}
				</ul>
			</div>
			<div
				ref={stageRef}
				className="flow-graph-stage"
				role="region"
				aria-label="자금 흐름 그림"
				tabIndex={0}
			>
				<svg
					className={active ? "case-graph has-active" : "case-graph"}
					width={graph.width}
					height={graph.height}
					viewBox={`0 0 ${graph.width} ${graph.height}`}
					role="group"
					aria-label={`계좌 ${data.nodes.length}개, 거래 ${data.returnedTransactionCount}건`}
					onClick={() => setPinned(null)}
				>
					<defs>
						{KINDS.map(([kind]) => (
							<marker
								key={kind}
								id={`flow-graph-arrow-${kind}`}
								className={`flow-graph-arrow is-${kind}`}
								markerUnits="userSpaceOnUse"
								markerWidth="10"
								markerHeight="10"
								refX="1"
								refY="5"
								orient="auto"
							>
								<path d="M0,0.5 L10,5 L0,9.5 L2.6,5 z" />
							</marker>
						))}
					</defs>
					{graph.edges.map((edge, index) => {
						if (!edge.d) return null
						const key = edgeKey(edge, index)
						const context = edge.scope === "CONTEXT"
						const className = [
							"flow-graph-edge",
							`is-${edge.kind}`,
							context && "is-context",
							isEdgeActive(edge, key) && "is-active",
						]
							.filter(Boolean)
							.join(" ")
						return (
							<g
								key={key}
								className={className}
								{...handlers({ type: "edge", key, edge })}
							>
								<path
									data-testid="graph-edge"
									className="flow-graph-line"
									d={edge.d}
									strokeWidth={edge.weight}
									markerEnd={`url(#flow-graph-arrow-${edge.kind})`}
								/>
								{!context && <path className="flow-graph-pulse" d={edge.d} />}
								<path className="flow-graph-hit" d={edge.d} />
							</g>
						)
					})}
					{data.nodes.map((node) => {
						const point = graph.points.get(node.accountRef)
						if (!point) return null
						const target = node.accountRef === accountRef
						const className = [
							"flow-graph-node",
							target && "is-target",
							isNodeActive(node.accountRef) && "is-active",
						]
							.filter(Boolean)
							.join(" ")
						const left = point.x - point.width / 2
						const top = point.y - point.height / 2
						return (
							<g
								key={node.accountRef}
								className={className}
								aria-label={`계좌 ${node.accountNo}${target ? " (조사 대상)" : ""}`}
								{...handlers({ type: "node", ref: node.accountRef })}
								{...nodeKeys({ type: "node", ref: node.accountRef })}
							>
								<rect
									className="flow-graph-box"
									x={left}
									y={top}
									width={point.width}
									height={point.height}
									rx={target ? 14 : point.height / 2}
								/>
								{target && (
									<text
										className="flow-graph-caption"
										x={point.x}
										y={point.y - 9}
										textAnchor="middle"
									>
										조사 대상 계좌
									</text>
								)}
								<text
									x={point.x}
									y={point.y + (target ? 13 : 4.5)}
									textAnchor="middle"
								>
									{node.accountNo}
									{target ? " (대상)" : ""}
								</text>
							</g>
						)
					})}
					{activeEdge?.labelAt && (
						<g className="flow-graph-label" aria-hidden="true">
							<rect
								x={activeEdge.labelAt.x - labelWidth / 2}
								y={activeEdge.labelAt.y - 34}
								width={labelWidth}
								height="24"
								rx="12"
							/>
							<text
								x={activeEdge.labelAt.x}
								y={activeEdge.labelAt.y - 17.5}
								textAnchor="middle"
							>
								{amountLabel}
							</text>
						</g>
					)}
				</svg>
			</div>
			<div className="flow-graph-detail" aria-live="polite">
				<FlowGraphDetail
					active={active}
					graph={graph}
					accountNos={accountNos}
					accountRef={accountRef}
				/>
			</div>
		</div>
	)
}

export default function CaseFlowGraph({ caseNo, accountRef }) {
	const query = useCaseGraph(caseNo)
	const data = query.data
	// 대상 계좌로 돌아온 길이 있으면 경로 지도를 먼저 보여 주고, 전체 그래프는 펼쳐서 봐요.
	const routes = useMemo(
		() => (data ? findReturnRoutes(data.edges, accountRef) : []),
		[data, accountRef],
	)
	const accountNos = useMemo(
		() => new Map((data?.nodes ?? []).map((node) => [node.accountRef, node.accountNo])),
		[data],
	)
	return (
		<section className="case-panel case-flow" aria-labelledby="graph-title">
			<h2 id="graph-title" className="visually-hidden">
				자금 흐름 그래프
			</h2>
			<AsyncState query={query} />
			{data && data.truncated && (
				<p className="case-action-note">
					전체 {data.totalTransactionCount}건 중 {data.returnedTransactionCount}건만
					그렸어요. 전체 거래는 근거 거래 탭의 표에서 볼 수 있어요.
				</p>
			)}
			{data &&
				(data.edges.length ? (
					routes.length ? (
						<>
							<CaseRouteMap
								routes={routes}
								targetRef={accountRef}
								accountNos={accountNos}
							/>
							<details className="flow-graph-more">
								<summary>
									전체 계좌 그래프{" "}
									<span>
										계좌 {data.nodes.length}개 · 거래 {data.edges.length}건
									</span>
								</summary>
								<FlowGraphView data={data} accountRef={accountRef} />
							</details>
						</>
					) : (
						<FlowGraphView data={data} accountRef={accountRef} />
					)
				) : (
					<p>그릴 거래가 없어요.</p>
				))}
		</section>
	)
}
