import { ruleLabel } from "../admin/batches/ruleLabels"
import { reasonLabel } from "./reasonLabels"

// 화면 표기 변환 — 서버·데이터셋이 준 원문(영문 코드·이름)을 사람이 읽는 한글로 바꿔요.
// 값 자체는 바꾸지 않고 그릴 때만 써요(요청·해시·비교는 원문 그대로). 모르는 값은 원문 그대로 둬요 — 정보를 숨기지 않게.

export { currencyLabel } from "./currencyLabels"

// 결제 방식 — 데이터셋 Payment Format 원문.
const PAYMENT_FORMATS = {
	ACH: "자동이체(ACH)",
	Wire: "전신 송금",
	Cheque: "수표",
	Cash: "현금",
	"Credit Card": "신용카드",
	Bitcoin: "비트코인",
	Reinvestment: "재투자",
}

/** "Wire" → "전신 송금". 모르면 원문. */
export const paymentFormatLabel = (format) =>
	format == null ? "" : (PAYMENT_FORMATS[format] ?? format)

// 작업자 — 이력의 created_by 는 login_id. 배치가 만든 줄은 "system".
const ACTORS = { system: "시스템" }

/** "system" → "시스템". 사람은 login_id 그대로. */
export const actorLabel = (loginId) => (loginId == null ? "" : (ACTORS[loginId] ?? loginId))

// 문장 속 코드 — AI 요약·답변은 지표 코드(account_in_counterparties_24h)·룰 ID(R02_FAN_IN)를 섞어 써요.
// 아는 코드만 한글 이름으로 바꾸고, 모르는 영문 단어·계좌 표기(10_BD30)는 건드리지 않아요.
const RULE_ID = /\bR\d{2}_[A-Z_]+\b/g
const SNAKE_CODE = /\b[a-z]+(?:_[a-z0-9]+)+\b/g

/** AI 문장 안의 아는 코드를 한글로. "모델은 account_in_counterparties_24h 신호를…" → "모델은 '24시간 입금 상대 계좌 수' 신호를…" */
export function humanizeText(text) {
	if (typeof text !== "string" || !text) return text
	return text
		.replace(RULE_ID, (id) => {
			const label = ruleLabel(id)
			return label === id ? id : label
		})
		.replace(SNAKE_CODE, (code) => {
			const label = reasonLabel(code)
			return label ? `'${label}'` : code
		})
}
