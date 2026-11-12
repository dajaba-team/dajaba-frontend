import { useState } from "react"
import CaseMemoEditor from "./CaseMemoEditor"
import CaseNoteHistory from "./CaseNoteHistory"
import CaseSummaryPanel from "./CaseSummaryPanel"
import CaseHistoryPanel from "./CaseHistoryPanel"

// 메모 · AI 요약 · 상태 이력 카드 (화면 설계 CASE-02 오른쪽 단).
// 탭을 바꿔도 쓰던 메모·요약 요청 상태가 사라지지 않게, 안 보이는 탭은 지우지 않고 숨기기만 해요.
const TABS = [
	["memo", "메모"],
	["summary", "AI 요약"],
	["history", "상태 이력"],
]

// 메모를 고칠 수 있는 상태인데 버튼(UPDATE_NOTES)이 없으면 담당자가 아니라서예요 — 안내 문구만 고르고,
// 저장 가능 여부는 서버 available_actions 그대로예요(BE CaseStatus EDITABLE + 보완 반려).
function memoEditableStatus(detail) {
	return (
		["REVIEWING", "ESCALATED", "DRAFTED"].includes(detail.status) ||
		(detail.status === "REJECTED" && detail.rejectionReasonCode === "NEED_REVISION")
	)
}

export default function CaseNotesCard({ detail, onRefresh }) {
	const [tab, setTab] = useState("memo")
	return (
		<section className="case-panel case-card" aria-label="메모·요약·이력">
			<div className="case-tabs" role="group" aria-label="메모·요약·이력 보기">
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
			<div className="case-tab-panel" hidden={tab !== "memo"}>
				{detail.availableActions.includes("UPDATE_NOTES") ? (
					<CaseMemoEditor key={detail.caseNo} detail={detail} onRefresh={onRefresh} />
				) : (
					<section aria-labelledby="memo-readonly-title">
						<h2 id="memo-readonly-title">조사 메모</h2>
						<p className="preserve-lines">{detail.investigatorNotes || "메모 없음"}</p>
						<p className="case-action-note">
							{memoEditableStatus(detail)
								? "담당 조사역만 메모를 수정할 수 있어요."
								: "현재 케이스는 읽기 전용입니다."}
						</p>
					</section>
				)}
				<CaseNoteHistory caseNo={detail.caseNo} />
			</div>
			<div className="case-tab-panel" hidden={tab !== "summary"}>
				<CaseSummaryPanel detail={detail} />
			</div>
			<div className="case-tab-panel" hidden={tab !== "history"}>
				<CaseHistoryPanel caseNo={detail.caseNo} recent={detail.history} />
			</div>
		</section>
	)
}
