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
	it("모델이 주목한 점의 특징 이름·유형 코드도 한글로 (SCRUM-410)", () => {
		expect(
			humanizeText("모델은 paid_raw_currency_count·evidence_account_count 신호를 크게 봄"),
		).toBe("모델은 '보낸 통화 종류 수'·'근거 거래 관련 계좌 수' 신호를 크게 봄")
		// 표에 없어도 낱말을 모두 알면 낱말 뜻으로
		expect(humanizeText("received_amount_max 가 컸음")).toBe("'받은 금액 최대' 가 컸음")
		// 낱말 하나라도 모르면 그대로 — summary_v2 같은 버전 표기도 건드리지 않아요
		expect(humanizeText("weird_feature_x · summary_v2")).toBe("weird_feature_x · summary_v2")
		expect(humanizeText("SCATTER_GATHER 경로는 3개")).toBe("흩었다 모으기 경로는 3개")
		expect(humanizeText("R05_SCATTER_GATHER 규칙")).toBe("R05 흩었다 모으기 규칙")
	})
})
