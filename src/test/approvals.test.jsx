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

// 목록 응답을 직접 만들 때 — rows 의 각 칸이 기본 줄(DRF-000124, 승인자 버튼 있음)을 덮어써요.
const pendingList = (rows) => ({
	items: rows.map((row) => ({
		draft_no: "DRF-000124",
		case_no: "CASE-2022-001001",
		assignee: { login_id: "inv01", display_name: "예시 inv01" },
		submitted_at: "2026-11-12T01:00:00Z",
		verification: null,
		last_rejection: null,
		case_version: 4,
		was_assignee: false,
		available_actions: ["APPROVE", "REJECT"],
		...row,
	})),
	page: 0,
	size: 20,
	total: rows.length,
})

describe("승인함 — 목록 (상태만, 결정은 초안 화면에서)", () => {
	it("승인자는 담당·검증·상태와 [초안 검토하기]를 보고, 목록엔 승인·반려 버튼이 없다", async () => {
		renderApprovals()
		const row = await pendingRow()
		expect(
			within(row).getByRole("link", { name: "CASE-2022-001001 초안 검토하기" }),
		).toHaveAttribute("href", "/cases/CASE-2022-001001/str")
		expect(within(row).getByText("예시 inv01")).toBeInTheDocument()
		expect(within(row).getByText(/통과 · 수정본 1/)).toBeInTheDocument()
		expect(within(row).getByText("검토 대기 · 초안에서 승인·반려")).toBeInTheDocument()
		expect(within(row).queryByRole("button")).not.toBeInTheDocument()
		expect(screen.getByRole("navigation", { name: "페이지" })).toHaveTextContent("전체 1건")
	})

	it("관리자는 목록과 상태만 — [초안 상태 보기]", async () => {
		renderApprovals("admin")
		const row = await pendingRow()
		expect(within(row).queryByRole("button")).not.toBeInTheDocument()
		expect(within(row).getByText("승인 대기 · 승인자가 검토해요")).toBeInTheDocument()
		expect(
			within(row).getByRole("link", { name: "CASE-2022-001001 초안 상태 보기" }),
		).toBeInTheDocument()
		expect(screen.getByText(/관리자는 승인 대기 목록만 볼 수 있어요/)).toBeInTheDocument()
	})

	it("내가 담당했던 케이스는 다른 승인자가 결정한다고 상태로 알린다", async () => {
		server.use(
			http.get("*/api/v1/approvals", () =>
				HttpResponse.json(
					pendingList([
						{
							last_rejection: {
								reason_code: "NEED_REVISION",
								comment: "거래 목적 보완",
								decided_at: "2026-11-11T01:00:00Z",
							},
							was_assignee: true,
							available_actions: [],
						},
					]),
				),
			),
		)
		renderApprovals()
		const row = await pendingRow()
		expect(
			within(row).getByText("내가 담당했던 케이스 · 다른 승인자가 결정해요"),
		).toBeInTheDocument()
		expect(within(row).getByText("보완 요청 · 거래 목적 보완")).toBeInTheDocument()
		expect(within(row).getByText("검증 없음")).toBeInTheDocument()
	})
})

describe("승인함 → 초안 화면에서 결정 (APR-02)", () => {
	async function openDraftFromList() {
		const user = renderApprovals()
		await user.click(
			within(await pendingRow()).getByRole("link", {
				name: "CASE-2022-001001 초안 검토하기",
			}),
		)
		const bar = await screen.findByRole("region", { name: "STR 작업" })
		return { user, bar }
	}

	it("초안 화면엔 [승인함으로 돌아가기]·승인자 안내가 있고, 승인하면 승인 완료 화면으로 간다", async () => {
		const { user, bar } = await openDraftFromList()
		expect(screen.getByRole("link", { name: "← 승인함으로 돌아가기" })).toHaveAttribute(
			"href",
			"/approvals",
		)
		expect(
			screen.getByText(/승인자는 초안을 고칠 수 없어요. 본문과 검증 결과를 확인한 뒤/),
		).toBeInTheDocument()
		// 승인자는 수정 이력 목록을 열지 않아요(담당 조사역만)
		expect(screen.queryByRole("button", { name: "수정 이력" })).not.toBeInTheDocument()
		await user.click(within(bar).getByRole("button", { name: "승인" }))
		const dialog = await screen.findByRole("dialog", { name: "STR 승인" })
		const confirm = within(dialog).getByRole("button", { name: "승인" })
		expect(confirm).toBeDisabled()
		await user.click(within(dialog).getByRole("radio", { name: "4" }))
		await user.click(confirm)
		expect(await screen.findByRole("heading", { name: "승인 완료" })).toBeInTheDocument()
	})

	it("보고 안 함은 사유가 비면 막히고, 반려하면 승인함에서 빠진다", async () => {
		const { user, bar } = await openDraftFromList()
		await user.click(within(bar).getByRole("button", { name: "보고 안 함" }))
		const dialog = await screen.findByRole("dialog", { name: "반려 — 보고 안 함" })
		expect(within(dialog).getByText(/종료만 할 수 있어요/)).toBeInTheDocument()
		const confirm = within(dialog).getByRole("button", { name: "보고 안 함" })
		await user.type(within(dialog).getByLabelText("반려 사유 *"), "   ")
		expect(confirm).toBeDisabled()
		await user.type(within(dialog).getByLabelText("반려 사유 *"), "보고 대상 거래가 아님")
		await user.click(confirm)
		expect(await screen.findByRole("region", { name: "지금 상태" })).toHaveTextContent(
			"반려 · 보고 안 함",
		)
		await user.click(screen.getByRole("link", { name: "← 승인함으로 돌아가기" }))
		expect(await screen.findByText("승인 대기 건이 없습니다.")).toBeInTheDocument()
	})

	it("자기 승인으로 막히면(409 SELF_APPROVAL) 확인창에 그 문구를 보여 준다", async () => {
		server.use(
			http.post("*/api/v1/approvals/:draftNo/approve", () => conflict("SELF_APPROVAL")),
		)
		const { user, bar } = await openDraftFromList()
		await user.click(within(bar).getByRole("button", { name: "승인" }))
		const dialog = await screen.findByRole("dialog", { name: "STR 승인" })
		await user.click(within(dialog).getByRole("radio", { name: "3" }))
		await user.click(within(dialog).getByRole("button", { name: "승인" }))
		expect(
			await screen.findByText("본인이 담당한 케이스는 승인할 수 없습니다."),
		).toBeInTheDocument()
	})
})
