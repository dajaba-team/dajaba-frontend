import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import StatusBadge from "../shared/ui/StatusBadge"
import { STATUS_LABELS, STATUS_TONES, statusToneOf } from "../features/cases/labels"

// 공통 상태 배지 (SCRUM-332, docs/05_ui.md §2) — 색 + 기호 + 글자. 기호는 CSS ::before 라 글자 내용엔 상태 이름만 있어요.
describe("StatusBadge", () => {
	it("톤마다 같은 클래스를 붙이고, 글자 내용은 상태 이름 그대로다", () => {
		render(
			<>
				<StatusBadge tone="success">성공</StatusBadge>
				<StatusBadge tone="danger">실패</StatusBadge>
				<StatusBadge tone="warning">일부 실패</StatusBadge>
				<StatusBadge tone="info">실행 중</StatusBadge>
				<StatusBadge tone="neutral">대기</StatusBadge>
			</>,
		)
		const success = screen.getByText("성공")
		expect(success).toHaveClass("status-badge", "is-success")
		expect(success.textContent).toBe("성공")
		expect(screen.getByText("실패")).toHaveClass("is-danger")
		expect(screen.getByText("일부 실패")).toHaveClass("is-warning")
		expect(screen.getByText("실행 중")).toHaveClass("is-info")
		expect(screen.getByText("대기")).toHaveClass("is-neutral")
	})
	it("모르는 톤은 중립으로, 추가 className 과 data 속성은 그대로 붙인다", () => {
		render(
			<StatusBadge tone="nope" className="batch-badge" data-state="idle">
				대기
			</StatusBadge>,
		)
		const badge = screen.getByText("대기")
		expect(badge).toHaveClass("status-badge", "is-neutral", "batch-badge")
		expect(badge).toHaveAttribute("data-state", "idle")
	})
})

describe("케이스 상태 톤", () => {
	it("모든 케이스 상태에 톤이 있고, 뜻이 같은 상태는 같은 톤이다", () => {
		expect(Object.keys(STATUS_TONES).sort()).toEqual(Object.keys(STATUS_LABELS).sort())
		expect(statusToneOf("APPROVED")).toBe(statusToneOf("REPORTED"))
		expect(statusToneOf("REVIEWING")).toBe("info")
		expect(statusToneOf("REJECTED")).toBe("warning")
		expect(statusToneOf("CLOSED")).toBe("neutral")
		expect(statusToneOf("UNKNOWN")).toBe("neutral")
	})
})
