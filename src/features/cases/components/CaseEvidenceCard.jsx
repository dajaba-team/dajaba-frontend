import { useState } from "react"
import CaseAggregatesPanel from "./CaseAggregatesPanel"
import CaseTransactionsPanel from "./CaseTransactionsPanel"
import CaseFlowGraph from "./CaseFlowGraph"

// 거래 분석 카드 (화면 설계 CASE-02 왼쪽 단) — 합계는 늘 위에, 그 아래를 자금 흐름·근거 거래 탭으로 나눠요.
// 처음엔 자금 흐름 그래프가 열려 있어요 — 전체 그림을 먼저 보고 표로 내려가요.
// 그래프와 표는 탭을 바꿔도 다시 부르지 않게 숨기기만 해요.
// 참고 거래(CONTEXT) 탭은 서버가 MVP 에서 늘 빈 목록을 줘서(SCRUM-244) 열지 않아요 — 서버가 채우면 다시 붙여요.
const TABS = [
	["GRAPH", "자금 흐름"],
	["EVIDENCE", "근거 거래"],
]

export default function CaseEvidenceCard({
	detail,
	highlight = null,
	onClearHighlight,
	onReopenAsk,
}) {
	const [tab, setTab] = useState("GRAPH")
	// 질문 패널에서 [근거 거래 n건 보기]를 누를 때마다 근거 거래 탭으로 옮겨요(SCRUM-303). 탭 구조(SCRUM-247)는 그대로.
	const [seenHighlight, setSeenHighlight] = useState(highlight?.seq ?? null)
	if (highlight && highlight.seq !== seenHighlight) {
		setSeenHighlight(highlight.seq)
		setTab("EVIDENCE")
	}
	return (
		<section
			className="case-panel case-card"
			aria-labelledby="evidence-card-title"
			id="case-evidence-card"
		>
			<div className="case-card-head evidence-head">
				<h2 id="evidence-card-title">거래 분석</h2>
			</div>
			<CaseAggregatesPanel aggregates={detail.aggregates} />
			<div className="case-tabs" role="group" aria-label="거래 분석 보기">
				{TABS.map(([value, label]) => (
					<button
						key={value}
						type="button"
						aria-pressed={tab === value}
						onClick={() => setTab(value)}
					>
						{label}
					</button>
				))}
			</div>
			<div className="case-tab-panel" hidden={tab === "GRAPH"}>
				<CaseTransactionsPanel
					caseNo={detail.caseNo}
					scope="EVIDENCE"
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
		</section>
	)
}
