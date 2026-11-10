import Modal from "../../../shared/ui/dashboard/Modal"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatDataTime } from "../../../shared/format/time"
import { useCaseEvidence } from "../hooks/useCases"
import { formatAmount } from "./caseMoney"
import { DIRECTION_LABELS } from "../labels"

// [거래 원본] 창 — 계약서 C4 `GET /cases/{case_no}/evidence/{transaction_id}`. 서버가 열람 기록을 남겨요.
// 이 케이스의 근거 거래가 아니면 404 EVIDENCE_NOT_FOUND. 계좌는 가린 값만 와요.
export default function EvidenceDialog({ caseNo, transactionId, onClose }) {
	const query = useCaseEvidence(caseNo, transactionId)
	const data = query.data
	const t = data?.transaction
	return (
		<Modal title={`거래 원본 · ${transactionId}`} onClose={onClose}>
			<AsyncState query={query} />
			{t && (
				<dl className="case-summary">
					<dt>원천 시각</dt>
					<dd>{formatDataTime(t.ts)}</dd>
					<dt>송금 계좌</dt>
					<dd>
						{t.fromAccountNo} ({t.fromAccountRef})
					</dd>
					<dt>수취 계좌</dt>
					<dd>
						{t.toAccountNo} ({t.toAccountRef})
					</dd>
					<dt>보낸 금액</dt>
					<dd>{formatAmount(t.amountPaid, t.currencyPaid)}</dd>
					<dt>받은 금액</dt>
					<dd>{formatAmount(t.amountReceived, t.currencyReceived)}</dd>
					<dt>결제 방식</dt>
					<dd>{t.paymentFormat}</dd>
					<dt>대상 계좌 기준</dt>
					<dd>{DIRECTION_LABELS[t.direction] ?? t.direction}</dd>
					<dt>원천</dt>
					<dd>
						{data.source.dataset} · 행 {data.source.recordId}
						{data.source.isSynthetic && " · 합성 데이터"}
					</dd>
					<dt>STR 근거로 쓸 수 있음</dt>
					<dd>{data.eligibleForStr ? "예" : "아니요 (참고 거래)"}</dd>
				</dl>
			)}
		</Modal>
	)
}
