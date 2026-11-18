import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { apiClient } from "../shared/api/apiClient"

// STR 화면에서 승인자가 본문을 보며 바로 승인·반려(APR-02) — 버튼은 S2 available_actions(BE SCRUM-232)로만.
// MSW 시드: 케이스 1001(DRF-000124)이 승인 대기, inv01 담당.
const users = {
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	apr01: { id: 3, login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" },
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}
const STR_PATH = "/cases/CASE-2022-001001/str"

function renderStrAs(who, options = {}) {
	resetCases(users[who], { pendingApproval: true, ...options })
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

	it("담당 조사역에겐 승인·반려 버튼이 없다", async () => {
		renderStrAs("inv01")
		const bar = await actionBar()
		expect(within(bar).queryByRole("button", { name: "승인" })).not.toBeInTheDocument()
		expect(within(bar).queryByRole("button", { name: "보완 요청" })).not.toBeInTheDocument()
	})

	it("관리자는 META_ONLY라 본문·작업 영역 없이 안내만 보고, 승인·반려 버튼도 없다", async () => {
		renderStrAs("admin")
		expect(
			await screen.findByText(
				"본문은 담당 조사역과 승인자만 볼 수 있어요. 상태와 날짜만 보여 드려요.",
			),
		).toBeInTheDocument()
		expect(screen.queryByRole("region", { name: "STR 작업" })).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "승인" })).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "보완 요청" })).not.toBeInTheDocument()
	})

	it("예전에 담당했던 승인자(이력 REASSIGN)는 서버 규칙대로 버튼이 없다 — W4 12-3", async () => {
		renderStrAs("apr01", { formerAssignee: "apr01" })
		await screen.findByRole("heading", { name: /VI\./ })
		expect(screen.queryByRole("button", { name: "승인" })).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "보완 요청" })).not.toBeInTheDocument()
	})

	it("다른 승인자가 먼저 처리했으면(409) 확인창을 닫고 안내한다", async () => {
		const user = renderStrAs("apr01")
		await user.click(within(await actionBar()).getByRole("button", { name: "승인" }))
		const dialog = await screen.findByRole("dialog", { name: "STR 승인" })
		// 그사이 다른 승인자가 먼저 승인 — MSW 상태를 직접 바꿔요
		const { data } = await apiClient.get("/api/v1/approvals")
		await apiClient.post("/api/v1/approvals/DRF-000124/approve", {
			case_version: data.items[0].case_version,
			suspicion_level_hq: 3,
		})
		await user.click(within(dialog).getByRole("radio", { name: /4/ }))
		await user.click(within(dialog).getByRole("button", { name: "승인" }))
		expect(
			await screen.findByText(
				"다른 승인자가 먼저 처리한 건이에요. 최신 상태를 다시 불러왔어요.",
			),
		).toBeInTheDocument()
		expect(screen.queryByRole("dialog", { name: "STR 승인" })).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "승인" })).not.toBeInTheDocument()
	})
})
