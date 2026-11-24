import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"

// 로그인 카드 (SCRUM-345) — 로고·제목·부제목, 개발용 안내 문구 없음, 비밀번호 보기/숨기기.
function renderSignedOut() {
	resetCases(null)
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={["/cases"]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return userEvent.setup()
}

describe("로그인 카드 (SCRUM-345)", () => {
	it("로고 아래 제목 DAJAVA·부제목이 있고, 개발용 계정 안내 문구는 없다", async () => {
		renderSignedOut()
		const card = await screen.findByRole("region", { name: "로그인" })
		expect(await within(card).findByRole("heading", { name: "DAJAVA" })).toBeInTheDocument()
		expect(within(card).getByText("AI 기반 자금세탁방지 업무 시스템")).toBeInTheDocument()
		expect(card.querySelector("img.auth-brand-mark")).not.toBeNull()
		expect(card).not.toHaveTextContent(/로컬 계정|DEV_USER_PASSWORD|mock-password/)
	})

	it("[비밀번호 보기]로 입력한 비밀번호를 보였다 숨겼다 한다", async () => {
		const user = renderSignedOut()
		const input = await screen.findByLabelText("비밀번호")
		await user.type(input, "secret-1")
		expect(input).toHaveAttribute("type", "password")

		await user.click(screen.getByRole("button", { name: "비밀번호 보기" }))
		expect(input).toHaveAttribute("type", "text")
		expect(input).toHaveValue("secret-1")
		const hide = screen.getByRole("button", { name: "비밀번호 숨기기" })
		expect(hide).toHaveAttribute("aria-pressed", "true")

		await user.click(hide)
		expect(input).toHaveAttribute("type", "password")
	})

	it("로그인이 실패해 비밀번호가 지워지면 다시 숨김으로 돌아간다", async () => {
		const user = renderSignedOut()
		await user.type(await screen.findByLabelText("아이디"), "admin")
		await user.type(screen.getByLabelText("비밀번호"), "wrong-password")
		await user.click(screen.getByRole("button", { name: "비밀번호 보기" }))
		await user.click(screen.getByRole("button", { name: "로그인" }))

		expect(await screen.findByRole("alert")).toBeInTheDocument()
		expect(screen.getByLabelText("비밀번호")).toHaveValue("")
		expect(screen.getByLabelText("비밀번호")).toHaveAttribute("type", "password")
		expect(screen.getByRole("button", { name: "비밀번호 보기" })).toBeInTheDocument()
	})
})
