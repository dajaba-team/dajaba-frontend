import { formatDataTime } from "../../../shared/format/time"
import { formatAmount } from "./caseMoney"
import { hopKind, hopTime, routeRows } from "./flowRoutes"

// 경로 지도 — 대상 계좌(A)에서 나간 돈이 경로 계좌(B, C …)를 거쳐 A로 돌아온 길을 그려요(SCRUM-280 시안).
// 왼쪽 작은 원은 순환 모양만, 오른쪽 일자형은 단계별 시각·금액을 보여 줘요(SCRUM-296 시안 B).
// 화면이 시간 순서로 찾은 길이라 룰이 찾은 rule_facts.paths 와 다를 수 있어요 — 머리에 "룰 판정 아님"을 적어요.
// 계좌 글자는 처음 나온 순서대로 붙이고, 대상 계좌는 늘 A예요. 아래 [경로 거래 전체 표]에 거래 ID를 함께 적어요.
function letters(routes, targetRef) {
	const map = new Map([[targetRef, "A"]])
	routes.flat().forEach((edge) => {
		;[edge.source, edge.target].forEach((ref) => {
			if (!map.has(ref)) map.set(ref, String.fromCharCode(65 + map.size))
		})
	})
	return map
}

// 작은 원 — 계좌 글자만 원 위에 놓고 시계 방향 화살표로 이어요. 시각·금액은 오른쪽 일자형에서 읽어요.
const RING = { size: 112, r: 38, node: 12 }
function RouteRing({ route, names, targetRef, index }) {
	const refs = route.map((edge) => edge.source)
	const c = RING.size / 2
	const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / refs.length
	const at = (a) => [c + RING.r * Math.cos(a), c + RING.r * Math.sin(a)]
	const gap = (RING.node + 4) / RING.r
	const arc = (i) => {
		const a1 = angle(i) + gap
		const a2 = angle(i + 1) - gap
		const [x1, y1] = at(a1)
		const [x2, y2] = at(a2)
		return `M${x1.toFixed(1)},${y1.toFixed(1)} A${RING.r},${RING.r} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)}`
	}
	const markerId = `route-ring-arrow-${index}`
	return (
		<div className="route-ring" aria-hidden="true">
			<svg width={RING.size} height={RING.size} viewBox={`0 0 ${RING.size} ${RING.size}`}>
				<defs>
					<marker
						id={markerId}
						markerWidth="7"
						markerHeight="7"
						refX="5"
						refY="3.5"
						orient="auto"
					>
						<path className="route-ring-arrow" d="M0,0 L7,3.5 L0,7 z" />
					</marker>
				</defs>
				{refs.map((ref, i) => (
					<path
						key={`arc-${i}`}
						className="route-ring-arc"
						d={arc(i)}
						markerEnd={`url(#${markerId})`}
					/>
				))}
				{refs.map((ref, i) => {
					const [x, y] = at(angle(i))
					const target = ref === targetRef
					return (
						<g key={`node-${i}`} className={target ? "is-target" : undefined}>
							<circle cx={x} cy={y} r={RING.node} />
							<text x={x} y={y + 4} textAnchor="middle">
								{names.get(ref)}
							</text>
						</g>
					)
				})}
				<text className="route-ring-steps" x={c} y={c + 4} textAnchor="middle">
					{route.length}단계
				</text>
			</svg>
			<small>순환</small>
		</div>
	)
}

export default function CaseRouteMap({ routes, targetRef, accountNos }) {
	const names = letters(routes, targetRef)
	const no = (ref) => accountNos.get(ref) ?? ref
	return (
		<>
			<p className="route-note">거래 시각 순으로 이은 경로 (참고용)</p>
			{routes.map((route, index) => {
				const nodes = [route[0].source, ...route.map((edge) => edge.target)]
				const nodeLabel = (i) =>
					i === 0 ? "대상 계좌" : i === nodes.length - 1 ? "대상 계좌 복귀" : "경로 계좌"
				return (
					<figure
						key={route.map((edge) => edge.transactionId).join("-")}
						className="route-canvas"
						aria-label={`경로 ${index + 1}: ${nodes.map(no).join(" → ")}`}
					>
						<figcaption className="canvas-head">
							<span>
								<i aria-hidden="true" /> 경로 {index + 1}
							</span>
							<span>{route.length}단계 · 대상 계좌 복귀</span>
						</figcaption>
						<div className="route-body">
							<RouteRing
								route={route}
								names={names}
								targetRef={targetRef}
								index={index}
							/>
							<div className="route-rows">
								{routeRows(route).map(({ start, hops }) => (
									<ol key={start} className="route-track" start={start + 1}>
										{hops.map((edge, k) => {
											const i = start + k
											const ref = nodes[i]
											const continued = k === 0 && i > 0
											return (
												<li key={`${ref}-${i}`} className="route-step">
													<div
														className={[
															"route-node",
															ref === targetRef && "target",
															continued && "continued",
														]
															.filter(Boolean)
															.join(" ")}
														aria-hidden={continued || undefined}
													>
														<span
															className="node-circle"
															aria-hidden="true"
														>
															{names.get(ref)}
														</span>
														<b>{continued ? "이어서" : nodeLabel(i)}</b>
														<small>{no(ref)}</small>
													</div>
													<div className="route-hop">
														<span>
															{String(i + 1).padStart(2, "0")} ·{" "}
															{hopKind(edge, targetRef)}
														</span>
														<i aria-hidden="true" />
														<small>{hopTime(edge.ts)}</small>
														<strong className="hop-amount">
															{formatAmount(
																edge.amount,
																edge.currency,
															)}
														</strong>
													</div>
													{k === hops.length - 1 && (
														<div
															className={`route-node${nodes[i + 1] === targetRef ? " target" : ""}`}
														>
															<span
																className="node-circle"
																aria-hidden="true"
															>
																{names.get(nodes[i + 1])}
															</span>
															<b>{nodeLabel(i + 1)}</b>
															<small>{no(nodes[i + 1])}</small>
														</div>
													)}
												</li>
											)
										})}
									</ol>
								))}
							</div>
						</div>
					</figure>
				)
			})}
			<details className="route-ledger">
				<summary>
					경로 거래 전체 표 <span>단계별 시각·계좌·금액과 거래 ID</span>
				</summary>
				<div className="case-table-scroll">
					<table className="case-table path-table">
						<thead>
							<tr>
								<th scope="col">경로</th>
								<th scope="col">단계</th>
								<th scope="col">시각</th>
								<th scope="col">보낸 계좌 → 받은 계좌</th>
								<th scope="col">금액(받은 쪽)</th>
								<th scope="col">거래 ID</th>
							</tr>
						</thead>
						<tbody>
							{routes.flatMap((route, r) =>
								route.map((edge, i) => (
									<tr key={`${r}-${edge.transactionId}`}>
										<td>{r + 1}</td>
										<td>
											{String(i + 1).padStart(2, "0")} ·{" "}
											{hopKind(edge, targetRef)}
										</td>
										<td>{formatDataTime(edge.ts)}</td>
										<td className="flow-graph-mono">
											{no(edge.source)} → {no(edge.target)}
										</td>
										<td>{formatAmount(edge.amount, edge.currency)}</td>
										<td>{edge.transactionId}</td>
									</tr>
								)),
							)}
						</tbody>
					</table>
				</div>
			</details>
		</>
	)
}
