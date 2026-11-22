import { Link, useSearchParams } from "react-router"
import "../../cases/styles/cases.css"
import "../styles/approvals.css"
import { useApprovals } from "../hooks/useApprovals"
import { useSession } from "../../auth/hooks/useSession"
import { REJECTION_LABELS, labelOf } from "../../cases/labels"
import { VERIFICATION_STATUS_LABELS } from "../../str/verificationLabels"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemTime } from "../../../shared/format/time"
import Pagination from "../../../shared/ui/Pagination"
import StatusBadge from "../../../shared/ui/StatusBadge"
import { useGuide } from "../../../shared/ui/useGuide"
import { approvalListWorkflowGuide } from "../../../shared/ui/workflowGuide"

// 상태 글자는 서버가 준 available_actions·was_assignee 만 보고 정해요(01_code_rules §1).
// 서버는 승인자이고 담당한 적 없을 때만 APPROVE·REJECT 를 줘요.
const can = (item, action) => item.availableActions.includes(action)

// 목록 줄의 "지금 이 건에서 내가 할 일"
function stateOf(item, isAdmin) {
	if (isAdmin) return { tone: "muted", text: "승인 대기 · 승인자가 검토해요" }
	if (item.wasAssignee)
		return { tone: "muted", text: "내가 담당했던 케이스 · 다른 승인자가 결정해요" }
	if (can(item, "APPROVE") || can(item, "REJECT"))
		return { tone: "todo", text: "검토 대기 · 초안에서 승인·반려" }
	return { tone: "muted", text: "승인 대기" }
}

// 할 일이 있는 줄만 상태 배지(info, SCRUM-332). 나머지는 옅은 글자 — 강조는 할 일에만.
function ApprovalState({ state }) {
	if (state.tone === "todo") return <StatusBadge tone="info">{state.text}</StatusBadge>
	return <span className="approval-state">{state.text}</span>
}

function verificationText(verification) {
	if (!verification) return "검증 없음"
	return `${labelOf(VERIFICATION_STATUS_LABELS, verification.status)} · 수정본 ${verification.revisionNo}`
}

function readPage(params) {
	const page = Number(params.get("page") || 1)
	return Number.isInteger(page) && page > 0 ? page : 1
}

// 승인함 (APR-01) — 계약서 P1 `GET /approvals`. 승인 요청 오래된 순(서버 고정), 페이지는 주소(?page=)에 둬요.
// 본문·결정 버튼은 없어요 — [초안 검토하기]로 STR 화면(S2)을 열어 본문·변경 비교를 보고 거기서 승인·반려해요.
// ADMIN 은 목록만(SCRUM-120).
export default function ApprovalListPage() {
	const [params, setParams] = useSearchParams()
	const page = readPage(params)
	const query = useApprovals(page)
	const session = useSession()
	const isAdmin = session.data?.role === "ADMIN"
	useGuide(approvalListWorkflowGuide(session.data?.role, query.data?.total))
	const goTo = (next) => setParams(next > 1 ? { page: String(next) } : {})
	return (
		<>
			<header className="case-page-heading">
				<h1>승인함</h1>
				<p>
					{isAdmin
						? "관리자는 승인 대기 목록만 볼 수 있어요. 승인·반려는 승인자가 해요."
						: "검증을 통과한 STR 초안을 열어 본문과 바뀐 곳을 확인한 뒤, 초안 화면에서 승인하거나 반려하세요."}
				</p>
			</header>
			<section className="case-panel" aria-label="승인 대기 목록">
				<AsyncState query={query} />
				{query.data && (
					<>
						{query.data.items.length ? (
							<div
								className="case-table-scroll"
								role="region"
								aria-label="승인 대기 표"
								tabIndex={0}
							>
								<table className="case-table">
									<caption className="visually-hidden">
										승인을 기다리는 STR 초안
									</caption>
									<thead>
										<tr>
											<th scope="col">초안</th>
											<th scope="col">케이스</th>
											<th scope="col">담당 조사역</th>
											<th scope="col">승인 요청</th>
											<th scope="col">검증</th>
											<th scope="col">지난 반려</th>
											<th scope="col">상태</th>
											<th scope="col">
												<span className="visually-hidden">초안 열기</span>
											</th>
										</tr>
									</thead>
									<tbody>
										{query.data.items.map((item) => (
											<tr key={item.draftNo}>
												<td>{item.draftNo}</td>
												<td>{item.caseNo}</td>
												<td>{item.assignee?.displayName ?? "-"}</td>
												<td>{formatSystemTime(item.submittedAt)}</td>
												<td>{verificationText(item.verification)}</td>
												<td>
													{item.lastRejection
														? `${labelOf(REJECTION_LABELS, item.lastRejection.reasonCode)} · ${item.lastRejection.comment}`
														: "없음"}
												</td>
												<td>
													<ApprovalState state={stateOf(item, isAdmin)} />
												</td>
												<td>
													{/* 결정은 본문을 보면서 초안 화면에서(APR-02) — 목록엔 버튼을 두지 않아요 */}
													<Link
														className="approval-review-link"
														to={`/cases/${encodeURIComponent(item.caseNo)}/str`}
														aria-label={`${item.caseNo} ${isAdmin ? "초안 상태 보기" : "초안 검토하기"}`}
													>
														{isAdmin
															? "초안 상태 보기"
															: "초안 검토하기"}{" "}
														→
													</Link>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p>승인 대기 건이 없습니다.</p>
						)}
						<Pagination
							page={page}
							totalPages={query.data.totalPages}
							total={query.data.total}
							size={query.data.size}
							onChange={goTo}
						/>
					</>
				)}
			</section>
		</>
	)
}
