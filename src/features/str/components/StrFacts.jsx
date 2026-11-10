import { formatDataTime } from "../../../shared/format/time"

// 사실 정보(facts) — AI 서버 코드가 원천을 읽어 계산한 값이에요(안건 23). 읽기 전용.
// 프론트는 다시 계산하지 않고(통화 합산·환산 없음) 받은 문자열 그대로 보여 줘요. 경유(indirect)는 직접 입출금과 따로 써요.
// 모르는 키가 있어도 아래 "전체 값"에서 그대로 볼 수 있어요.

const amountsOf = (flow) =>
	(flow?.by_currency ?? [])
		.map((item) => `${item.currency} ${item.total} (${item.count}건)`)
		.join(" · ")

const countOf = (flow) => (flow?.count == null ? "-" : `${flow.count}건`)

// S2 실제 응답은 *account_key를 가린 *account_no·*account_ref로 바꿔서 줘요(BE SCRUM-205). MSW 시드는 원 모양.
const accountOf = (subject) => subject?.account_no ?? subject?.account_ref ?? null

export default function StrFacts({ facts }) {
	if (!facts) return <p>사실 정보가 없어요.</p>
	const rows = [
		[
			"거래자",
			[facts.subject?.entity_name, facts.subject?.entity_type].filter(Boolean).join(" · "),
		],
		["계좌", accountOf(facts.subject)],
		[
			"기간",
			facts.period
				? `${formatDataTime(facts.period.start)} ~ ${formatDataTime(facts.period.end)}`
				: null,
		],
		["입금", facts.inbound && `${countOf(facts.inbound)} ${amountsOf(facts.inbound)}`.trim()],
		[
			"출금",
			facts.outbound && `${countOf(facts.outbound)} ${amountsOf(facts.outbound)}`.trim(),
		],
		["내부 이체", facts.internal && countOf(facts.internal)],
		["경유(직접 입출금 집계 제외)", facts.indirect && countOf(facts.indirect)],
		["거래 상대", facts.counterparties && countOf(facts.counterparties)],
		["결제 수단", (facts.payment_formats ?? []).join(", ")],
		["유형", facts.typology],
		["보고 기관", facts.reporting_institution],
		[
			"환산 못 한 통화",
			facts.unmapped_currencies?.length ? facts.unmapped_currencies.join(", ") : null,
		],
	].filter(([, value]) => value != null && value !== "")
	return (
		<section className="str-panel" aria-labelledby="str-facts-heading">
			<div className="str-panel-head">
				<h2 id="str-facts-heading">사실 정보</h2>
				<p>읽기 전용 · 서버가 계산한 값이라 본문을 고쳐도 바뀌지 않아요.</p>
			</div>
			<dl className="str-facts">
				{rows.map(([label, value]) => (
					<div key={label}>
						<dt>{label}</dt>
						<dd>{value}</dd>
					</div>
				))}
			</dl>
			{facts.paths && (
				<p className="str-muted">
					자금 경로 블록이 있어요. 경로는 직접 거래 집계와 따로 보여 줘요(아래 전체 값).
				</p>
			)}
			<details className="str-raw">
				<summary>전체 값 보기 (본문 근거 cites 키와 같은 이름)</summary>
				<pre>{JSON.stringify(facts, null, 2)}</pre>
			</details>
		</section>
	)
}
