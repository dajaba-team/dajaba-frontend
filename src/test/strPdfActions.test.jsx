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
import { seedStrDrafts, visibleStrDraft } from "../mocks/strDrafts"

// STR 화면의 보고서 PDF 버튼 (QnA BH-FE-01) — S2 available_actions 의 PREVIEW_PDF·DOWNLOAD_PDF 로만 켜요.
// BE StrDraftActions: 잠긴 초안이면 승인자(누구나)와 담당 조사역에게 APPROVED → PREVIEW_PDF, REPORTED → DOWNLOAD_PDF.
// MSW 시드: 케이스 1003(DRF-000098)이 승인 완료, inv01 담당, apr01 이 승인.
const users = {
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	inv02: { id: 2, login_id: "inv02", display_name: "예시 inv02", role: "INVESTIGATOR" },
	apr01: { id: 3, login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" },
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}
const STR_PATH = "/cases/CASE-2022-001003/str"

function renderStrAs(who) {
	resetCases(users[who])
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

/** S2 를 보고됨(REPORTED)으로 — 서버가 주는 동작을 그대로 흉내 내요. */
function reportedDraftFor(who, actions) {
	const seeded = seedStrDrafts().find((draft) => draft.draft_no === "DRF-000098")
	server.use(
		http.get("*/api/v1/str-drafts/:draftNo", () =>
			HttpResponse.json({
				...visibleStrDraft(users[who], seeded),
				case_status: "REPORTED",
				available_actions: actions,
			}),
		),
	)
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

const pdfRegion = () => screen.findByRole("region", { name: "보고서 PDF" })

let clickSpy
beforeEach(() => {
	// jsdom 에는 blob URL·파일 저장이 없어요 — 만들고 누른 것만 확인해요.
	URL.createObjectURL = vi.fn(() => "blob:mock-pdf")
	URL.revokeObjectURL = vi.fn()
	clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
})
afterEach(() => clickSpy.mockRestore())

describe("STR 화면 — 승인됨(APPROVED) 제출 전 PDF 미리보기", () => {
	it("담당 조사역에게 [제출 전 PDF 미리보기]가 보이고, 누르면 화면 안에 띄운다", async () => {
		const user = renderStrAs("inv01")
		const region = await pdfRegion()
		await user.click(within(region).getByRole("button", { name: "제출 전 PDF 미리보기" }))
		expect(await screen.findByTitle("제출 전 PDF 미리보기")).toHaveAttribute(
			"src",
			"blob:mock-pdf",
		)
		expect(
			within(region).queryByRole("button", { name: "확정본 PDF 받기" }),
		).not.toBeInTheDocument()
	})

	it("승인자에게도 미리보기가 보인다", async () => {
		renderStrAs("apr01")
		const region = await pdfRegion()
		expect(
			within(region).getByRole("button", { name: "제출 전 PDF 미리보기" }),
		).toBeInTheDocument()
	})

	it("담당이 아닌 조사역·관리자는 본문을 못 봐서(META_ONLY) PDF 버튼도 없다", async () => {
		renderStrAs("inv02")
		await screen.findByText(
			"본문은 담당 조사역과 승인자만 볼 수 있어요. 상태와 날짜만 보여 드려요.",
		)
		expect(screen.queryByRole("region", { name: "보고서 PDF" })).not.toBeInTheDocument()
	})
})

describe("STR 화면 — 보고됨(REPORTED) 확정본 PDF", () => {
	it("담당 조사역이 [확정본 PDF 받기]로 파일을 받는다", async () => {
		reportedDraftFor("inv01", ["DOWNLOAD_PDF"])
		// MSW 케이스 상태는 시드대로 APPROVED라 report.pdf 가 409 를 줘요 — S2 처럼 보고됨 응답(다 만든 PDF)으로 바꿔요.
		server.use(
			http.get(
				"*/api/v1/str-drafts/:draftNo/report.pdf",
				() =>
					new HttpResponse("%PDF-1.4\n% REPORT\n", {
						headers: { "Content-Type": "application/pdf" },
					}),
			),
		)
		const user = renderStrAs("inv01")
		const region = await pdfRegion()
		expect(
			within(region).queryByRole("button", { name: "제출 전 PDF 미리보기" }),
		).not.toBeInTheDocument()
		await user.click(within(region).getByRole("button", { name: "확정본 PDF 받기" }))
		await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1))
	})

	it("아직 만드는 중이면(409 PENDING) 다시 받으라고 안내한다", async () => {
		reportedDraftFor("inv01", ["DOWNLOAD_PDF"])
		server.use(http.get("*/api/v1/str-drafts/:draftNo/report.pdf", () => notReady("PENDING")))
		const user = renderStrAs("inv01")
		await user.click(within(await pdfRegion()).getByRole("button", { name: "확정본 PDF 받기" }))
		expect(
			await screen.findByText("PDF를 만드는 중이에요. 잠시 후 다시 받아 주세요."),
		).toBeInTheDocument()
		expect(clickSpy).not.toHaveBeenCalled()
	})

	it("만들지 못했으면(409 FAILED) 승인자에게 다시 만들기를 요청하라고 안내한다 — 조사역 화면엔 다시 만들기 버튼 없음", async () => {
		reportedDraftFor("inv01", ["DOWNLOAD_PDF"])
		server.use(http.get("*/api/v1/str-drafts/:draftNo/report.pdf", () => notReady("FAILED")))
		const user = renderStrAs("inv01")
		await user.click(within(await pdfRegion()).getByRole("button", { name: "확정본 PDF 받기" }))
		expect(
			await screen.findByText(/승인한 승인자에게 \[PDF 다시 만들기\]를 요청해 주세요/),
		).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "PDF 다시 만들기" })).not.toBeInTheDocument()
	})

	it("서버가 PDF 동작을 안 주면 버튼도 없다", async () => {
		reportedDraftFor("inv01", [])
		renderStrAs("inv01")
		await screen.findByRole("heading", { name: /VI\./ })
		expect(screen.queryByRole("region", { name: "보고서 PDF" })).not.toBeInTheDocument()
	})
})
