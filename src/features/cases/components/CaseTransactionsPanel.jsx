import { useState } from "react"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatDataTime } from "../../../shared/format/time"
import { useCaseTransactions } from "../hooks/useCases"
import { formatAmount } from "./caseMoney"
import EvidenceDialog from "./EvidenceDialog"
import { DIRECTION_LABELS } from "../labels"

// 근거 거래 표 — 계약서 C3 `GET /cases/{case_no}/transactions`. 근거(EVIDENCE)와 참고(CONTEXT)는 탭을 나눠요.
// 탭은 부모(CaseEvidenceCard)가 들고 scope 로 내려 줘요 — 범위가 바뀌면 key 로 새로 그려 1페이지부터.
// 참고 거래는 STR 합계·근거에 안 들어가서 행에 "참고" 표시를 붙여요. 지금 서버는 참고 거래를 빈 목록으로 줘요.

// 대상 계좌 기준 칸: 근거 거래 n번째(STR III부 거래 목록 순서) · 입금/출금. 경유 거래는 대상 계좌가 끼지 않아요.
function directionText(item, n) {
	if (item.direction === "INDIRECT") return "대상 계좌 미참여"
	return `III부 ${n} · ${DIRECTION_LABELS[item.direction] ?? item.direction}`
}

const SCOPE_TITLES = { EVIDENCE: "근거 거래", CONTEXT: "참고 거래" }

export default function CaseTransactionsPanel({ caseNo, scope = "EVIDENCE" }) {
	const [page, setPage] = useState(1)
	const [opened, setOpened] = useState(null)
	const query = useCaseTransactions(caseNo, scope, page)
	const data = query.data
	return (
		<section className="case-panel" aria-labelledby="transactions-title">
			<h2 id="transactions-title">{SCOPE_TITLES[scope]}</h2>
			<AsyncState query={query} />
			{data &&
				(data.items.length ? (
					<div className="case-table-scroll" tabIndex={0} aria-label="거래 표">
						<table className="case-table">
							<thead>
								<tr>
									<th scope="col">거래</th>
									<th scope="col">원천 시각</th>
									<th scope="col">송금 → 수취</th>
									<th scope="col">대상 계좌 기준</th>
									<th scope="col">보낸 금액</th>
									<th scope="col">받은 금액</th>
									<th scope="col">원본</th>
								</tr>
							</thead>
							<tbody>
								{data.items.map((item, index) => (
									<tr
										key={item.transactionId}
										className={
											item.scope === "CONTEXT"
												? "case-row-context"
												: undefined
										}
									>
										<td>
											{item.transactionId}
											{item.scope === "CONTEXT" && (
												<span className="case-status"> 참고</span>
											)}
										</td>
										<td>{formatDataTime(item.ts)}</td>
										<td>
											{item.fromAccountNo} → {item.toAccountNo}
										</td>
										<td>
											{item.scope === "CONTEXT"
												? "참고 거래"
												: directionText(
														item,
														(page - 1) * data.size + index + 1,
													)}
										</td>
										<td>{formatAmount(item.amountPaid, item.currencyPaid)}</td>
										<td>
											{formatAmount(
												item.amountReceived,
												item.currencyReceived,
											)}
										</td>
										<td>
											<button
												type="button"
												onClick={() => setOpened(item.transactionId)}
											>
												거래 원본
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<p>
						{scope === "EVIDENCE"
							? "이 케이스의 근거 거래가 없어요."
							: "참고 거래가 없어요."}
					</p>
				))}
			{data && data.totalPages > 1 && (
				<nav className="case-pagination" aria-label="거래 페이지">
					<button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
						이전
					</button>
					<span>
						{page} / {data.totalPages} (전체 {data.total}건)
					</span>
					<button
						type="button"
						disabled={page >= data.totalPages}
						onClick={() => setPage(page + 1)}
					>
						다음
					</button>
				</nav>
			)}
			{opened != null && (
				<EvidenceDialog
					caseNo={caseNo}
					transactionId={opened}
					onClose={() => setOpened(null)}
				/>
			)}
		</section>
	)
}
