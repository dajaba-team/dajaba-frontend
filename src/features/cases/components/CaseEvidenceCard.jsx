import { useState } from "react"
import CaseAggregatesPanel from "./CaseAggregatesPanel"
import CaseTransactionsPanel from "./CaseTransactionsPanel"
import CaseFlowGraph from "./CaseFlowGraph"

// 거래 근거 카드 (화면 설계 CASE-02 왼쪽 단) — 합계는 늘 위에, 그 아래를 자금 흐름·근거 거래·참고 거래 탭으로 나눠요.
// 처음엔 자금 흐름 그래프가 열려 있어요 — 전체 그림을 먼저 보고 표로 내려가요.
// 근거(EVIDENCE)와 참고(CONTEXT)는 한 표에 섞지 않아요. 그래프와 표는 탭을 바꿔도 다시 부르지 않게 숨기기만 해요.
const TABS = [
	["GRAPH", "자금 흐름"],
	["EVIDENCE", "근거 거래"],
	["CONTEXT", "참고 거래"],
]

export default function CaseEvidenceCard({
	detail,
	highlight = null,
	onClearHighlight,
	onReopenAsk,
}) {
	const [tab, setTab] = useState("GRAPH")
	// 그래프 탭에 있는 동안에도 마지막에 보던 거래 범위를 그대로 둬요.
	const [scope, setScope] = useState("EVIDENCE")
	// 질문 패널에서 [근거 거래 n건 보기]를 누를 때마다 근거 거래 탭으로 옮겨요(SCRUM-303). 탭 구조(SCRUM-247)는 그대로.
	const [seenHighlight, setSeenHighlight] = useState(highlight?.seq ?? null)
	if (highlight && highlight.seq !== seenHighlight) {
		setSeenHighlight(highlight.seq)
		setTab("EVIDENCE")
		setScope("EVIDENCE")
	}
	const agg = detail.aggregates
	// 서버는 내 계좌끼리 옮긴 거래를 유입·유출 건수에서 빼고 전체 건수에는 넣어요.
	// 그래서 "전체 − 유입 − 유출"에는 경유와 내 계좌 이체가 같이 들어가요 — 경유만 따로 오지 않아 "그 밖"으로 적어요.
	const counts =
		agg && agg.transactionCount > 0
			? (() => {
					const direct = agg.inbound.transactionCount + agg.outbound.transactionCount
					return { direct, other: Math.max(agg.transactionCount - direct, 0) }
				})()
			: null
	return (
		<section
			className="case-panel case-card"
			aria-labelledby="evidence-card-title"
			id="case-evidence-card"
		>
			<div className="case-card-head evidence-head">
				<div>
					<p className="kicker">
						거래 분석 <span>01</span>
					</p>
					<h2 id="evidence-card-title">거래 근거</h2>
				</div>
				{counts && (
					<p className="minor-pair">
						대상 계좌 직접 거래 <b>{counts.direct}건</b>
						<i aria-hidden="true" /> 그 밖 <b>{counts.other}건</b>(경유·내 계좌 이체)
					</p>
				)}
			</div>
			<CaseAggregatesPanel aggregates={detail.aggregates} />
			<div className="case-tabs" role="group" aria-label="거래 근거 보기">
				{TABS.map(([value, label]) => (
					<button
						key={value}
						type="button"
						aria-pressed={tab === value}
						onClick={() => {
							setTab(value)
							if (value !== "GRAPH") setScope(value)
						}}
					>
						{label}
					</button>
				))}
			</div>
			<div className="case-tab-panel" hidden={tab === "GRAPH"}>
				<CaseTransactionsPanel
					key={scope}
					caseNo={detail.caseNo}
					scope={scope}
					highlight={highlight}
					onClearHighlight={onClearHighlight}
					onReopenAsk={onReopenAsk}
				/>
			</div>
			<div className="case-tab-panel" hidden={tab !== "GRAPH"}>
				<CaseFlowGraph
					caseNo={detail.caseNo}
					accountRef={detail.accountRef}
					ruleId={detail.alert?.ruleId}
				/>
			</div>
			<p className="evidence-foot">
				통화별로 따로 집계하고 환산하지 않아요. 경유·참고 거래는 입출금 합계에서 제외해요.
			</p>
		</section>
	)
}
