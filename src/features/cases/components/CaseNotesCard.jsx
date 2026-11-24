import CaseMemoEditor from "./CaseMemoEditor"

// 조사 메모 카드 — 오른쪽 작업대 맨 위. 근거를 보며 바로 적고, 그 아래 처리 작업으로 이어져요.
// 메모 이력은 처리 이력과 함께 본문 아래 「이력」 카드에 있어요.

// 메모를 고칠 수 있는 상태인데 버튼(UPDATE_NOTES)이 없으면 담당자가 아니라서예요 — 안내 문구만 고르고,
// 저장 가능 여부는 서버 available_actions 그대로예요(BE CaseStatus EDITABLE + 보완 반려).
function memoEditableStatus(detail) {
	return (
		["REVIEWING", "ESCALATED", "DRAFTED"].includes(detail.status) ||
		(detail.status === "REJECTED" && detail.rejectionReasonCode === "NEED_REVISION")
	)
}

export default function CaseNotesCard({ detail, onRefresh }) {
	return (
		<div className="case-panel case-card case-notes-card">
			{detail.availableActions.includes("UPDATE_NOTES") ? (
				<CaseMemoEditor key={detail.caseNo} detail={detail} onRefresh={onRefresh} />
			) : (
				<section aria-labelledby="memo-readonly-title">
					<h2 id="memo-readonly-title">조사 메모</h2>
					<p className="preserve-lines">{detail.investigatorNotes || "메모 없음"}</p>
					<p className="case-action-note">
						{memoEditableStatus(detail)
							? "담당 조사역만 수정할 수 있습니다."
							: "이 상태에서는 수정할 수 없습니다."}
					</p>
				</section>
			)}
		</div>
	)
}
