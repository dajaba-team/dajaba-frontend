import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import RoleHero from "../features/overview/components/RoleHero"

function show(role, loginId = "tester") {
	return render(
		<MemoryRouter>
			<RoleHero role={role} loginId={loginId} />
		</MemoryRouter>,
	)
}

beforeEach(() => {
	localStorage.clear()
})

describe("역할별 Hero 이동 카드", () => {
	it.each([
		["INVESTIGATOR", "내 담당 케이스 보기", "/cases?mine=1", "배정 케이스 · 근거 거래 확인"],
		["APPROVER", "승인함 열기", "/approvals", "검토 요청 · 모의 제출"],
		["ADMIN", "데이터·배치 운영 열기", "/admin/batches", "배치 결과 확인 · 담당 배정"],
	])("%s 카드는 버튼 문구로 읽히고 안내 문구는 설명으로 붙는다", (role, name, href, sub) => {
		show(role)
		const link = screen.getByRole("link", { name })
		expect(link).toHaveAttribute("href", href)
		expect(link).toHaveAccessibleDescription(sub)
	})

	it("알 수 없는 역할이면 조사역 카드를 보여 준다", () => {
		show("UNKNOWN")
		expect(screen.getByRole("link", { name: "내 담당 케이스 보기" })).toHaveAttribute(
			"href",
			"/cases?mine=1",
		)
	})

	it("안내를 접으면 안내 문장이 사라지고 카드가 낮은 모양으로 바뀌며 다시 열어도 유지된다", async () => {
		const { unmount } = show("ADMIN", "admin")
		const band = screen.getByRole("region", { name: "오늘의 배치와 배정 현황" })
		expect(band).not.toHaveClass("is-compact")
		await userEvent.click(screen.getByRole("button", { name: "첫 이용 안내 닫기" }))
		expect(screen.queryByRole("button", { name: "첫 이용 안내 닫기" })).not.toBeInTheDocument()
		expect(band).toHaveClass("is-compact")
		unmount()
		show("ADMIN", "admin")
		expect(screen.getByRole("region", { name: "오늘의 배치와 배정 현황" })).toHaveClass(
			"is-compact",
		)
	})
})
