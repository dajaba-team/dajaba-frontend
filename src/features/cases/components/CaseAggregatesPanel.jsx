import { formatDataTime } from "../../../shared/format/time"
import { formatAmount } from "./caseMoney"

// 유입·유출 합계 — 계약서 C2 aggregates. 경보의 근거 거래 전체 기준(그래프·표 미리보기 건수가 아님).
// 통화별로 따로 보여 주고 더하지 않아요. 경유 거래·내 계좌끼리 옮긴 돈은 서버가 합계에서 뺐어요.
function Side({ title, side }) {
	return (
		<div>
			<dt>
				{title} ({side.transactionCount}건)
			</dt>
			{side.totals.length ? (
				side.totals.map((total) => (
					<dd key={total.currency}>{formatAmount(total.amount, total.currency)}</dd>
				))
			) : (
				<dd>없음</dd>
			)}
		</div>
	)
}

export default function CaseAggregatesPanel({ aggregates }) {
	return (
		<section className="case-panel case-summary" aria-labelledby="aggregates-title">
			<h2 id="aggregates-title">유입·유출 합계</h2>
			{aggregates && aggregates.transactionCount > 0 ? (
				<>
					<dl className="case-aggregates">
						<Side title="유입" side={aggregates.inbound} />
						<Side title="유출" side={aggregates.outbound} />
					</dl>
					<p className="case-action-note">
						근거 거래 {aggregates.transactionCount}건 ·{" "}
						{formatDataTime(aggregates.firstTs)} ~ {formatDataTime(aggregates.lastTs)}.
						경유 거래와 내 계좌끼리 옮긴 돈은 합계에서 뺐어요. 통화가 다르면 더하지
						않아요.
					</p>
				</>
			) : (
				<p>근거 거래가 없어요.</p>
			)}
		</section>
	)
}
