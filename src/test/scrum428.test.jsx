import { afterEach, describe, expect, it } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { MOCK_PASSWORD, resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"
import { TUTORIAL_STEPS } from "../shared/ui/tutorial/tutorialSteps"

// SCRUM-428 시연 다듬기 — 로그아웃 뒤 대시보드, 위 띠(로고·이름 칩·사용 안내), 처리 작업 확인창.
const INV01 = { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" }
const REVIEWING = "CASE-2022-001004"

function renderApp(path) {
	resetCases(INV01)
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={[path]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return userEvent.setup()
}

afterEach(() => server.events.removeAllListeners())

describe("로그아웃 뒤 첫 화면 (SCRUM-428)", () => {
	it("케이스를 보다가 로그아웃하고 다른 계정으로 로그인하면 대시보드가 열린다", async () => {
		const user = renderApp(`/cases/${REVIEWING}`)
		await screen.findByRole("textbox", { name: "메모 내용" })
		await user.click(screen.getByRole("button", { name: "로그아웃" }))
		await screen.findByText("로그인이 필요합니다.")
		await user.type(screen.getByLabelText("아이디"), "apr01")
		await user.type(screen.getByLabelText("비밀번호"), MOCK_PASSWORD)
		await user.click(screen.getByRole("button", { name: "로그인" }))
		expect(
			await screen.findByRole("heading", { level: 1, name: "승인자 대시보드" }),
		).toBeInTheDocument()
		expect(screen.queryByText(REVIEWING, { selector: "h1" })).not.toBeInTheDocument()
	})
})

describe("위 띠 (SCRUM-428)", () => {
	it("로고 밑 부제가 없고, 칩은 이름(역할)이다", async () => {
		renderApp("/overview")
		await screen.findByRole("navigation", { name: "주요 메뉴" })
		expect(screen.queryByText("AML 인텔리전스")).not.toBeInTheDocument()
		expect(document.querySelector(".app-header .persona > summary")).toHaveTextContent(
			"김지윤(조사역)",
		)
	})
	it("[사용 안내]는 단계별 창 — [다음]·→ 키로 넘기고, 점이 지금 단계를 가리키고, 마지막은 [시작하기]로 닫는다", async () => {
		const user = renderApp("/overview")
		await user.click(await screen.findByRole("button", { name: "사용 안내" }))
		const dialog = await screen.findByRole("dialog", { name: "사용 안내" })
		const dots = within(dialog).getAllByRole("button", { name: /단계/ })
		expect(dots).toHaveLength(TUTORIAL_STEPS.length)
		expect(dots[0]).toHaveAttribute("aria-current", "step")
		expect(within(dialog).getByRole("button", { name: "이전" })).toBeDisabled()

		await user.click(within(dialog).getByRole("button", { name: "다음" }))
		expect(dots[1]).toHaveAttribute("aria-current", "step")
		expect(within(dialog).getByText(TUTORIAL_STEPS[1].title)).toBeInTheDocument()
		await user.keyboard("{ArrowRight}")
		expect(dots[2]).toHaveAttribute("aria-current", "step")
		await user.keyboard("{ArrowLeft}")
		expect(dots[1]).toHaveAttribute("aria-current", "step")

		await user.click(dots[TUTORIAL_STEPS.length - 1])
		expect(within(dialog).queryByRole("button", { name: "다음" })).not.toBeInTheDocument()
		await user.click(within(dialog).getByRole("button", { name: "시작하기" }))
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
	})
})

describe("처리 작업 확인창 (SCRUM-428)", () => {
	it("에스컬레이션은 카드 아래가 아니라 확인창으로 열리고, 사유 예시로 채워 보낸 뒤 초안 생성도 확인창이다", async () => {
		const user = renderApp(`/cases/${REVIEWING}`)
		const card = await screen.findByRole("region", { name: "처리 작업" })
		// 에스컬레이션은 판단 요약의 [다음 처리] 주 버튼으로 나와요(카드엔 같은 버튼을 또 그리지 않음).
		const [escalate] = await screen.findAllByRole("button", { name: "에스컬레이션" })
		await user.click(escalate)
		const dialog = await screen.findByRole("dialog", { name: "에스컬레이션" })
		// 폼은 확인창(role=dialog) 안에만 — 예전처럼 카드 안에 펼쳐지는 폼(.case-action-form)은 없어요.
		expect(within(dialog).getByRole("form", { name: "에스컬레이션" })).toBeInTheDocument()
		expect(card.querySelector(".case-action-form")).toBeNull()
		const submit = within(dialog).getByRole("button", { name: "에스컬레이션 실행" })
		expect(submit).toBeDisabled()
		const examples = within(dialog).getByRole("group", { name: "사유 예시" })
		const first = within(examples).getAllByRole("button")[0]
		await user.click(first)
		expect(within(dialog).getByLabelText("에스컬레이션 사유")).toHaveValue(first.textContent)
		await user.click(submit)
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

		// 에스컬레이션 뒤 [STR 초안 생성]도 확인창 — "최대 90초" 안내는 없어요.
		const [generate] = await screen.findAllByRole("button", { name: "STR 초안 생성" })
		await user.click(generate)
		const generateDialog = await screen.findByRole("dialog", { name: "STR 초안 생성" })
		expect(within(generateDialog).queryByText(/90초/)).not.toBeInTheDocument()
		expect(within(generateDialog).getByText(/생성과 검증은 따로예요/)).toBeInTheDocument()
		await user.click(within(generateDialog).getByRole("button", { name: "취소" }))
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
	})
	it("종료는 확인창이고, 확인 버튼은 파란 주 버튼이 아니라 빨간 되돌릴 수 없는 버튼이다", async () => {
		const user = renderApp(`/cases/${REVIEWING}`)
		const card = await screen.findByRole("region", { name: "처리 작업" })
		await user.click(within(card).getByRole("button", { name: "종료" }))
		const dialog = await screen.findByRole("dialog", { name: "케이스 종료" })
		const submit = within(dialog).getByRole("button", { name: "종료 실행" })
		expect(submit).toHaveClass("is-irreversible")
		expect(submit).not.toHaveClass("primary")
		await user.click(within(dialog).getByRole("button", { name: "취소" }))
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
	})
})
