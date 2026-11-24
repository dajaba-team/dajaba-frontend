import { describe, expect, it } from "vitest"
import {
	actorLabel,
	currencyLabel,
	humanizeText,
	paymentFormatLabel,
} from "../features/cases/displayText"
import { formatAmount } from "../features/cases/components/caseMoney"

describe("화면 표기 변환", () => {
	it("통화: 데이터셋 이름·ISO 코드 모두 한글, 모르면 원문", () => {
		expect(currencyLabel("US Dollar")).toBe("미국 달러")
		expect(currencyLabel("USD")).toBe("미국 달러")
		expect(currencyLabel("Brazil Real")).toBe("브라질 헤알")
		expect(currencyLabel("Dogecoin")).toBe("Dogecoin")
		expect(formatAmount(1000, "Euro")).toBe("1,000 유로")
		expect(formatAmount(null, "Euro")).toBe("—")
	})
	it("결제 방식·작업자", () => {
		expect(paymentFormatLabel("Wire")).toBe("전신 송금")
		expect(paymentFormatLabel("Credit Card")).toBe("신용카드")
		expect(paymentFormatLabel("Unknown")).toBe("Unknown")
		expect(actorLabel("system")).toBe("시스템")
		expect(actorLabel("inv01")).toBe("inv01")
	})
	it("AI 문장 속 아는 지표 코드·룰 ID만 한글로, 계좌 표기·모르는 코드는 그대로", () => {
		expect(
			humanizeText("(예시) 모델은 account_in_counterparties_24h 신호를 가장 크게 봄"),
		).toBe("(예시) 모델은 '24시간 입금 상대 계좌 수' 신호를 가장 크게 봄")
		expect(humanizeText("R02_FAN_IN 규칙으로 탐지")).toBe("R02 집중 입금 규칙으로 탐지")
		expect(humanizeText("10_BD30 계좌와 some_unknown_code")).toBe(
			"10_BD30 계좌와 some_unknown_code",
		)
		expect(humanizeText(null)).toBeNull()
	})
})
