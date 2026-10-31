import "../styles/dashboard-demo.css"
import { useState } from "react"
import Badge from "../../../shared/ui/dashboard/Badge.jsx"
import Icon from "../../../shared/ui/dashboard/Icon.jsx"
export default function FlowGraph({ db }) {
	const [selected, setSelected] = useState(db.transactions[0].transaction_id)
	const [zoom, setZoom] = useState(1)
	const tx = db.transactions.find((item) => item.transaction_id === selected)
	return (
		<section className="panel graph-card">
			<div className="section-head">
				<div>
					<h2>자금 흐름 그래프</h2>
					<p>노드 = 계좌 · 선 = 개별 거래 · 일부 미리보기</p>
				</div>
				<Badge tone="amber">전체 47건 중 5건 표시 · truncated=true</Badge>
			</div>
			<div className="graph-workspace">
				<svg
					viewBox="0 0 800 300"
					style={{
						transform: `scale(${zoom})`,
					}}
				>
					<defs>
						<marker
							id="arrow"
							markerWidth="8"
							markerHeight="8"
							refX="7"
							refY="3"
							orient="auto"
						>
							<path d="M0,0 L0,6 L8,3 z" />
						</marker>
					</defs>
					{db.transactions.map((item, index) => {
						const inbound = item.direction === "IN"
						const y = 45 + index * 52
						return (
							<g
								key={item.transaction_id}
								role="button"
								tabIndex={0}
								aria-label={`거래 ${item.transaction_id} 선택`}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault()
										setSelected(item.transaction_id)
									}
								}}
								onClick={() => setSelected(item.transaction_id)}
								className={
									selected === item.transaction_id ? "edge selected" : "edge"
								}
							>
								<line
									x1={inbound ? 100 : 400}
									y1={inbound ? y : 150}
									x2={inbound ? 400 : 690}
									y2={inbound ? 150 : y}
									markerEnd="url(#arrow)"
								/>
								<text x={inbound ? 180 : 515} y={(inbound ? y : 150) - 8}>
									{item.transaction_id} · USD {item.amount.toLocaleString()}
								</text>
							</g>
						)
					})}
					<g className="graph-node target">
						<circle cx="400" cy="150" r="46" />
						<text x="400" y="147">
							{db.cases[0].masked_account_no}
						</text>
						<text x="400" y="166">
							조사 대상
						</text>
					</g>
					{db.transactions
						.filter((t) => t.direction === "IN")
						.map((item, index) => (
							<g
								className="graph-node"
								key={item.from_account_ref}
								role="button"
								tabIndex={0}
								aria-label={`거래 ${item.transaction_id} 선택`}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault()
										setSelected(item.transaction_id)
									}
								}}
								onClick={() => setSelected(item.transaction_id)}
							>
								<circle cx="100" cy={45 + index * 52} r="26" />
								<text x="100" y={49 + index * 52}>
									{item.from_masked_account_no.slice(-4)}
								</text>
							</g>
						))}
					{db.transactions
						.filter((t) => t.direction === "OUT")
						.map((item, index) => (
							<g
								className="graph-node out"
								key={item.to_account_ref}
								role="button"
								tabIndex={0}
								aria-label={`거래 ${item.transaction_id} 선택`}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault()
										setSelected(item.transaction_id)
									}
								}}
								onClick={() => setSelected(item.transaction_id)}
							>
								<circle cx="690" cy={201 + index * 52} r="28" />
								<text x="690" y={205 + index * 52}>
									{item.to_masked_account_no.slice(-4)}
								</text>
							</g>
						))}
				</svg>
				<div className="zoom">
					<button
						aria-label="그래프 확대"
						onClick={() => setZoom(Math.min(1.3, zoom + 0.1))}
					>
						<Icon name="plus" />
					</button>
					<button
						aria-label="그래프 축소"
						onClick={() => setZoom(Math.max(0.8, zoom - 0.1))}
					>
						<Icon name="minus" />
					</button>
					<button onClick={() => setZoom(1)}>전체</button>
				</div>
			</div>
			<div className="graph-selection">
				<strong>{tx.transaction_id}</strong>
				<span>
					{tx.from_masked_account_no} → {tx.to_masked_account_no}
				</span>
				<span>
					USD {tx.amount.toLocaleString()} · {tx.transaction_ts}
				</span>
			</div>
		</section>
	)
}
