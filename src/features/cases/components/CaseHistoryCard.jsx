import { useState } from "react"
import CaseHistoryPanel from "./CaseHistoryPanel"
import CaseNoteHistory from "./CaseNoteHistory"

// 이력 카드 — 본문 맨 아래. 근거를 다 본 뒤 "지금까지 누가 무엇을 했는지"를 확인해요.
// 처리 이력(상태·담당 변경)과 메모 이력은 서버도 나눠 주니(API-11·15) 탭으로 나눠요.
// 안 보이는 탭은 지우지 않고 숨기기만 해요 — 보던 페이지가 그대로 남게.
const TABS = [
	["history", "처리 이력"],
	["notes", "메모 이력"],
]

export default function CaseHistoryCard({ detail }) {
	const [tab, setTab] = useState("history")
	return (
		<section className="case-panel case-card" aria-labelledby="case-history-card-title">
			<div className="case-card-head">
				<h2 id="case-history-card-title">이력</h2>
			</div>
			<div className="case-tabs" role="group" aria-label="이력 보기">
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
			<div className="case-tab-panel" hidden={tab !== "history"}>
				<CaseHistoryPanel caseNo={detail.caseNo} recent={detail.history} />
			</div>
			<div className="case-tab-panel" hidden={tab !== "notes"}>
				<CaseNoteHistory caseNo={detail.caseNo} />
			</div>
		</section>
	)
}
