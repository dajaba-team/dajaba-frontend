import { useState } from "react"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemTime } from "../../../shared/format/time"
import { useCaseHistories } from "../hooks/useCases"
import { HISTORY_LABELS, STATUS_LABELS, labelOf } from "../labels"

// 상태 이력 — 기본은 상세의 최근 20건, [이력 전체 보기]면 계약서 C6 `GET /cases/{case_no}/histories`(페이지).
// 메모 이력은 따로(CaseNoteHistory) — 서버도 상태 이력에 메모(NOTE)를 넣지 않아요.
function HistoryList({ items }) {
	return (
		<ol className="case-history">
			{items.map((entry, index) => (
				<li key={`${entry.createdAt}-${index}`}>
					<strong>{labelOf(HISTORY_LABELS, entry.action)}</strong>{" "}
					{entry.fromStatus && `${labelOf(STATUS_LABELS, entry.fromStatus)} → `}
					{labelOf(STATUS_LABELS, entry.toStatus)} · {entry.createdBy} ·{" "}
					{formatSystemTime(entry.createdAt)}
					{entry.comment && <p className="preserve-lines">{entry.comment}</p>}
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
	return (
		<section aria-labelledby="history-title">
			<h2 id="history-title">{all ? "상태 이력 전체" : "최근 이력"}</h2>
			<button
				type="button"
				onClick={() => {
					setAll(!all)
					setPage(1)
				}}
			>
				{all ? "최근 이력만 보기" : "이력 전체 보기"}
			</button>
			{!all && (recent.length ? <HistoryList items={recent} /> : <p>이력이 없습니다.</p>)}
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
		</section>
	)
}
