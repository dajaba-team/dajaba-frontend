import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import InfoTip from "../shared/ui/InfoTip"

describe("InfoTip", () => {
	it("기본(대시보드·배치)은 예전 그대로 — 눌러도 열림 상태가 없다", async () => {
		const user = userEvent.setup()
		render(<InfoTip label="점수" text="설명" />)
		const button = screen.getByRole("button", { name: "점수 설명" })
		await user.click(button)
		expect(button).not.toHaveAttribute("aria-expanded")
		expect(button.parentElement).toHaveClass("kpi-info")
		expect(button.parentElement).not.toHaveClass("is-open")
		expect(screen.getByRole("tooltip", { hidden: true })).not.toHaveClass("is-fixed")
	})
	it("clickable 은 눌러서 열고, 다시 누르거나 Esc·포커스 이동이면 닫는다", async () => {
		const user = userEvent.setup()
		render(
			<>
				<InfoTip clickable label="기여도" text="모델 내부 값" />
				<button type="button">다른 곳</button>
			</>,
		)
		const button = screen.getByRole("button", { name: "기여도 설명" })
		const wrap = button.parentElement
		expect(screen.getByRole("tooltip", { hidden: true })).toHaveClass("is-fixed")
		await user.click(button)
		expect(wrap).toHaveClass("is-open")
		expect(button).toHaveAttribute("aria-expanded", "true")
		await user.click(button)
		expect(wrap).not.toHaveClass("is-open")
		await user.click(button)
		await user.keyboard("{Escape}")
		expect(wrap).not.toHaveClass("is-open")
		await user.click(button)
		await user.click(screen.getByRole("button", { name: "다른 곳" }))
		expect(wrap).not.toHaveClass("is-open")
	})
})
