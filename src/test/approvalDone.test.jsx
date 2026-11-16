import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"

// 승인 완료 화면(SCRUM-111) — 마감 배지·제출 전 PDF 미리보기(S7)·모의 제출(P4)·확정본(S8)·PDF 다시 만들기(P5).
// BE 아직 없음(SCRUM-240) — MSW 시드: 케이스 1003(DRF-000098)이 승인 완료, inv01 담당.
const users = {
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
	apr01: { id: 3, login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" },
}

function renderAt(path, who = "apr01", options = {}) {
	resetCases(users[who], options)
	const user = userEvent.setup()
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={[path]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return user
}

const notReady = (pdfStatus) =>
	HttpResponse.json(
		{
			error: {
				code: "REPORT_PDF_NOT_READY",
				message: "not ready",
				details: { pdf_status: pdfStatus },
			},
		},
		{ status: 409 },
	)

let clickSpy
beforeEach(() => {
	// jsdom 에는 blob URL·파일 저장이 없어요 — 만들고 누른 것만 확인해요.
	URL.createObjectURL = vi.fn(() => "blob:mock-pdf")
	URL.revokeObjectURL = vi.fn()
	clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
})
afterEach(() => clickSpy.mockRestore())

describe("승인 완료 — 승인 뒤", () => {
	it("승인함에서 승인하면 이 화면으로 와서 마감 배지와 [모의 제출]이 보인다", async () => {
		const user = renderAt("/approvals", "apr01", { pendingApproval: true })
		const table = await screen.findByRole("region", { name: "승인 대기 표" })
		await user.click(within(table).getByRole("button", { name: "승인" }))
		const dialog = await screen.findByRole("dialog", { name: "STR 승인" })
		await user.click(within(dialog).getByRole("radio", { name: "5" }))
		await user.click(within(dialog).getByRole("button", { name: "승인" }))

		expect(await screen.findByRole("heading", { name: "승인 완료" })).toBeInTheDocument()
		// 방금 승인했으니 마감은 아직 남아 있어요(3영업일 — 오늘이 어떤 요일이든 1~3)
		expect(
			await screen.findByText(/마감까지 [1-3]영업일 · .* · 공휴일 미반영/),
		).toBeInTheDocument()
		expect(screen.getByText("지점 - · 본점 5")).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "모의 제출" })).toBeInTheDocument()
	})
})

describe("승인 완료 — 미리보기·모의 제출·확정본", () => {
	it("제출 전 PDF 미리보기를 화면 안에 띄운다", async () => {
		const user = renderAt("/approvals/DRF-000098")
		await user.click(await screen.findByRole("button", { name: "제출 전 PDF 미리보기" }))
		expect(await screen.findByTitle("제출 전 PDF 미리보기")).toHaveAttribute(
			"src",
			"blob:mock-pdf",
		)
		expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
	})

	it("모의 제출하면 보고됨이 되고, 확정본 PDF를 받는다", async () => {
		const user = renderAt("/approvals/DRF-000098")
		await user.click(await screen.findByRole("button", { name: "모의 제출" }))
		const dialog = await screen.findByRole("dialog", { name: "모의 제출" })
		expect(within(dialog).getByText(/되돌릴 수 없어요/)).toBeInTheDocument()
		await user.click(within(dialog).getByRole("button", { name: "모의 제출" }))

		expect(await screen.findByText(/모의 제출을 마쳤어요/)).toBeInTheDocument()
		expect(screen.getByText("보고됨")).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "모의 제출" })).not.toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: "확정본 PDF 받기" }))
		await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1))
	})

	it("확정본 PDF를 못 만들었으면(FAILED) 승인자에게 [PDF 다시 만들기]를 준다", async () => {
		const user = renderAt("/approvals/DRF-000098")
		await user.click(await screen.findByRole("button", { name: "모의 제출" }))
		const dialog = await screen.findByRole("dialog", { name: "모의 제출" })
		await user.click(within(dialog).getByRole("button", { name: "모의 제출" }))
		await screen.findByText(/모의 제출을 마쳤어요/)

		server.use(http.get("*/api/v1/str-drafts/:draftNo/report.pdf", () => notReady("FAILED")))
		await user.click(screen.getByRole("button", { name: "확정본 PDF 받기" }))
		expect(await screen.findByText(/PDF를 만들지 못했어요/)).toBeInTheDocument()
		// MSW 기본 상태는 READY 라 P5 는 409 — 여기선 202 를 흉내 내요
		server.use(
			http.post("*/api/v1/approvals/:draftNo/report/pdf", () =>
				HttpResponse.json({ pdf_status: "PENDING" }, { status: 202 }),
			),
		)
		await user.click(screen.getByRole("button", { name: "PDF 다시 만들기" }))
		expect(await screen.findByText(/PDF를 다시 만들고 있어요/)).toBeInTheDocument()
	})

	it("PDF를 만드는 중이면(PENDING) 잠시 후 다시 받으라고 안내한다", async () => {
		server.use(http.get("*/api/v1/str-drafts/:draftNo/report.pdf", () => notReady("PENDING")))
		const user = renderAt("/approvals/DRF-000098")
		await user.click(await screen.findByRole("button", { name: "모의 제출" }))
		await user.click(
			within(await screen.findByRole("dialog", { name: "모의 제출" })).getByRole("button", {
				name: "모의 제출",
			}),
		)
		await user.click(await screen.findByRole("button", { name: "확정본 PDF 받기" }))
		expect(await screen.findByText(/PDF를 만드는 중이에요/)).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "PDF 다시 만들기" })).not.toBeInTheDocument()
	})

	it("그사이 바뀌었으면(409 CONCURRENT_UPDATE) 확인창에 안내를 보인다", async () => {
		server.use(
			http.post("*/api/v1/approvals/:draftNo/report", () =>
				HttpResponse.json(
					{ error: { code: "CONCURRENT_UPDATE", message: "x", details: {} } },
					{ status: 409 },
				),
			),
		)
		const user = renderAt("/approvals/DRF-000098")
		await user.click(await screen.findByRole("button", { name: "모의 제출" }))
		const dialog = await screen.findByRole("dialog", { name: "모의 제출" })
		await user.click(within(dialog).getByRole("button", { name: "모의 제출" }))
		expect(
			await within(dialog).findByText(/다른 사용자가 먼저 변경했습니다/),
		).toBeInTheDocument()
	})
})

describe("승인 완료 — 누가·어떤 상태", () => {
	it("관리자는 상태만 보고 PDF·[모의 제출] 버튼이 없다(PDF 권한 없음)", async () => {
		renderAt("/approvals/DRF-000098", "admin")
		expect(
			await screen.findByText(/모의 제출과 PDF 미리보기는 승인자가 해요/),
		).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "모의 제출" })).not.toBeInTheDocument()
		expect(
			screen.queryByRole("button", { name: "제출 전 PDF 미리보기" }),
		).not.toBeInTheDocument()
	})

	it("승인 완료가 아닌 초안이면 지금 상태만 알려 준다", async () => {
		renderAt("/approvals/DRF-000124")
		expect(
			await screen.findByText(/승인 완료 상태가 아니에요\(지금 초안 작성됨\)/),
		).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "모의 제출" })).not.toBeInTheDocument()
	})
})
