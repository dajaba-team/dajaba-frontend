import { Link, useSearchParams } from "react-router"
import "../styles/cases.css"
import { useCases } from "../hooks/useCases"
import { STATUS_LABELS, labelOf } from "../labels"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemTime } from "../../../shared/format/time"

// 케이스 목록 — 계약서 C1 `GET /cases`. 필터·페이지는 URL에 둬서 새로고침·링크 공유에도 유지해요.
// 서버 기본 정렬은 점수 높은 순(score,desc)이에요. 점수가 아직 없으면 서버가 생성일 최신 순으로 줘요(SCRUM-152).
export default function CaseListPage() {
	const [params, setParams] = useSearchParams()
	const status = params.get("status") || ""
	const mine = params.get("mine") === "1"
	const rawPage = Number(params.get("page") || 1)
	const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
	const query = useCases({ statuses: status ? [status] : [], mine, page })
	function update(next) {
		const merged = { status, mine: mine ? "1" : "", page: "1", ...next }
		setParams(Object.fromEntries(Object.entries(merged).filter(([, value]) => value)))
	}
	return (
		<>
			<header className="case-page-heading">
				<h1>케이스 목록</h1>
				<p>의심 거래의 근거를 확인하고 조사 내용을 기록하세요.</p>
			</header>
			<section className="case-panel" aria-label="케이스 조회">
				<div className="case-filter">
					<label>
						상태 필터{" "}
						<select
							value={status}
							onChange={(event) => update({ status: event.target.value })}
						>
							<option value="">전체</option>
							{Object.entries(STATUS_LABELS).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</label>
					<label>
						<input
							type="checkbox"
							checked={mine}
							onChange={(event) => update({ mine: event.target.checked ? "1" : "" })}
						/>{" "}
						내 담당만
					</label>
					<span>정렬: 점수 높은 순</span>
				</div>
				<AsyncState query={query} />
				{query.data && (
					<>
						{query.data.items.length ? (
							<div
								className="case-table-scroll"
								role="region"
								aria-label="케이스 목록 표"
								tabIndex={0}
							>
								<table className="case-table">
									<caption className="visually-hidden">
										조건에 맞는 케이스와 담당자
									</caption>
									<thead>
										<tr>
											<th scope="col">케이스</th>
											<th scope="col">계좌</th>
											<th scope="col">상태</th>
											<th scope="col">점수</th>
											<th scope="col">담당자</th>
											<th scope="col">생성</th>
										</tr>
									</thead>
									<tbody>
										{query.data.items.map((item) => (
											<tr key={item.caseNo}>
												<td>
													<Link
														to={`/cases/${encodeURIComponent(item.caseNo)}`}
													>
														{item.caseNo}
													</Link>
												</td>
												<td>{item.accountNo}</td>
												<td>
													<span className="case-status">
														{labelOf(STATUS_LABELS, item.status)}
													</span>
												</td>
												<td>{item.score ?? "—"}</td>
												<td>{item.assignee?.displayName || "미배정"}</td>
												<td>{formatSystemTime(item.createdAt)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p>조건에 맞는 케이스가 없습니다.</p>
						)}
						<nav className="case-pagination" aria-label="페이지">
							<button
								disabled={page <= 1}
								onClick={() => update({ page: String(page - 1) })}
							>
								이전
							</button>{" "}
							<span aria-live="polite">
								{page} / {Math.max(query.data.totalPages, 1)} 페이지 · 전체{" "}
								{query.data.total}건
							</span>{" "}
							<button
								disabled={page >= query.data.totalPages}
								onClick={() => update({ page: String(page + 1) })}
							>
								다음
							</button>
						</nav>
					</>
				)}
			</section>
		</>
	)
}
