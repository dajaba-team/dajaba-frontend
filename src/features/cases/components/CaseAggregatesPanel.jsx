import { formatAmount } from "./caseMoney"

// 유입·유출 합계 — 계약서 C2 aggregates. 경보의 근거 거래 전체 기준(그래프·표 미리보기 건수가 아님).
// 통화별로 따로 보여 주고 더하지 않아요. 경유 거래·내 계좌끼리 옮긴 돈은 서버가 합계에서 뺐어요.
function Side({ title, side, kind }) {
	return (
		<div className={`ledger-side is-${kind}`}>
			<span className={`cash-dot ${kind}`} aria-hidden="true">
				{kind === "in" ? "↙" : "↗"}
			</span>
			<dt>{`${title} 합계 (${side.transactionCount}건)`}</dt>
			{side.totals.length ? (
				side.totals.map((total) => (
					<dd key={total.currency}>{formatAmount(total.amount, total.currency)}</dd>
				))
			) : (
				<dd className="is-empty">없음</dd>
			)}
		</div>
	)
}

// 시안의 ledger-strip — 유입·유출 합계를 아이콘 칩과 함께 한 줄로(SCRUM-280).
export default function CaseAggregatesPanel({ aggregates }) {
	return (
		<section className="case-ledger" aria-labelledby="aggregates-title">
			<h2 id="aggregates-title" className="visually-hidden">
				유입·유출 합계
			</h2>
			{aggregates && aggregates.transactionCount > 0 ? (
				<dl className="ledger-strip">
					<Side title="유입" side={aggregates.inbound} kind="in" />
					<Side title="유출" side={aggregates.outbound} kind="out" />
				</dl>
			) : (
				<p className="ledger-note">근거 거래가 없어요.</p>
			)}
		</section>
	)
}
