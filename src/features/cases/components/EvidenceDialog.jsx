import Modal from "../../../shared/ui/dashboard/Modal"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatDataMinute as formatDataTime } from "../caseTime"
import { useCaseEvidence } from "../hooks/useCases"
import { formatAmount } from "./caseMoney"
import { DIRECTION_LABELS } from "../labels"
import "./evidenceDialog.css"
import { paymentFormatLabel } from "../displayText"

// [거래 원본] 창 — 계약서 C4 `GET /cases/{case_no}/evidence/{transaction_id}`. 서버가 열람 기록을 남겨요.
// 이 케이스의 근거 거래가 아니면 404 EVIDENCE_NOT_FOUND. 계좌는 가린 값만 와요.
// 배치: 상태 배지 → 금액 → 송금·수취 계좌 흐름 → 나머지 항목 표(11/18 시안 A).
export default function EvidenceDialog({ caseNo, transactionId, onClose }) {
	const query = useCaseEvidence(caseNo, transactionId)
	const data = query.data
	const t = data?.transaction
	return (
		<Modal title={`거래 원본 · ${transactionId}`} onClose={onClose}>
			<AsyncState query={query} />
			{t && <EvidenceBody data={data} t={t} />}
		</Modal>
	)
}

function EvidenceBody({ data, t }) {
	const sameAmount =
		Number(t.amountPaid) === Number(t.amountReceived) && t.currencyPaid === t.currencyReceived
	// 대상 계좌가 어느 쪽인지 — 출금이면 송금 계좌, 입금이면 수취 계좌. 경유면 둘 다 아님.
	const target = t.direction === "OUTBOUND" ? "from" : t.direction === "INBOUND" ? "to" : null
	return (
		<div className="evidence">
			<ul className="evidence-chips" aria-label="거래 상태">
				<li className={data.eligibleForStr ? "chip chip-pass" : "chip"}>
					{data.eligibleForStr ? "STR 근거로 쓸 수 있음" : "참고 거래 · STR 근거 아님"}
				</li>
				<li className={`chip chip-${(t.direction ?? "").toLowerCase()}`}>
					{target && "대상 계좌 기준 "}
					<strong>{DIRECTION_LABELS[t.direction] ?? t.direction}</strong>
				</li>
				{data.source.isSynthetic && <li className="chip">합성 데이터</li>}
			</ul>

			<div className="evidence-amount">
				<div>
					<span className="evidence-label">{sameAmount ? "거래 금액" : "보낸 금액"}</span>
					<strong>{formatAmount(t.amountPaid, t.currencyPaid)}</strong>
				</div>
				{sameAmount ? (
					<p>보낸 금액 = 받은 금액</p>
				) : (
					<p>
						받은 금액
						<br />
						<b>{formatAmount(t.amountReceived, t.currencyReceived)}</b>
					</p>
				)}
			</div>

			<div className="evidence-flow">
				<Account
					role="송금 계좌"
					no={t.fromAccountNo}
					accountRef={t.fromAccountRef}
					tone="out"
					isTarget={target === "from"}
				/>
				<span className="evidence-arrow" aria-hidden="true">
					→
				</span>
				<Account
					role="수취 계좌"
					no={t.toAccountNo}
					accountRef={t.toAccountRef}
					tone="in"
					isTarget={target === "to"}
				/>
			</div>

			<dl className="evidence-grid">
				<div>
					<dt>결제 방식</dt>
					<dd>{paymentFormatLabel(t.paymentFormat)}</dd>
				</div>
				<div>
					<dt>원천 시각</dt>
					<dd>{formatDataTime(t.ts)}</dd>
				</div>
				<div className="evidence-grid-wide">
					<dt>원천</dt>
					<dd>
						{data.source.dataset} · 행 {data.source.recordId}
						{data.source.isSynthetic && " · 합성 데이터"}
					</dd>
				</div>
			</dl>
		</div>
	)
}

function Account({ role, no, accountRef, tone, isTarget }) {
	return (
		<div className={isTarget ? "evidence-account is-target" : "evidence-account"}>
			<span className="evidence-label">
				<i className={`evidence-dot ${tone}`} aria-hidden="true" />
				{role}
				{isTarget && " · 대상"}
			</span>
			<strong>{no}</strong>
			<code>{accountRef}</code>
		</div>
	)
}
