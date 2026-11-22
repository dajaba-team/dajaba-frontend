// 금액 문자열 표기 [11/21 PDF 리뷰 — STR 사실 정보가 `EUR 62992819.38`처럼 쉼표 없이 보였어요]
// - 받은 문자열에 천 단위 쉼표만 넣어요. Number로 바꾸지 않아서 소수 자릿수·아주 큰 수가 그대로예요
//   (facts는 서버가 계산한 값 — 다시 계산하지 않기, 안건 23).
// - 숫자 모양이 아니면 받은 그대로 보여 줘요.

const PLAIN_NUMBER = /^(-?)(\d+)(\.\d+)?$/

export function groupDigits(value) {
	if (value == null) return value
	const text = String(value)
	const match = PLAIN_NUMBER.exec(text)
	if (!match) return text
	const [, sign, integer, fraction = ""] = match
	return `${sign}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction}`
}
