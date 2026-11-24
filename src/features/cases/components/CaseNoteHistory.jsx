import { useState } from "react"
import { useCaseNoteHistories } from "../hooks/useCases"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemMinute as formatSystemTime } from "../caseTime"
import { actorLabel } from "../displayText"

// 메모 이력 — 계약서 C8 `GET /cases/{case_no}/note-histories`. 조회 3역할, 최신 먼저.
// 상태 이력(최근 이력)에는 메모 전문이 섞이지 않아서(BE 명세 API-11) 여기서 따로 보여 줘요.
// 세로선 타임라인: 누가·언제 → 그때 저장한 메모. 맨 위(가장 최근)는 지금 메모라 [현재] 표시만 붙여요.
// 내부 버전 번호는 업무에 쓸 일이 없어 보이지 않아요. 바꾸기 전 내용은 [이전 메모 보기]로 펼쳐요.
const textOf = (text) => (text === "" ? "(메모 비움)" : text)

export default function CaseNoteHistory({ caseNo }) {
	const [page, setPage] = useState(1)
	const query = useCaseNoteHistories(caseNo, page)
	const data = query.data
	return (
		<section className="memo-history" aria-labelledby="note-history-title">
			<h3 id="note-history-title">
				메모 이력
				{data?.total > 0 && <span className="memo-history-count">{data.total}</span>}
			</h3>
			<AsyncState query={query} />
			{data &&
				(data.items.length ? (
					<>
						<ol className="memo-timeline">
							{data.items.map((entry, index) => (
								<li key={entry.caseVersionBefore}>
									<p className="memo-timeline-meta">
										<strong>{actorLabel(entry.createdBy)}</strong>
										<time dateTime={entry.createdAt}>
											{formatSystemTime(entry.createdAt)}
										</time>
										{page === 1 && index === 0 && (
											<span className="memo-current">현재</span>
										)}
									</p>
									<p className="memo-timeline-text preserve-lines">
										{textOf(entry.afterText)}
									</p>
									{entry.beforeText != null && (
										<details className="memo-before">
											<summary>이전 메모 보기</summary>
											<p className="preserve-lines">
												{textOf(entry.beforeText)}
											</p>
										</details>
									)}
								</li>
							))}
						</ol>
						{data.totalPages > 1 && (
							<nav className="memo-history-pages" aria-label="메모 이력 페이지">
								<button
									type="button"
									disabled={page <= 1}
									onClick={() => setPage(page - 1)}
								>
									최근
								</button>
								<span>
									{page} / {data.totalPages}
								</span>
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
					<p className="memo-history-empty">메모 이력이 없습니다.</p>
				))}
		</section>
	)
}
