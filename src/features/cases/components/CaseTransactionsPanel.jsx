import { useState } from "react"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatDataTime } from "../../../shared/format/time"
import { useCaseTransactions } from "../hooks/useCases"
import { formatAmount } from "./caseMoney"
import EvidenceDialog from "./EvidenceDialog"
import { DIRECTION_LABELS } from "../labels"
import Pagination from "../../../shared/ui/Pagination"

// 근거 거래 표 — 계약서 C3 `GET /cases/{case_no}/transactions`. 근거(EVIDENCE)와 참고(CONTEXT)는 탭을 나눠요.
// 탭은 부모(CaseEvidenceCard)가 들고 scope 로 내려 줘요 — 범위가 바뀌면 key 로 새로 그려 1페이지부터.
// 참고 거래는 STR 합계·근거에 안 들어가서 행에 "참고" 표시를 붙여요. 지금 서버는 참고 거래를 빈 목록으로 줘요.

// 대상 계좌 기준 칸: 근거 거래 n번째(STR III부 거래 목록 순서) · 입금/출금. 경유 거래는 대상 계좌가 끼지 않아요.
function directionText(item, n) {
	if (item.direction === "INDIRECT") return "대상 계좌 미참여"
	return `III부 ${n} · ${DIRECTION_LABELS[item.direction] ?? item.direction}`
}

const SCOPE_TITLES = { EVIDENCE: "근거 거래", CONTEXT: "참고 거래" }

// 질문 답의 근거 거래 강조(SCRUM-303) — 1차는 지금 페이지만 칠하고, 표 위에 "이 페이지 m건 · 전체 n건"을 적어요.
function AskHighlightBar({ highlight, items, onClear, onReopen }) {
	const ids = new Set(highlight.ids)
	const here = items.filter((item) => ids.has(item.transactionId)).length
	return (
		<div className="ask-evidence-bar" role="status" tabIndex={-1} id="ask-evidence-bar">
			<p>
				<b>질문 답 근거</b> 이 페이지 {here}건 · 전체 {highlight.ids.length}건
				{here === 0 && <small>다른 페이지에 근거 거래가 있어요.</small>}
			</p>
			<div>
				{onReopen && (
					<button type="button" onClick={onReopen}>
						질문 패널 다시 열기
					</button>
				)}
				<button type="button" onClick={onClear}>
					강조 끄기
				</button>
			</div>
		</div>
	)
}

export default function CaseTransactionsPanel({
	caseNo,
	scope = "EVIDENCE",
	highlight = null,
	onClearHighlight,
	onReopenAsk,
}) {
	const [page, setPage] = useState(1)
	const [opened, setOpened] = useState(null)
	const query = useCaseTransactions(caseNo, scope, page)
	const data = query.data
	const hits = scope === "EVIDENCE" && highlight ? new Set(highlight.ids) : null
	return (
		<section className="case-panel" aria-labelledby="transactions-title">
			<h2 id="transactions-title">{SCOPE_TITLES[scope]}</h2>
			<AsyncState query={query} />
			{hits && data && (
				<AskHighlightBar
					highlight={highlight}
					items={data.items}
					onClear={onClearHighlight}
					onReopen={onReopenAsk}
				/>
			)}
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
											[
												item.scope === "CONTEXT" && "case-row-context",
												hits?.has(item.transactionId) && "is-ask-hit",
											]
												.filter(Boolean)
												.join(" ") || undefined
										}
										aria-current={hits?.has(item.transactionId) || undefined}
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
				<Pagination
					label="거래 페이지"
					page={page}
					totalPages={data.totalPages}
					total={data.total}
					size={data.size}
					onChange={setPage}
				/>
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
