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

export default function CaseEvidenceCard({ detail }) {
	const [tab, setTab] = useState("GRAPH")
	// 그래프 탭에 있는 동안에도 마지막에 보던 거래 범위를 그대로 둬요.
	const [scope, setScope] = useState("EVIDENCE")
	return (
		<section className="case-panel case-card" aria-labelledby="evidence-card-title">
			<div className="case-card-head">
				<h2 id="evidence-card-title">거래 근거</h2>
				<p className="case-action-note">통화별 합계 · 환산 없음</p>
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
				<CaseTransactionsPanel key={scope} caseNo={detail.caseNo} scope={scope} />
			</div>
			<div className="case-tab-panel" hidden={tab !== "GRAPH"}>
				<CaseFlowGraph caseNo={detail.caseNo} accountRef={detail.accountRef} />
			</div>
		</section>
	)
}
