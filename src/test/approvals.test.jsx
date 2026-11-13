import { describe, expect, it } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"

// 승인함(APR-01, SCRUM-241) — P1 목록·P2 승인·P3 반려. MSW 시드: 케이스 1001(DRF-000124)이 승인 대기, inv01 담당.
const users = {
	apr01: { id: 3, login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" },
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}

function renderApprovals(who = "apr01") {
	resetCases(users[who], { pendingApproval: true })
	const user = userEvent.setup()
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={["/approvals"]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return user
}

const pendingRow = async () => {
	const table = await screen.findByRole("region", { name: "승인 대기 표" })
	return within(table).getByRole("row", { name: /DRF-000124/ })
}

const conflict = (code) =>
	HttpResponse.json({ error: { code, message: code, details: {} } }, { status: 409 })

describe("승인함 — 목록", () => {
	it("승인자는 승인 대기 초안과 검증·담당·초안 보기 링크, [승인]·[보완 요청]·[보고 안 함]을 본다", async () => {
		renderApprovals()
		const row = await pendingRow()
		expect(within(row).getByText("CASE-2022-001001 초안 보기")).toHaveAttribute(
			"href",
			"/cases/CASE-2022-001001/str",
		)
		expect(within(row).getByText("예시 inv01")).toBeInTheDocument()
		expect(within(row).getByText(/통과 · 수정본 1/)).toBeInTheDocument()
		for (const name of ["승인", "보완 요청", "보고 안 함"])
			expect(within(row).getByRole("button", { name })).toBeInTheDocument()
		expect(screen.getByText(/전체 1건/)).toBeInTheDocument()
	})

	it("관리자는 목록만 보고 승인·반려 버튼이 없다", async () => {
		renderApprovals("admin")
		const row = await pendingRow()
		expect(within(row).queryByRole("button")).not.toBeInTheDocument()
		expect(screen.getByText(/관리자는 승인 대기 목록만 볼 수 있어요/)).toBeInTheDocument()
	})

	it("내가 담당했던 케이스는 서버가 버튼을 주지 않고 안내만 보인다", async () => {
		server.use(
			http.get("*/api/v1/approvals", () =>
				HttpResponse.json({
					items: [
						{
							draft_no: "DRF-000124",
							case_no: "CASE-2022-001001",
							assignee: { login_id: "inv01", display_name: "예시 inv01" },
							submitted_at: "2026-11-12T01:00:00Z",
							verification: null,
							last_rejection: {
								reason_code: "NEED_REVISION",
								comment: "거래 목적 보완",
								decided_at: "2026-11-11T01:00:00Z",
							},
							case_version: 4,
							was_assignee: true,
							available_actions: [],
						},
					],
					page: 0,
					size: 20,
					total: 1,
				}),
			),
		)
		renderApprovals()
		const row = await pendingRow()
		expect(within(row).queryByRole("button")).not.toBeInTheDocument()
		expect(within(row).getByText(/내가 담당했던 케이스라/)).toBeInTheDocument()
		expect(within(row).getByText("보완 요청 · 거래 목적 보완")).toBeInTheDocument()
		expect(within(row).getByText("검증 없음")).toBeInTheDocument()
	})
})

describe("승인함 — 승인·반려", () => {
	it("승인은 본점 의심 정도를 고르기 전엔 막히고, 승인하면 목록에서 빠진다", async () => {
		const user = renderApprovals()
		await user.click(within(await pendingRow()).getByRole("button", { name: "승인" }))
		const dialog = await screen.findByRole("dialog", { name: "STR 승인" })
		const confirm = within(dialog).getByRole("button", { name: "승인" })
		expect(confirm).toBeDisabled()
		await user.click(within(dialog).getByRole("radio", { name: "4" }))
		await user.click(confirm)
		expect(await screen.findByText("승인 대기 건이 없습니다.")).toBeInTheDocument()
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
	})

	it("반려는 갈래별 확인창이 열리고 사유가 비면 막히며, 반려하면 목록에서 빠진다", async () => {
		const user = renderApprovals()
		await user.click(within(await pendingRow()).getByRole("button", { name: "보고 안 함" }))
		const dialog = await screen.findByRole("dialog", { name: "반려 — 보고 안 함" })
		expect(within(dialog).getByText(/종료만 할 수 있어요/)).toBeInTheDocument()
		const confirm = within(dialog).getByRole("button", { name: "보고 안 함" })
		await user.type(within(dialog).getByLabelText("반려 사유 *"), "   ")
		expect(confirm).toBeDisabled()
		await user.type(within(dialog).getByLabelText("반려 사유 *"), "보고 대상 거래가 아님")
		await user.click(confirm)
		expect(await screen.findByText("승인 대기 건이 없습니다.")).toBeInTheDocument()
	})

	it("그사이 다른 사람이 바꿨으면 409 안내를 보이고 입력은 그대로 두며 목록을 다시 부른다", async () => {
		let listCalls = 0
		server.use(
			http.get("*/api/v1/approvals", () => {
				listCalls += 1
				return undefined // 기본 핸들러로 넘겨요
			}),
			http.post("*/api/v1/approvals/:draftNo/reject", () => conflict("CONCURRENT_UPDATE")),
		)
		const user = renderApprovals()
		await user.click(within(await pendingRow()).getByRole("button", { name: "보완 요청" }))
		const dialog = await screen.findByRole("dialog", { name: "반려 — 보완 요청" })
		const box = within(dialog).getByLabelText("반려 사유 *")
		await user.type(box, "거래 목적 보완 필요")
		const before = listCalls
		await user.click(within(dialog).getByRole("button", { name: "보완 요청" }))
		expect(
			await within(dialog).findByText(/다른 사용자가 먼저 변경했습니다/),
		).toBeInTheDocument()
		expect(box).toHaveValue("거래 목적 보완 필요")
		await waitFor(() => expect(listCalls).toBeGreaterThan(before))
	})

	it("자기 승인으로 막히면(409 SELF_APPROVAL) 그 문구를 보여 준다", async () => {
		server.use(
			http.post("*/api/v1/approvals/:draftNo/approve", () => conflict("SELF_APPROVAL")),
		)
		const user = renderApprovals()
		await user.click(within(await pendingRow()).getByRole("button", { name: "승인" }))
		const dialog = await screen.findByRole("dialog", { name: "STR 승인" })
		await user.click(within(dialog).getByRole("radio", { name: "3" }))
		await user.click(within(dialog).getByRole("button", { name: "승인" }))
		expect(
			await within(dialog).findByText("본인이 담당한 케이스는 승인할 수 없습니다."),
		).toBeInTheDocument()
		expect(within(dialog).getByRole("radio", { name: "3" })).toBeChecked()
	})
})
