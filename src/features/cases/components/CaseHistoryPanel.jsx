import { useState } from "react"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemMinute as formatSystemTime } from "../caseTime"
import { useCaseHistories } from "../hooks/useCases"
import { HISTORY_LABELS, STATUS_LABELS, labelOf } from "../labels"
import { actorLabel } from "../displayText"
import Icon from "../../../shared/ui/dashboard/Icon"

// 상태 이력 — 기본은 상세 최근 이력(최대 20건) 중 앞 5건(SCRUM-428). 목록 아래 [더 보기 ⌄]를 누르면 계약서 C6
// `GET /cases/{case_no}/histories`(페이지)로 전체를 펼치고, [접기 ⌃]로 다시 5건으로 돌아가요.
// 메모 이력은 따로(CaseNoteHistory) — 서버도 상태 이력에 메모(NOTE)를 넣지 않아요.
const RECENT_COUNT = 5
// 상세가 주는 최근 이력의 최대 건수(CASES 명세 API-02) — 꽉 차 있으면 실제로는 더 있을 수 있어 숫자를 쓰지 않아요.
const RECENT_MAX = 20

// 담당이 바뀐 줄은 누구에게서 누구로를 같이 — 배정 「→ 조사역 1」, 변경 「조사역 1 → 조사역 2」(SCRUM-348).
// 서버가 안 주면(다른 동작·옛 응답) 아무것도 안 붙여요.
function assigneeChange({ fromAssignee, toAssignee }) {
	if (!toAssignee) return null
	const name = (user) => user.displayName || user.loginId
	return (
		<span className="case-history-assignee">
			({fromAssignee ? `${name(fromAssignee)} → ` : "→ "}
			{name(toAssignee)}){" "}
		</span>
	)
}
// 한 줄에 다 이어 붙이면 좁은 탭에서 날짜가 「2026-」「11-23」으로 끊겨서(SCRUM-400) 타임라인으로 나눠요 —
// 동작(+담당 변경) / 상태 변화 / 작업자·시각 / 사유 순서로 한 줄씩.
function HistoryList({ items }) {
	return (
		<ol className="case-timeline">
			{items.map((entry, index) => (
				<li key={`${entry.createdAt}-${index}`} className="case-timeline-item">
					<p className="case-timeline-head">
						<strong>{labelOf(HISTORY_LABELS, entry.action)}</strong>{" "}
						{assigneeChange(entry)}
					</p>
					<p className="case-timeline-status">
						{entry.fromStatus && (
							<>
								<span>{labelOf(STATUS_LABELS, entry.fromStatus)}</span>
								<span className="case-timeline-arrow">→</span>
							</>
						)}
						<span className="case-timeline-to">
							{labelOf(STATUS_LABELS, entry.toStatus)}
						</span>
					</p>
					<p className="case-timeline-meta">
						{actorLabel(entry.createdBy)} ·{" "}
						<time dateTime={entry.createdAt}>{formatSystemTime(entry.createdAt)}</time>
					</p>
					{entry.comment && (
						<p className="case-timeline-comment preserve-lines">{entry.comment}</p>
					)}
				</li>
			))}
		</ol>
	)
}

export default function CaseHistoryPanel({ caseNo, recent }) {
	const [all, setAll] = useState(false)
	const [page, setPage] = useState(1)
	const query = useCaseHistories(caseNo, page, all)
	const data = query.data
	const hidden = recent.length - RECENT_COUNT
	const moreLabel = recent.length >= RECENT_MAX ? "이력 더 보기" : `이력 ${hidden}건 더 보기`
	return (
		<section aria-labelledby="history-title">
			<h2 id="history-title">{all ? "처리 이력 전체" : "처리 이력"}</h2>
			{!all &&
				(recent.length ? (
					<HistoryList items={recent.slice(0, RECENT_COUNT)} />
				) : (
					<p>이력이 없습니다.</p>
				))}
			{all && <AsyncState query={query} />}
			{all &&
				data &&
				(data.items.length ? (
					<>
						<HistoryList items={data.items} />
						{data.totalPages > 1 && (
							<nav aria-label="이력 페이지">
								<button
									type="button"
									disabled={page <= 1}
									onClick={() => setPage(page - 1)}
								>
									최근
								</button>{" "}
								{page} / {data.totalPages}{" "}
								<button
									type="button"
									disabled={page >= data.totalPages}
									onClick={() => setPage(page + 1)}
								>
									이전
								</button>
							</nav>
						)}
					</>
				) : (
					<p>이력이 없습니다.</p>
				))}
			{(all || hidden > 0) && (
				<button
					type="button"
					className="case-history-toggle"
					aria-expanded={all}
					onClick={() => {
						setAll(!all)
						setPage(1)
					}}
				>
					{all ? "접기" : moreLabel}
					<Icon name="chevron" size={16} />
				</button>
			)}
		</section>
	)
}
