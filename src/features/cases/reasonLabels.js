import { currencyLabel } from "./currencyLabels"

// 점수 근거(latest_score.reasons) 화면 글자 — AI 점수 서버가 준 값은 기계용 코드(영문)라 여기서만 한글로 바꿔요.
// 서버·AI 요청·요약 해시는 코드를 그대로 써야 해서(규약 v0.4, 안건 3) 값 자체는 바꾸지 않아요.
// 이름은 "<지표>_<기간>" 꼴(account_in_counterparties_24h). 모르는 지표는 코드를 그대로 보여 줘요.

const METRICS = {
	account_in_counterparties: "입금 상대 계좌 수",
	account_out_counterparties: "출금 상대 계좌 수",
	fan_in_degree: "입금 상대 계좌 수",
	fan_out_degree: "송금 상대 계좌 수",
	amount_in_sum: "입금 합계",
	amount_out_sum: "출금 합계",
	tx_count: "거래 건수",
	night_tx_ratio: "야간 거래 비율",
}

const WINDOWS = { h: "시간", d: "일" }

// 관측 기준(observation.basis)
const BASES = {
	distinct_inbound_counterparties: "서로 다른 입금 상대 계좌",
	distinct_outbound_counterparties: "서로 다른 출금 상대 계좌",
}

// 지표별 개수 단위 — count 는 "계좌 수"면 개, 그 밖은 건.
const COUNT_UNIT = {
	account_in_counterparties: "개",
	account_out_counterparties: "개",
	fan_in_degree: "개",
	fan_out_degree: "개",
}

function split(name) {
	const match = /^(.+)_(\d+)([hd])$/.exec(name ?? "")
	return match
		? { metric: match[1], window: `${match[2]}${WINDOWS[match[3]]}` }
		: { metric: name }
}

/** "account_in_counterparties_24h" → "24시간 입금 상대 계좌 수". 모르면 null(화면이 코드를 보여 줘요). */
export function reasonLabel(name) {
	const { metric, window } = split(name)
	const label = METRICS[metric]
	if (!label) return null
	return window ? `${window} ${label}` : label
}

/** 관측 기준 한글. 모르면 null — 영문 코드는 화면에 쓰지 않아요(이름이 이미 같은 뜻을 담아요). */
export const basisLabel = (basis) => BASES[basis] ?? null

/**
 * 값 + 단위. count → 개/건, ratio → %, 통화 코드(USD)는 한글 통화 이름. 모르는 단위는 붙이지 않아요.
 * @param format 숫자 서식 함수(반올림하지 않는 formatNumber)
 */
export function withReasonUnit(value, unit, name, format) {
	if (value == null) return null
	if (typeof value !== "number") return String(value)
	if (unit === "ratio") return `${format(Math.round(value * 1000) / 10)}%`
	if (unit === "count") return `${format(value)}${COUNT_UNIT[split(name).metric] ?? "건"}`
	if (/^[A-Z]{3}$/.test(unit ?? "")) return `${format(value)} ${currencyLabel(unit)}`
	return format(value)
}
