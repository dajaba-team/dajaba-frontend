import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import VerificationPanel from "../features/str/components/VerificationPanel"
import StrFacts from "../features/str/components/StrFacts"
import { SuspicionFields } from "../features/str/components/StrSuspicionPanel"
import {
	SUSPICION_GROUPS,
	SUSPICION_TYPES,
	isKnownSuspicionType,
	suspicionTypeLabel,
} from "../shared/str/suspicionTypes"

// SCRUM-432 시연 다듬기 2 — STR 화면 버튼 색·문구, 의심 유형 「기타」, 사실 값 통화 표기.
describe("저장본 검증 버튼 (SCRUM-432)", () => {
	it("파란 주 버튼이고, 저장 전(dirty)이면 꺼진다", () => {
		const { rerender } = render(<VerificationPanel canVerify onVerify={() => {}} />)
		const button = screen.getByRole("button", { name: "저장본 검증" })
		expect(button).toHaveClass("ui-button-primary")
		expect(button).toBeEnabled()
		rerender(<VerificationPanel canVerify dirty onVerify={() => {}} />)
		expect(screen.getByRole("button", { name: "저장본 검증" })).toBeDisabled()
	})
	it("검증 중 안내에 '최대 90초'가 없다", () => {
		render(<VerificationPanel canVerify verifying onVerify={() => {}} />)
		expect(
			screen.getByText("저장본을 검증하고 있어요. 잠시만 기다려 주세요."),
		).toBeInTheDocument()
		expect(screen.queryByText(/90초/)).not.toBeInTheDocument()
	})
})

describe("의심 유형 「기타」 (SCRUM-432)", () => {
	it("고르는 목록·분류에는 없고, 예전에 고른 초안의 이름표는 그대로 보여 준다", () => {
		expect(SUSPICION_TYPES.some((item) => item.id === "DEMO_VI5_01")).toBe(false)
		expect(SUSPICION_GROUPS).not.toContain("VI-5. 기타 특징 및 유형")
		expect(isKnownSuspicionType("DEMO_VI5_01")).toBe(true)
		expect(suspicionTypeLabel("DEMO_VI5_01")).toBe("기타 (특징·유형을 따로 기술)")
	})
	it("승인 요청 창의 체크 목록에 「기타」가 없다", () => {
		render(
			<SuspicionFields
				types={[]}
				level={null}
				recommended={[]}
				onTypesChange={() => {}}
				onLevelChange={() => {}}
			/>,
		)
		expect(screen.queryByText("기타 (특징·유형을 따로 기술)")).not.toBeInTheDocument()
		expect(screen.queryByText(/VI-5/)).not.toBeInTheDocument()
	})
})

describe("STR 사실 값 통화 (SCRUM-432)", () => {
	it("케이스 화면과 같은 기호(나라) 표기, 모르는 통화는 원문", () => {
		render(
			<StrFacts
				facts={{
					inbound: {
						count: 2,
						by_currency: [
							{ currency: "US Dollar", total: "1000", count: 1 },
							{ currency: "Dogecoin", total: "5", count: 1 },
						],
					},
				}}
			/>,
		)
		const row = screen.getByText("입금").closest("tr")
		expect(row).toHaveTextContent("1,000 $(미국) (1건)")
		expect(row).toHaveTextContent("5 Dogecoin (1건)")
	})
})
