import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"
import { seedStrDrafts, visibleStrDraft } from "../mocks/strDrafts"

// STR 화면에서 승인자가 본문을 보며 바로 승인·반려(APR-02) — 버튼은 S2 available_actions(BE SCRUM-232)로만.
// MSW 시드: 케이스 1001(DRF-000124)이 승인 대기, inv01 담당.
const users = {
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	apr01: { id: 3, login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" },
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}
const STR_PATH = "/cases/CASE-2022-001001/str"

function renderStrAs(who) {
	resetCases(users[who], { pendingApproval: true })
	const user = userEvent.setup()
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={[STR_PATH]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return user
}

const actionBar = () => screen.findByRole("region", { name: "STR 작업" })

describe("STR 화면 — 승인자 승인·반려 (S2 available_actions)", () => {
	it("승인자는 본문 아래에서 [승인]·[보완 요청]·[보고 안 함]을 보고, 편집 버튼은 없다", async () => {
		renderStrAs("apr01")
		const bar = await actionBar()
		for (const name of ["승인", "보완 요청", "보고 안 함"])
			expect(within(bar).getByRole("button", { name })).toBeInTheDocument()
		expect(within(bar).queryByRole("button", { name: "변경 저장" })).not.toBeInTheDocument()
		expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
	})

	it("승인하면 본점 의심 정도를 골라 확정하고 승인 완료 화면으로 간다", async () => {
		const user = renderStrAs("apr01")
		await user.click(within(await actionBar()).getByRole("button", { name: "승인" }))
		const dialog = await screen.findByRole("dialog", { name: "STR 승인" })
		const confirm = within(dialog).getByRole("button", { name: "승인" })
		expect(confirm).toBeDisabled()
		await user.click(within(dialog).getByRole("radio", { name: /4/ }))
		await user.click(confirm)
		expect(await screen.findByRole("heading", { name: "승인 완료" })).toBeInTheDocument()
	})

	it("보완 요청으로 반려하면 버튼이 사라지고 반려 띠가 뜬다", async () => {
		const user = renderStrAs("apr01")
		await user.click(within(await actionBar()).getByRole("button", { name: "보완 요청" }))
		const dialog = await screen.findByRole("dialog", { name: "반려 — 보완 요청" })
		await user.type(within(dialog).getByRole("textbox"), "금액 근거 보완")
		await user.click(within(dialog).getByRole("button", { name: "보완 요청" }))
		const banner = await screen.findByRole("region", { name: "지금 상태" })
		expect(banner).toHaveTextContent("반려 · 보완 요청 — 금액 근거 보완")
		expect(screen.queryByRole("button", { name: "승인" })).not.toBeInTheDocument()
	})

	it("담당 조사역·관리자에겐 승인·반려 버튼이 없다", async () => {
		renderStrAs("inv01")
		const bar = await actionBar()
		expect(within(bar).queryByRole("button", { name: "승인" })).not.toBeInTheDocument()
		expect(within(bar).queryByRole("button", { name: "보완 요청" })).not.toBeInTheDocument()
	})

	it("자기 승인이면 서버가 []를 줘서 버튼이 안 보인다", async () => {
		const seeded = seedStrDrafts().find((draft) => draft.draft_no === "DRF-000124")
		server.use(
			http.get("*/api/v1/str-drafts/:draftNo", () =>
				HttpResponse.json({
					...visibleStrDraft(users.apr01, seeded),
					case_status: "PENDING_APPROVAL",
					available_actions: [],
				}),
			),
		)
		renderStrAs("apr01")
		await screen.findByRole("heading", { name: /VI\./ })
		expect(screen.queryByRole("button", { name: "승인" })).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "보완 요청" })).not.toBeInTheDocument()
	})
})
