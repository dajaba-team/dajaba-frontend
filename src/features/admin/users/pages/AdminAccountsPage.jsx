import { useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import "../../../cases/styles/cases.css"
import "../styles/accounts.css"
import { AsyncState } from "../../../../shared/ui/AsyncState"
import { useSession } from "../../../auth/hooks/useSession"
import { adminUsersApi } from "../api/adminUsersApi"
import { ROLE_LABELS, ROLE_SWAP } from "../accountRules"
import Pagination from "../../../../shared/ui/Pagination"
import {
	ActiveToggleDialog,
	ChangeRoleDialog,
	CreateAccountDialog,
	ResetPasswordDialog,
} from "../components/AccountDialogs"

// 계정 관리 (ADM-03) — 계약서 5.8, 프론트 docs/04_auth_session.md §6. 관리자만(라우트 RequireRole + 서버 403).
// 목록 기본 활성만. 내 계정·SYSTEM 행에는 버튼 없음, 관리자 행에는 역할 변경 없음(조사역 ↔ 승인자만), 삭제 버튼 없음.
const casesOf = (user) => `/cases?assignee=${encodeURIComponent(user.loginId)}`

export default function AdminAccountsPage() {
	const [role, setRole] = useState("")
	const [active, setActive] = useState(true)
	const [page, setPage] = useState(1)
	const [dialog, setDialog] = useState(null)
	const [notice, setNotice] = useState(null)
	const me = useSession().data
	const query = useQuery({
		queryKey: ["admin", "users", "list", { role, active, page }],
		queryFn: ({ signal }) => adminUsersApi.list({ role, active, page }, signal),
	})
	const data = query.data
	const open = (type, user = null) => {
		setNotice(null)
		setDialog({ type, user })
	}
	const close = () => setDialog(null)
	return (
		<>
			<header className="case-page-heading">
				<h1>계정 관리</h1>
			</header>
			<section className="case-panel" aria-label="계정 조회">
				<div className="case-filter">
					<label>
						역할{" "}
						<select
							value={role}
							onChange={(event) => {
								setRole(event.target.value)
								setPage(1)
							}}
						>
							<option value="">전체</option>
							{["INVESTIGATOR", "APPROVER", "ADMIN"].map((value) => (
								<option key={value} value={value}>
									{ROLE_LABELS[value]}
								</option>
							))}
						</select>
					</label>
					<label>
						상태{" "}
						<select
							value={active ? "active" : "inactive"}
							onChange={(event) => {
								setActive(event.target.value === "active")
								setPage(1)
							}}
						>
							<option value="active">활성</option>
							<option value="inactive">비활성</option>
						</select>
					</label>
					<button type="button" onClick={() => open("create")}>
						계정 발급
					</button>
				</div>
				{notice && (
					<div role="status" className="case-action-note">
						<p>
							{notice.displayName} 계정을 비활성화했어요.
							{notice.activeCaseCount > 0 &&
								` 진행 중 담당 ${notice.activeCaseCount}건이 남았어요 — 담당자를 바꿔 주세요.`}
						</p>
						{notice.activeCaseCount > 0 && (
							<Link to={casesOf(notice)}>케이스 보기</Link>
						)}
					</div>
				)}
				<AsyncState query={query} />
				{data &&
					(data.items.length ? (
						<div
							className="case-table-scroll"
							role="region"
							aria-label="계정 목록 표"
							tabIndex={0}
						>
							{/* 계정 표(SCRUM-410) — 이름·아이디는 한 칸, 상태는 점+글자, 관리는 오른쪽 작은 글자 버튼. */}
							<table className="case-table account-table">
								<thead>
									<tr>
										<th scope="col">계정</th>
										<th scope="col">역할</th>
										<th scope="col">상태</th>
										<th scope="col">진행 중 담당</th>
										{/* 머리글 글자는 화면에서 빼고 화면 읽기 프로그램에만(SCRUM-410) */}
										<th scope="col" className="account-manage-head">
											<span className="visually-hidden">관리</span>
										</th>
									</tr>
								</thead>
								<tbody>
									{data.items.map((user) => {
										const manageable =
											user.role !== "SYSTEM" && user.id !== me?.id
										const isMe = user.id === me?.id
										return (
											<tr key={user.id}>
												<td>
													<div className="account-who">
														<span
															className="account-avatar"
															aria-hidden="true"
														>
															{(
																user.displayName || user.loginId
															).slice(0, 1)}
														</span>
														<span>
															<strong>{user.displayName}</strong>
															<span className="account-login-id">
																{user.loginId}
															</span>
														</span>
														{isMe && (
															<span className="account-me">
																내 계정
															</span>
														)}
													</div>
												</td>
												<td>{ROLE_LABELS[user.role] ?? user.role}</td>
												<td>
													<span
														className="account-state"
														data-active={user.isActive || undefined}
													>
														{user.isActive ? "활성" : "비활성"}
													</span>
												</td>
												<td>
													{user.role === "INVESTIGATOR" ? (
														<span className="account-cases">
															<span>
																{user.activeCaseCount != null
																	? `${user.activeCaseCount}건`
																	: "—"}
															</span>
															{user.activeCaseCount > 0 && (
																<Link to={casesOf(user)}>
																	케이스 보기
																</Link>
															)}
														</span>
													) : (
														<span className="account-none">—</span>
													)}
												</td>
												<td className="account-manage">
													{manageable ? (
														<div className="account-actions">
															{ROLE_SWAP[user.role] &&
																user.isActive && (
																	<button
																		type="button"
																		onClick={() =>
																			open("role", user)
																		}
																	>
																		역할 변경
																	</button>
																)}
															{user.isActive && (
																<button
																	type="button"
																	onClick={() =>
																		open("password", user)
																	}
																>
																	비밀번호 초기화
																</button>
															)}
															<button
																type="button"
																className={
																	user.isActive
																		? "is-danger"
																		: "is-primary"
																}
																onClick={() => open("active", user)}
															>
																{user.isActive
																	? "비활성화"
																	: "재활성화"}
															</button>
														</div>
													) : (
														<span className="account-none">—</span>
													)}
												</td>
											</tr>
										)
									})}
								</tbody>
							</table>
						</div>
					) : (
						<p>{active ? "활성 계정이 없어요." : "비활성 계정이 없어요."}</p>
					))}
				{data && data.totalPages > 1 && (
					<Pagination
						label="계정 페이지"
						unit="명"
						page={page}
						totalPages={data.totalPages}
						total={data.total}
						size={data.size}
						onChange={setPage}
					/>
				)}
			</section>
			{dialog?.type === "create" && <CreateAccountDialog onClose={close} />}
			{dialog?.type === "role" && <ChangeRoleDialog user={dialog.user} onClose={close} />}
			{dialog?.type === "active" && (
				<ActiveToggleDialog user={dialog.user} onClose={close} onDeactivated={setNotice} />
			)}
			{dialog?.type === "password" && (
				<ResetPasswordDialog user={dialog.user} onClose={close} />
			)}
		</>
	)
}
