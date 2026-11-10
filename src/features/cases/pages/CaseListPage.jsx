import { useState } from "react"
import { Link, useLocation, useSearchParams } from "react-router"
import "../styles/cases.css"
import { useCases } from "../hooks/useCases"
import { REJECTION_LABELS, STATUS_LABELS, labelOf } from "../labels"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemTime } from "../../../shared/format/time"
import ReassignDialog from "../components/ReassignDialog"

// 목록의 [담당자 변경]도 상세처럼 서버가 준 available_actions(REASSIGN)만 보고 켜요(#23 리뷰). 누르면 서버가 다시 검사해요.
const canReassign = (item) => item.availableActions.includes("REASSIGN")

// 정렬 — 서버 기본은 점수 높은 순(score,desc). 점수가 없는 케이스는 오름·내림 모두 맨 뒤(계약서 C1).
const SORTS = [
	["", "점수 높은 순"],
	["created_at,desc", "최근 생성 순"],
	["created_at,asc", "오래된 생성 순"],
]
const DATE = /^\d{4}-\d{2}-\d{2}$/

// 주소 query → 필터. 모르는 상태·틀린 날짜는 버리고, page 는 1 이상 정수만.
function readFilters(params) {
	const statuses = (params.get("status") ?? "")
		.split(",")
		.filter((value) => value in STATUS_LABELS)
	const date = (key) => (DATE.test(params.get(key) ?? "") ? params.get(key) : "")
	const rawPage = Number(params.get("page") || 1)
	const sort = params.get("sort") ?? ""
	return {
		statuses,
		from: date("from"),
		to: date("to"),
		mine: params.get("mine") === "1",
		assignee: params.get("assignee") ?? "",
		sort: SORTS.some(([value]) => value === sort) ? sort : "",
		page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
	}
}

function toParams(filters) {
	const entries = {
		status: filters.statuses.join(","),
		from: filters.from,
		to: filters.to,
		mine: filters.mine ? "1" : "",
		assignee: filters.mine ? "" : filters.assignee,
		sort: filters.sort,
		page: filters.page > 1 ? String(filters.page) : "",
	}
	return Object.fromEntries(Object.entries(entries).filter(([, value]) => value))
}

function statusText(item) {
	const label = labelOf(STATUS_LABELS, item.status)
	// 반려는 다음 행동이 달라서 두 갈래를 같이 보여 줘요(보완 요청 → 수정, 보고 안 함 → 종료만)
	return item.status === "REJECTED" && item.rejectionReasonCode
		? `${label} · ${labelOf(REJECTION_LABELS, item.rejectionReasonCode)}`
		: label
}

// 케이스 목록 — 계약서 C1 `GET /cases`. 필터·정렬·페이지는 주소(query)에 둬서 새로고침·링크 공유·상세에서 돌아와도 유지해요.
// 계정 관리의 [케이스 보기] → /cases?assignee=login_id 도 그대로 받아요(SCRUM-169).
export default function CaseListPage() {
	const [params, setParams] = useSearchParams()
	const location = useLocation()
	const filters = readFilters(params)
	const periodInvalid = Boolean(filters.from && filters.to && filters.from > filters.to)
	const query = useCases(
		{
			statuses: filters.statuses,
			mine: filters.mine,
			assignee: filters.assignee || undefined,
			from: filters.from || undefined,
			to: filters.to || undefined,
			sort: filters.sort || undefined,
			page: filters.page,
		},
		{ enabled: !periodInvalid },
	)
	const [reassigning, setReassigning] = useState(null)
	// 관리 칸은 그 페이지에 [담당자 변경]을 받을 줄이 하나라도 있을 때만
	const manageColumn = Boolean(query.data?.items.some(canReassign))
	const filtered =
		filters.statuses.length > 0 ||
		Boolean(filters.from || filters.to || filters.mine || filters.assignee)
	function update(next) {
		setParams(toParams({ ...filters, page: 1, ...next }))
	}
	function toggleStatus(value, checked) {
		const statuses = checked
			? [...filters.statuses, value]
			: filters.statuses.filter((status) => status !== value)
		update({ statuses: Object.keys(STATUS_LABELS).filter((key) => statuses.includes(key)) })
	}
	const reset = () => setParams({})
	return (
		<>
			<header className="case-page-heading">
				<h1>케이스 목록</h1>
				<p>의심 거래의 근거를 확인하고 조사 내용을 기록하세요.</p>
			</header>
			<section className="case-panel" aria-label="케이스 조회">
				<div className="case-filter">
					<fieldset>
						<legend>상태</legend>
						{Object.entries(STATUS_LABELS).map(([value, label]) => (
							<label key={value}>
								<input
									type="checkbox"
									checked={filters.statuses.includes(value)}
									onChange={(event) => toggleStatus(value, event.target.checked)}
								/>{" "}
								{label}
							</label>
						))}
					</fieldset>
					<label>
						생성일 시작{" "}
						<input
							type="date"
							value={filters.from}
							aria-invalid={periodInvalid || undefined}
							aria-describedby={periodInvalid ? "period-error" : undefined}
							onChange={(event) => update({ from: event.target.value })}
						/>
					</label>
					<label>
						생성일 종료{" "}
						<input
							type="date"
							value={filters.to}
							aria-invalid={periodInvalid || undefined}
							aria-describedby={periodInvalid ? "period-error" : undefined}
							onChange={(event) => update({ to: event.target.value })}
						/>
					</label>
					<label>
						<input
							type="checkbox"
							checked={filters.mine}
							onChange={(event) => update({ mine: event.target.checked })}
						/>{" "}
						내 담당만
					</label>
					{filters.assignee && !filters.mine && (
						<span>
							담당자: {filters.assignee}{" "}
							<button type="button" onClick={() => update({ assignee: "" })}>
								담당자 조건 해제
							</button>
						</span>
					)}
					<label>
						정렬{" "}
						<select
							value={filters.sort}
							onChange={(event) => update({ sort: event.target.value })}
						>
							{SORTS.map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</label>
					{filtered && (
						<button type="button" onClick={reset}>
							필터 초기화
						</button>
					)}
				</div>
				{periodInvalid && (
					<p id="period-error" role="alert">
						시작일은 종료일보다 늦을 수 없어요.
					</p>
				)}
				{!periodInvalid && <AsyncState query={query} />}
				{!periodInvalid && query.data && (
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
											{manageColumn && <th scope="col">관리</th>}
										</tr>
									</thead>
									<tbody>
										{query.data.items.map((item) => (
											<tr key={item.caseNo}>
												<td>
													<Link
														to={`/cases/${encodeURIComponent(item.caseNo)}`}
														state={{ listSearch: location.search }}
													>
														{item.caseNo}
													</Link>
												</td>
												<td>{item.accountNo}</td>
												<td>
													<span className="case-status">
														{statusText(item)}
													</span>
												</td>
												<td>{item.score ?? "—"}</td>
												<td>{item.assignee?.displayName || "미배정"}</td>
												<td>{formatSystemTime(item.createdAt)}</td>
												{manageColumn && (
													<td>
														{canReassign(item) && (
															<button
																type="button"
																onClick={() => setReassigning(item)}
															>
																담당자 변경
															</button>
														)}
													</td>
												)}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<div>
								<p>조건에 맞는 케이스가 없습니다.</p>
								{filtered && (
									<button type="button" onClick={reset}>
										필터 초기화
									</button>
								)}
							</div>
						)}
						<nav className="case-pagination" aria-label="페이지">
							<button
								disabled={filters.page <= 1}
								onClick={() =>
									setParams(toParams({ ...filters, page: filters.page - 1 }))
								}
							>
								이전
							</button>{" "}
							<span aria-live="polite">
								{filters.page} / {Math.max(query.data.totalPages, 1)} 페이지 · 전체{" "}
								{query.data.total}건
							</span>{" "}
							<button
								disabled={filters.page >= query.data.totalPages}
								onClick={() =>
									setParams(toParams({ ...filters, page: filters.page + 1 }))
								}
							>
								다음
							</button>
						</nav>
					</>
				)}
			</section>
			{reassigning && (
				<ReassignDialog
					caseNo={reassigning.caseNo}
					version={reassigning.version}
					assignee={reassigning.assignee}
					onClose={() => setReassigning(null)}
				/>
			)}
		</>
	)
}
