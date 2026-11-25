import { groupDigits } from "../../../shared/format/amount"
import { formatDataTime } from "../../../shared/format/time"

// 사실 정보(facts) — AI 서버 코드가 원천을 읽어 계산한 값이에요(안건 23). 읽기 전용.
// 프론트는 다시 계산하지 않고(통화 합산·환산 없음) 받은 문자열에 천 단위 쉼표만 넣어 보여 줘요. 경유(indirect)는 직접 입출금과 따로 써요.
// 화면엔 아래 11개 항목만 표로 — 값이 없으면 "-". 그 밖의 키(환산 못 한 통화·자금 경로 등)는 보여 주지 않아요.
// 표는 반으로 나눠 두 개를 나란히(좁은 화면에선 위아래로) 둬요.

const amountsOf = (flow) =>
	(flow?.by_currency ?? [])
		.map((item) => `${item.currency} ${groupDigits(item.total)} (${item.count}건)`)
		.join(" · ")

const countOf = (flow) => (flow?.count == null ? "-" : `${flow.count}건`)

// S2 실제 응답은 *account_key를 가린 *account_no·*account_ref로 바꿔서 줘요(BE SCRUM-205 #84). MSW 시드는 원 모양.
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
		["경유", facts.indirect && countOf(facts.indirect)],
		["거래 상대", facts.counterparties && countOf(facts.counterparties)],
		["결제 수단", (facts.payment_formats ?? []).join(", ")],
		["유형", facts.typology],
		["보고 기관", facts.reporting_institution],
	]
	const half = Math.ceil(rows.length / 2)
	return (
		<section className="str-panel" aria-labelledby="str-facts-heading">
			<div className="str-panel-head">
				<h2 id="str-facts-heading">사실 정보</h2>
			</div>
			<div className="str-facts-grid">
				{[rows.slice(0, half), rows.slice(half)].map((part, index) => (
					<table
						key={index}
						className="str-table str-facts-table"
						aria-label={`사실 정보 ${index + 1}/2`}
					>
						<tbody>
							{part.map(([label, value]) => (
								<tr key={label}>
									<th scope="row">{label}</th>
									<td>{value == null || value === "" ? "-" : value}</td>
								</tr>
							))}
						</tbody>
					</table>
				))}
			</div>
		</section>
	)
}
