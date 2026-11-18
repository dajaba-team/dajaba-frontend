import { formatDataTime } from "../../../shared/format/time"
import { formatAmount } from "./caseMoney"
import { hopKind, hopTime } from "./flowRoutes"

// 경로 지도 — 대상 계좌(A)에서 나간 돈이 경로 계좌(B, C …)를 거쳐 A로 돌아온 길을 한 줄로 그려요(SCRUM-280 시안).
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

export default function CaseRouteMap({ routes, targetRef, accountNos }) {
	const names = letters(routes, targetRef)
	const no = (ref) => accountNos.get(ref) ?? ref
	return (
		<>
			{routes.map((route, index) => {
				const nodes = [route[0].source, ...route.map((edge) => edge.target)]
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
						<ol
							className="route-track"
							style={{
								gridTemplateColumns: nodes
									.map((_, i) => (i ? ".9fr 1fr" : "1fr"))
									.join(" "),
							}}
						>
							{nodes.map((ref, i) => {
								const edge = route[i]
								const target = ref === targetRef
								return (
									<li key={`${ref}-${i}`} className="route-step">
										<div className={`route-node${target ? " target" : ""}`}>
											<span className="node-circle" aria-hidden="true">
												{names.get(ref)}
											</span>
											<b>
												{i === 0
													? "대상 계좌"
													: i === nodes.length - 1
														? "대상 계좌 복귀"
														: "경로 계좌"}
											</b>
											<small>{no(ref)}</small>
										</div>
										{edge && (
											<div className="route-hop">
												<span>
													{String(i + 1).padStart(2, "0")} ·{" "}
													{hopKind(edge, targetRef)}
												</span>
												<i aria-hidden="true" />
												<small>{hopTime(edge.ts)}</small>
												<strong className="hop-amount">
													{formatAmount(edge.amount, edge.currency)}
												</strong>
											</div>
										)}
									</li>
								)
							})}
						</ol>
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
