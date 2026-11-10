import { useState } from "react"
import { useCaseNoteHistories } from "../hooks/useCases"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemTime } from "../../../shared/format/time"

// 메모 이력 — 계약서 C8 `GET /cases/{case_no}/note-histories`. 조회 3역할, 최신 먼저.
// 상태 이력(최근 이력)에는 메모 전문이 섞이지 않아서(BE 명세 API-11) 여기서 따로 보여 줘요.
const textOf = (text) => (text === "" ? "(메모 비움)" : text)

export default function CaseNoteHistory({ caseNo }) {
	const [page, setPage] = useState(1)
	const query = useCaseNoteHistories(caseNo, page)
	const data = query.data
	return (
		<section aria-labelledby="note-history-title">
			<h2 id="note-history-title">메모 이력</h2>
			<AsyncState query={query} />
			{data &&
				(data.items.length ? (
					<>
						<ol className="case-history">
							{data.items.map((entry) => (
								<li key={entry.caseVersionBefore}>
									<strong>{entry.createdBy}</strong> ·{" "}
									{formatSystemTime(entry.createdAt)} · 버전{" "}
									{entry.caseVersionBefore}에서
									<p className="preserve-lines">{textOf(entry.afterText)}</p>
									{entry.beforeText != null && (
										<details>
											<summary>이전 메모</summary>
											<p className="preserve-lines">
												{textOf(entry.beforeText)}
											</p>
										</details>
									)}
								</li>
							))}
						</ol>
						{data.totalPages > 1 && (
							<nav aria-label="메모 이력 페이지">
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
					<p>메모 이력이 없습니다.</p>
				))}
		</section>
	)
}
