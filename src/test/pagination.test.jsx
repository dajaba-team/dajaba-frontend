import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Pagination from "../shared/ui/Pagination"

const summary = () => screen.getByText(/전체/).textContent

describe("Pagination — 범위 표시 경계 (SCRUM-285)", () => {
	it("지금 보이는 범위를 보여 준다", () => {
		render(<Pagination page={2} totalPages={2} total={30} size={20} onChange={vi.fn()} />)
		expect(summary()).toBe("전체 30건 · 21–30")
	})
	it("page 가 마지막 쪽보다 크면 범위를 빼고 다음 버튼을 막는다", () => {
		render(<Pagination page={5} totalPages={2} total={30} size={20} onChange={vi.fn()} />)
		expect(summary()).toBe("전체 30건")
		expect(screen.getByRole("button", { name: "다음 페이지" })).toBeDisabled()
	})
	it("결과가 없으면 범위를 뺀다", () => {
		render(<Pagination page={1} totalPages={0} total={0} size={20} onChange={vi.fn()} />)
		expect(summary()).toBe("전체 0건")
	})
})
