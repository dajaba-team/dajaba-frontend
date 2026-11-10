import { useMemo } from "react"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatDataTime } from "../../../shared/format/time"
import { useCaseGraph } from "../hooks/useCases"
import { formatAmount } from "./caseMoney"

// 자금 흐름 그래프 — 계약서 C5 `GET /cases/{case_no}/graph`. 노드 = 계좌(account_ref), 선 = 거래 하나.
// 대상 계좌를 가운데, 나머지는 둘레에 놓아요. 참고 거래(CONTEXT)는 점선. 잘리면 "전체 N건 중 M건" — 미리보기로 합계를 내지 않아요.
const SIZE = 480
const CENTER = SIZE / 2
const RADIUS = 190

function layout(nodes, targetRef) {
	const others = nodes.filter((node) => node.accountRef !== targetRef)
	const points = new Map()
	points.set(targetRef, { x: CENTER, y: CENTER })
	others.forEach((node, index) => {
		const angle = (2 * Math.PI * index) / Math.max(others.length, 1) - Math.PI / 2
		points.set(node.accountRef, {
			x: CENTER + RADIUS * Math.cos(angle),
			y: CENTER + RADIUS * Math.sin(angle),
		})
	})
	return points
}

export default function CaseFlowGraph({ caseNo, accountRef }) {
	const query = useCaseGraph(caseNo)
	const data = query.data
	const points = useMemo(
		() => (data ? layout(data.nodes, accountRef) : new Map()),
		[data, accountRef],
	)
	return (
		<section className="case-panel" aria-labelledby="graph-title">
			<h2 id="graph-title">자금 흐름 그래프</h2>
			<AsyncState query={query} />
			{data && data.truncated && (
				<p className="case-action-note">
					전체 {data.totalTransactionCount}건 중 {data.returnedTransactionCount}건만
					그렸어요. 전체 거래는 위 표에서 볼 수 있어요.
				</p>
			)}
			{data &&
				(data.edges.length ? (
					<svg
						className="case-graph"
						viewBox={`0 0 ${SIZE} ${SIZE}`}
						role="img"
						aria-label={`계좌 ${data.nodes.length}개, 거래 ${data.returnedTransactionCount}건`}
					>
						<defs>
							<marker
								id="case-graph-arrow"
								markerWidth="8"
								markerHeight="8"
								refX="20"
								refY="3"
								orient="auto"
							>
								<path d="M0,0 L0,6 L8,3 z" />
							</marker>
						</defs>
						{data.edges.map((edge) => {
							const from = points.get(edge.source)
							const to = points.get(edge.target)
							if (!from || !to) return null
							return (
								<line
									key={edge.transactionId}
									data-testid="graph-edge"
									className={edge.scope === "CONTEXT" ? "edge context" : "edge"}
									x1={from.x}
									y1={from.y}
									x2={to.x}
									y2={to.y}
									strokeDasharray={edge.scope === "CONTEXT" ? "6 4" : undefined}
									markerEnd="url(#case-graph-arrow)"
								>
									<title>
										{`거래 ${edge.transactionId} · ${formatDataTime(edge.ts)} · ${formatAmount(edge.amount, edge.currency)}`}
									</title>
								</line>
							)
						})}
						{data.nodes.map((node) => {
							const point = points.get(node.accountRef)
							const target = node.accountRef === accountRef
							return (
								<g
									key={node.accountRef}
									className={target ? "graph-node target" : "graph-node"}
								>
									<circle cx={point.x} cy={point.y} r={target ? 30 : 18} />
									<text
										x={point.x}
										y={point.y + (target ? 46 : 32)}
										textAnchor="middle"
									>
										{node.accountNo}
										{target ? " (대상)" : ""}
									</text>
								</g>
							)
						})}
					</svg>
				) : (
					<p>그릴 거래가 없어요.</p>
				))}
		</section>
	)
}
