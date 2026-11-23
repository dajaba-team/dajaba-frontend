import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import NotificationBell from "../features/notifications/components/NotificationBell"
import ToastProvider from "../shared/ui/toast/ToastProvider"
import { JobsContext } from "../shared/jobs/JobsContext"
import { resetCases } from "../mocks/handlers"

// 알림 종에 작업 알림 합치기(SCRUM-365, 설계 7.5) — 추적기 값은 가짜로. 업무 알림은 MSW(관리자는 빈 목록).
const admin = { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" }
const at = "2026-11-23T03:00:00Z"
const jobs = [
	{
		kind: "ANALYSIS",
		id: "12",
		label: "분석 일괄 실행 · 2022-09-08",
		to: "/admin/batches",
		state: "TRACKING",
		trackedAt: at,
		seen: true,
	},
	{
		kind: "LOAD_DATASET",
		id: "1",
		label: "원천 적재",
		to: "/admin/batches",
		state: "STALE",
		trackedAt: at,
		seen: true,
	},
	{
		kind: "REPORT_PDF",
		id: "DRF-000001",
		label: "확정본 PDF · DRF-000001",
		to: "/approvals/DRF-000001",
		state: "FAILED",
		text: "확정본 PDF를 만들지 못했어요",
		trackedAt: at,
		finishedAt: at,
		seen: false,
	},
]

function show(value) {
	resetCases(admin)
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<MemoryRouter>
				<ToastProvider>
					<JobsContext.Provider value={value}>
						<NotificationBell loginId="admin" />
					</JobsContext.Provider>
				</ToastProvider>
			</MemoryRouter>
		</QueryClientProvider>,
	)
}

beforeEach(() => localStorage.clear())

describe("알림 종 — 작업 알림", () => {
	it("안 본 작업 수를 숫자에 더하고, 진행 중이면 이름표에 알려 주며, 열면 본 것으로 친다", async () => {
		const value = {
			jobs,
			track: vi.fn(),
			recheck: vi.fn(),
			markSeen: vi.fn(),
			running: 2,
			unseen: 1,
		}
		show(value)
		const summary = await screen.findByLabelText("알림, 새 알림 1건, 작업 2개 진행 중")
		expect(document.querySelector(".notification-running")).not.toBeNull()

		await userEvent.setup().click(summary)
		expect(value.markSeen).toHaveBeenCalled()
		const panel = screen.getByRole("region", { name: "알림 목록" })
		expect(
			within(panel).getByText("작업", { selector: ".notification-panel-head" }),
		).toBeInTheDocument()
		const rows = panel.querySelectorAll(".notification-job")
		expect([...rows].map((row) => row.querySelector(".notification-text").textContent)).toEqual(
			[
				"분석 일괄 실행 · 2022-09-08 · 진행 중",
				"원천 적재 · 아직 진행 중이에요(확인 필요)",
				"확정본 PDF를 만들지 못했어요",
			],
		)
		expect(within(rows[2]).getByRole("link")).toHaveAttribute("href", "/approvals/DRF-000001")
	})

	it("확인 필요 줄의 [다시 확인]은 그 작업을 다시 추적한다", async () => {
		const value = {
			jobs,
			track: vi.fn(),
			recheck: vi.fn(),
			markSeen: vi.fn(),
			running: 2,
			unseen: 0,
		}
		show(value)
		const user = userEvent.setup()
		await user.click(await screen.findByLabelText("알림, 작업 2개 진행 중"))
		await user.click(screen.getByRole("button", { name: "다시 확인" }))
		expect(value.recheck).toHaveBeenCalledWith(jobs[1])
	})

	it("작업이 없으면 작업 칸도 진행 표시도 없다", async () => {
		show({
			jobs: [],
			track: vi.fn(),
			recheck: vi.fn(),
			markSeen: vi.fn(),
			running: 0,
			unseen: 0,
		})
		await screen.findByLabelText("알림")
		expect(document.querySelector(".notification-running")).toBeNull()
		expect(document.querySelector(".notification-job")).toBeNull()
	})
})
