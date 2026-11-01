import { Link, useSearchParams } from "react-router"
import "../styles/cases.css"
import { useCases } from "../hooks/useCases"
import { AsyncState } from "../../../shared/ui/AsyncState"

export default function CaseListPage() {
	const [params, setParams] = useSearchParams()
	const status = params.get("status") || ""
	const rawPage = Number(params.get("page") || 1)
	const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
	const query = useCases({ status, page })
	function changePage(next) {
		setParams({ status, page: String(next) })
	}
	return (
		<>
			<header className="case-page-heading">
				<h1>케이스 목록</h1>
				<p>의심 거래의 근거를 확인하고 조사 내용을 기록하세요.</p>
			</header>
			{/* 필터·페이지는 URL로 관리하여 새로고침과 링크 공유에 유지합니다. */}
			<section className="case-panel" aria-label="케이스 조회">
				<label className="case-filter">
					상태 필터{" "}
					<select
						value={status}
						onChange={(event) => setParams({ status: event.target.value, page: "1" })}
					>
						<option value="">전체</option>
						{[
							"OPEN",
							"REVIEWING",
							"ESCALATED",
							"DRAFTED",
							"PENDING_APPROVAL",
							"REJECTED",
							"APPROVED",
							"CLOSED",
						].map((value) => (
							<option key={value}>{value}</option>
						))}
					</select>
				</label>
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
										상태 필터에 해당하는 케이스와 담당자
									</caption>
									<thead>
										<tr>
											<th scope="col">케이스</th>
											<th scope="col">상태</th>
											<th scope="col">담당자</th>
										</tr>
									</thead>
									<tbody>
										{query.data.items.map((item) => (
											<tr key={item.id}>
												<td>
													<Link to={`/cases/${item.id}`}>
														{item.title}
													</Link>
												</td>
												<td>
													<span className="case-status">
														{item.status}
													</span>
												</td>
												<td>{item.assignee_name || "미배정"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p>조건에 맞는 케이스가 없습니다.</p>
						)}
						<nav className="case-pagination" aria-label="페이지">
							<button disabled={page <= 1} onClick={() => changePage(page - 1)}>
								이전
							</button>{" "}
							<span aria-live="polite">{page} 페이지</span>{" "}
							<button
								disabled={!query.data.has_next}
								onClick={() => changePage(page + 1)}
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
