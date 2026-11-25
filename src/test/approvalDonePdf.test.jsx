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
import { detailResponse, seedCases } from "../mocks/cases"
import { seedStrDrafts, visibleStrDraft } from "../mocks/strDrafts"
import { readJobs } from "../shared/jobs/jobStore"

// 승인 완료·STR 화면의 확정본 PDF (11/25 전체 점검) — 버튼은 S2 available_actions 그대로,
// "만드는 중" 안내는 작업 추적기가 READY 를 보면 내리고, 저장 파일명은 서버 Content-Disposition 을 따라요.
// MSW 시드: 케이스 1003(DRF-000098)이 승인 완료, inv01 담당, apr01 이 승인.
const investigator = { id: 1, login_id: "inv01", role: "INVESTIGATOR", display_name: "담당 조사역" }
const approver = { id: 3, login_id: "apr01", role: "APPROVER", display_name: "승인자" }
const CASE_NO = "CASE-2022-001003"
const DRAFT_NO = "DRF-000098"
const DONE_PATH = `/approvals/${DRAFT_NO}`
const STR_PATH = `/cases/${CASE_NO}/str`
const PDF_URL = `*/api/v1/str-drafts/${DRAFT_NO}/report.pdf`
const SERVER_FILENAME = "STR-2026-000321.pdf"

function openPage(path, viewer) {
	resetCases(viewer)
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={[path]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return userEvent.setup()
}

/** 케이스·초안을 그 상태로 — S2 available_actions 는 서버가 준 것처럼 그대로 넣어요. */
function seedStatus(viewer, status, actions) {
	const item = seedCases().find((row) => row.case_no === CASE_NO)
	item.status = status
	const raw = seedStrDrafts().find((row) => row.draft_no === DRAFT_NO)
	const draft = { ...visibleStrDraft(viewer, raw, item), available_actions: actions }
	server.use(
		http.get(`*/api/v1/cases/${CASE_NO}`, () =>
			HttpResponse.json(detailResponse(viewer, item)),
		),
		http.get(`*/api/v1/str-drafts/${DRAFT_NO}`, () => HttpResponse.json(draft)),
	)
}

function pdfResponse(status, { filename = SERVER_FILENAME } = {}) {
	if (status === "READY")
		return new HttpResponse("%PDF-1.4 fixture", {
			headers: {
				"Content-Type": "application/pdf",
				...(filename ? { "Content-Disposition": `inline; filename="${filename}"` } : {}),
			},
		})
	return HttpResponse.json(
		{
			error: {
				code: "REPORT_PDF_NOT_READY",
				message: "fixture",
				details: { pdf_status: status },
			},
		},
		{ status: 409 },
	)
}

const pdfJob = () => readJobs("apr01").find((job) => job.id === DRAFT_NO)
const donePanel = () => within(screen.getByRole("region", { name: "승인 완료 보고서" }))

const saved = []
beforeEach(() => {
	sessionStorage.clear()
	saved.length = 0
	// jsdom 에는 blob URL·파일 저장이 없어요 — 저장하려던 이름만 모아요.
	URL.createObjectURL = vi.fn(() => "blob:mock-pdf")
	URL.revokeObjectURL = vi.fn()
	vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
		saved.push(this.download)
	})
})
afterEach(() => vi.restoreAllMocks())

describe("승인 완료 — [PDF 다시 만들기]는 서버 REGENERATE_PDF 그대로", () => {
	it.each([
		["PENDING", true],
		["FAILED", false],
		["FAILED", true],
		["PENDING", false],
	])("확정본 %s · 서버 복구 허용 %s", async (pdfStatus, mayRegenerate) => {
		seedStatus(
			approver,
			"REPORTED",
			mayRegenerate ? ["DOWNLOAD_PDF", "REGENERATE_PDF"] : ["DOWNLOAD_PDF"],
		)
		server.use(http.get(PDF_URL, () => pdfResponse(pdfStatus)))
		const user = openPage(DONE_PATH, approver)
		await user.click(await screen.findByRole("button", { name: "확정본 PDF 받기" }))
		await screen.findByText(
			pdfStatus === "FAILED" ? /PDF를 만들지 못했어요/ : /PDF를 만드는 중이에요/,
		)
		const button = screen.queryByRole("button", { name: "PDF 다시 만들기" })
		if (mayRegenerate) expect(button).toBeInTheDocument()
		else expect(button).not.toBeInTheDocument()
	})

	// 실패 안내의 뒷문장은 버튼이 보일 때만 — 두 문장이 다 보이면 글자는 전과 한 글자도 같아요.
	it.each([
		[false, "PDF를 만들지 못했어요."],
		[true, "PDF를 만들지 못했어요. [PDF 다시 만들기]를 눌러 주세요."],
	])("확정본 FAILED · 서버 복구 허용 %s → 안내 글자", async (mayRegenerate, text) => {
		seedStatus(
			approver,
			"REPORTED",
			mayRegenerate ? ["DOWNLOAD_PDF", "REGENERATE_PDF"] : ["DOWNLOAD_PDF"],
		)
		server.use(http.get(PDF_URL, () => pdfResponse("FAILED")))
		const user = openPage(DONE_PATH, approver)
		await user.click(await screen.findByRole("button", { name: "확정본 PDF 받기" }))
		const alert = await donePanel().findByText(/PDF를 만들지 못했어요/)
		expect(alert.textContent).toBe(text)
	})
})

describe("승인 완료 — 추적기가 READY 면 '만드는 중' 안내를 내린다", () => {
	it("다시 만들기(202) 뒤 추적기가 READY 를 보면 '다시 만들고 있어요'가 사라진다", async () => {
		seedStatus(approver, "REPORTED", ["DOWNLOAD_PDF", "REGENERATE_PDF"])
		let pdfStatus = "FAILED"
		server.use(
			http.get(PDF_URL, () => pdfResponse(pdfStatus)),
			http.post(`*/api/v1/approvals/${DRAFT_NO}/report/pdf`, () => {
				pdfStatus = "READY"
				return HttpResponse.json({ pdf_status: "PENDING" }, { status: 202 })
			}),
		)
		const user = openPage(DONE_PATH, approver)
		await user.click(await screen.findByRole("button", { name: "확정본 PDF 받기" }))
		await user.click(await screen.findByRole("button", { name: "PDF 다시 만들기" }))
		await waitFor(() => expect(pdfJob()?.state).toBe("DONE"))
		await waitFor(() =>
			expect(donePanel().queryByText(/PDF를 다시 만들고 있어요/)).not.toBeInTheDocument(),
		)
		await user.click(screen.getByLabelText(/^알림(,|$)/))
		expect(
			within(screen.getByRole("region", { name: "알림 목록" })).getByText(
				"확정본 PDF가 준비됐어요",
			),
		).toBeVisible()
	})

	it("수동 받기가 PENDING 이었어도 다음 자동 조회가 READY 면 '만드는 중'이 사라진다", async () => {
		let ready = false
		server.use(http.get(PDF_URL, () => pdfResponse(ready ? "READY" : "PENDING")))
		const user = openPage(DONE_PATH, approver)
		await user.click(await screen.findByRole("button", { name: "모의 제출" }))
		await user.click(
			within(await screen.findByRole("dialog", { name: "모의 제출" })).getByRole("button", {
				name: "모의 제출",
			}),
		)
		await user.click(await screen.findByRole("button", { name: "확정본 PDF 받기" }))
		expect(await screen.findByText(/PDF를 만드는 중이에요/)).toBeInTheDocument()
		ready = true
		await waitFor(() => expect(pdfJob()?.state).toBe("DONE"), { timeout: 5000 })
		await waitFor(() =>
			expect(donePanel().queryByText(/PDF를 만드는 중이에요/)).not.toBeInTheDocument(),
		)
		// 버튼은 그대로라 다시 누르면 받을 수 있어요
		expect(screen.getByRole("button", { name: "확정본 PDF 받기" })).toBeEnabled()
	}, 8000)

	it("추적기가 아직 진행 중이면 '만드는 중' 안내는 남는다", async () => {
		seedStatus(approver, "REPORTED", ["DOWNLOAD_PDF"])
		server.use(http.get(PDF_URL, () => pdfResponse("PENDING")))
		const user = openPage(DONE_PATH, approver)
		await user.click(await screen.findByRole("button", { name: "확정본 PDF 받기" }))
		expect(await screen.findByText(/PDF를 만드는 중이에요/)).toBeInTheDocument()
		expect(pdfJob()?.state ?? "NONE").not.toBe("DONE")
	})
})

describe("확정본 PDF 저장 파일명 — 서버 Content-Disposition", () => {
	it("승인 완료 화면: 헤더가 있으면 서버 파일명으로 저장한다", async () => {
		seedStatus(approver, "REPORTED", ["DOWNLOAD_PDF"])
		server.use(http.get(PDF_URL, () => pdfResponse("READY")))
		const user = openPage(DONE_PATH, approver)
		await user.click(await screen.findByRole("button", { name: "확정본 PDF 받기" }))
		await waitFor(() => expect(saved).toEqual([SERVER_FILENAME]))
	})

	it("승인 완료 화면: 헤더가 없으면 지금 이름(초안 번호)으로 저장한다", async () => {
		seedStatus(approver, "REPORTED", ["DOWNLOAD_PDF"])
		server.use(http.get(PDF_URL, () => pdfResponse("READY", { filename: null })))
		const user = openPage(DONE_PATH, approver)
		await user.click(await screen.findByRole("button", { name: "확정본 PDF 받기" }))
		await waitFor(() => expect(saved).toEqual([`${DRAFT_NO}.pdf`]))
	})

	it("STR 화면: 담당 조사역도 서버 파일명으로 저장한다", async () => {
		seedStatus(investigator, "REPORTED", ["DOWNLOAD_PDF"])
		server.use(http.get(PDF_URL, () => pdfResponse("READY")))
		const user = openPage(STR_PATH, investigator)
		const region = await screen.findByRole("region", { name: "보고서 PDF" })
		await user.click(within(region).getByRole("button", { name: "확정본 PDF 받기" }))
		await waitFor(() => expect(saved).toEqual([SERVER_FILENAME]))
	})
})
