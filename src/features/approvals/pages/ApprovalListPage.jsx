import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import "../../cases/styles/cases.css"
import "../styles/approvals.css"
import { useApprovals } from "../hooks/useApprovals"
import ApprovalDialog from "../components/ApprovalDialog"
import { useSession } from "../../auth/hooks/useSession"
import { REJECTION_LABELS, labelOf } from "../../cases/labels"
import { VERIFICATION_STATUS_LABELS } from "../../str/verificationLabels"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemTime } from "../../../shared/format/time"

// 버튼은 서버가 준 available_actions 만 보고 켜요(01_code_rules §1). 서버는 승인자이고 담당한 적 없을 때만 APPROVE·REJECT 를 줘요.
const can = (item, action) => item.availableActions.includes(action)

function verificationText(verification) {
	if (!verification) return "검증 없음"
	return `${labelOf(VERIFICATION_STATUS_LABELS, verification.status)} · 수정본 ${verification.revisionNo}`
}

function readPage(params) {
	const page = Number(params.get("page") || 1)
	return Number.isInteger(page) && page > 0 ? page : 1
}

// 승인함 (APR-01) — 계약서 P1 `GET /approvals`. 승인 요청 오래된 순(서버 고정), 페이지는 주소(?page=)에 둬요.
// 본문은 없어요 — [초안 보기]로 STR 화면(S2)을 열어 확인해요. ADMIN 은 목록만(SCRUM-120).
export default function ApprovalListPage() {
	const [params, setParams] = useSearchParams()
	const page = readPage(params)
	const query = useApprovals(page)
	const session = useSession()
	const [dialog, setDialog] = useState(null)
	const isAdmin = session.data?.role === "ADMIN"
	const goTo = (next) => setParams(next > 1 ? { page: String(next) } : {})
	return (
		<>
			<header className="case-page-heading">
				<h1>승인함</h1>
				<p>
					{isAdmin
						? "관리자는 승인 대기 목록만 볼 수 있어요. 승인·반려는 승인자가 해요."
						: "검증을 통과한 STR 초안을 확인하고 승인하거나 반려하세요."}
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
											<th scope="col">작업</th>
										</tr>
									</thead>
									<tbody>
										{query.data.items.map((item) => (
											<tr key={item.draftNo}>
												<td>{item.draftNo}</td>
												<td>
													<Link
														to={`/cases/${encodeURIComponent(item.caseNo)}/str`}
													>
														{item.caseNo} 초안 보기
													</Link>
												</td>
												<td>{item.assignee?.displayName ?? "-"}</td>
												<td>{formatSystemTime(item.submittedAt)}</td>
												<td>{verificationText(item.verification)}</td>
												<td>
													{item.lastRejection
														? `${labelOf(REJECTION_LABELS, item.lastRejection.reasonCode)} · ${item.lastRejection.comment}`
														: "없음"}
												</td>
												<td>
													<div className="approval-actions">
														{can(item, "APPROVE") && (
															<button
																type="button"
																className="primary"
																onClick={() =>
																	setDialog({
																		item,
																		mode: "APPROVE",
																	})
																}
															>
																승인
															</button>
														)}
														{can(item, "REJECT") &&
															["NEED_REVISION", "NOT_REPORTABLE"].map(
																(mode) => (
																	<button
																		key={mode}
																		type="button"
																		onClick={() =>
																			setDialog({
																				item,
																				mode,
																			})
																		}
																	>
																		{REJECTION_LABELS[mode]}
																	</button>
																),
															)}
														{item.wasAssignee && (
															<span className="approval-muted">
																내가 담당했던 케이스라 승인·반려할
																수 없어요.
															</span>
														)}
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p>승인 대기 건이 없습니다.</p>
						)}
						<nav className="case-pagination" aria-label="페이지">
							<button disabled={page <= 1} onClick={() => goTo(page - 1)}>
								이전
							</button>{" "}
							<span aria-live="polite">
								{page} / {Math.max(query.data.totalPages, 1)} 페이지 · 전체{" "}
								{query.data.total}건
							</span>{" "}
							<button
								disabled={page >= query.data.totalPages}
								onClick={() => goTo(page + 1)}
							>
								다음
							</button>
						</nav>
					</>
				)}
			</section>
			{dialog && (
				<ApprovalDialog
					item={dialog.item}
					mode={dialog.mode}
					onClose={() => setDialog(null)}
				/>
			)}
		</>
	)
}
