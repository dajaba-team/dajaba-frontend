// 금액은 받은 숫자 + 통화 이름 그대로(계약서 2.4). 통화 이름이 ISO 코드가 아니라("US Dollar") Intl currency 형식은 쓰지 않아요.
// 더하거나 환산하지 않아요.
const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 6 })

/** 금액이 아닌 숫자(점수 이유의 관측값·기여값 등). 반올림하지 않고 소수 6자리까지. */
export function formatNumber(value) {
	return number.format(Number(value))
}

export function formatAmount(amount, currency) {
	if (amount == null) return "—"
	return `${number.format(Number(amount))} ${currency ?? ""}`.trim()
}
