import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import StatusBadge from "../shared/ui/StatusBadge"
import { STATUS_LABELS, STATUS_TONES } from "../features/cases/labels"

// 공통 상태 배지 (SCRUM-332, 05_ui.md 4절 「상태 배지」).
describe("StatusBadge", () => {
	it("뜻(tone)은 다섯 가지만 — 모르는 값은 neutral", () => {
		render(
			<>
				<StatusBadge tone="success">성공</StatusBadge>
				<StatusBadge tone="nope">알 수 없음</StatusBadge>
				<StatusBadge>기본</StatusBadge>
			</>,
		)
		expect(screen.getByText("성공")).toHaveAttribute("data-tone", "success")
		expect(screen.getByText("알 수 없음")).toHaveAttribute("data-tone", "neutral")
		expect(screen.getByText("기본")).toHaveAttribute("data-tone", "neutral")
	})
	it("자리 잡기용 className 은 공통 클래스 뒤에 붙는다", () => {
		render(
			<StatusBadge tone="danger" className="str-check-state">
				실패
			</StatusBadge>,
		)
		expect(screen.getByText("실패")).toHaveClass("status-badge", "str-check-state")
	})
	it("케이스 상태는 모두 뜻이 정해져 있다 — 같은 상태는 어느 화면이든 같은 색", () => {
		expect(Object.keys(STATUS_TONES).sort()).toEqual(Object.keys(STATUS_LABELS).sort())
		expect(STATUS_TONES.REJECTED).toBe("danger")
		expect(STATUS_TONES.REPORTED).toBe("success")
		expect(STATUS_TONES.CLOSED).toBe("neutral")
	})
})
