import { describe, expect, it } from "vitest"
import { basisLabel, reasonLabel, withReasonUnit } from "../features/cases/reasonLabels"
import { formatNumber } from "../features/cases/components/caseMoney"

describe("점수 근거 한글 표기", () => {
	it("지표 코드와 기간을 한글 이름으로 바꾼다", () => {
		expect(reasonLabel("account_in_counterparties_24h")).toBe("24시간 입금 상대 계좌 수")
		expect(reasonLabel("amount_out_sum_7d")).toBe("7일 출금 합계")
		expect(reasonLabel("tx_count")).toBe("거래 건수")
	})
	it("모르는 지표·기준은 null — 화면이 코드를 그대로 보여 주거나 생략한다", () => {
		expect(reasonLabel("brand_new_feature_24h")).toBeNull()
		expect(reasonLabel(null)).toBeNull()
		expect(basisLabel("distinct_inbound_counterparties")).toBe("서로 다른 입금 상대 계좌")
		expect(basisLabel("something_else")).toBeNull()
	})
	it("단위: 계좌 수는 개, 그 밖 count 는 건, ratio 는 %, 통화 코드는 한글 통화 이름", () => {
		const name = "account_in_counterparties_24h"
		expect(withReasonUnit(12, "count", name, formatNumber)).toBe("12개")
		expect(withReasonUnit(5, "count", "tx_count_24h", formatNumber)).toBe("5건")
		expect(withReasonUnit(0.4, "ratio", "night_tx_ratio_24h", formatNumber)).toBe("40%")
		expect(withReasonUnit(152000.5, "USD", "amount_out_sum_24h", formatNumber)).toBe(
			"152,000.5 미국 달러",
		)
		expect(withReasonUnit(3, "weird_unit", name, formatNumber)).toBe("3")
		expect(withReasonUnit(null, "count", name, formatNumber)).toBeNull()
	})
})
