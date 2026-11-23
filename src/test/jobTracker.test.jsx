import { afterEach, describe, expect, it } from "vitest"
import { useEffect } from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router"
import ToastProvider from "../shared/ui/toast/ToastProvider"
import JobsProvider from "../shared/jobs/JobsProvider"
import { useJobs } from "../shared/jobs/useJobs"
import { STALE_MS, storageKey } from "../shared/jobs/jobStore"

// 작업 추적기(SCRUM-365, 설계 7.2·7.6·8.2·9) — 가짜 종류로 추적기만. 실제 종류 판정은 jobKinds.test.
// 서버 상태는 states[id] 로 바꿔요: "RUNNING" · "DONE" · "FAILED" · 404 · 오래전에 끝남("OLD").
const states = {}
const httpError = (status) => Object.assign(new Error(String(status)), { response: { status } })
const kinds = {
	FAKE: {
		intervalMs: 20,
		queryKey: (job) => ["fake", job.id],
		fetch: async (job) => {
			const state = states[job.id]
			if (typeof state === "number") throw httpError(state)
			return state
		},
		evaluate: (job, state) => {
			if (state === "DONE")
				return {
					state: "DONE",
					tone: "info",
					text: `${job.label} 끝`,
					finishedAt: new Date().toISOString(),
				}
			if (state === "OLD")
				return {
					state: "DONE",
					tone: "info",
					text: `${job.label} 끝`,
					finishedAt: "2020-01-01T00:00:00Z",
				}
			if (state === "FAILED")
				return { state: "FAILED", tone: "error", text: `${job.label} 실패` }
			return { state: "TRACKING" }
		},
	},
}

const holder = { current: null }
function Grab() {
	const jobs = useJobs()
	useEffect(() => {
		holder.current = jobs
	})
	return null
}
function show({ loginId = "admin", path = "/home" } = {}) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const view = (id) => (
		<QueryClientProvider client={client}>
			<MemoryRouter initialEntries={[path]}>
				<ToastProvider>
					<JobsProvider loginId={id} kinds={kinds}>
						<Grab />
						<Routes>
							<Route path="/home" element={<p>홈</p>} />
							<Route path="/batches" element={<p>배치 화면</p>} />
						</Routes>
					</JobsProvider>
				</ToastProvider>
			</MemoryRouter>
		</QueryClientProvider>
	)
	const utils = render(view(loginId))
	return { rerenderAs: (id) => utils.rerender(view(id)) }
}
const track = (id, extra = {}) =>
	act(() =>
		holder.current.track({ kind: "FAKE", id, label: `작업${id}`, to: "/batches", ...extra }),
	)
const jobOf = (id) => holder.current.jobs.find((job) => job.id === id)

afterEach(() => {
	sessionStorage.clear()
	Object.keys(states).forEach((key) => delete states[key])
})

describe("작업 추적기", () => {
	it("진행 중이다가 끝나면 다른 화면에서 토스트와 [결과 보기] — 누르면 결과 화면으로", async () => {
		states.a = "RUNNING"
		show()
		track("a")
		expect(holder.current.running).toBe(1)
		states.a = "DONE"
		const toast = await screen.findByRole("status")
		expect(toast).toHaveTextContent("작업a 끝")
		// holder 는 Grab 의 effect 에서 바뀌어서, 토스트가 그려진 직후엔 아직 이전 값일 수 있어요(CI에서 가끔 실패) — 기다려서 봐요.
		await waitFor(() => expect(jobOf("a")).toMatchObject({ state: "DONE", seen: false }))
		expect(holder.current.unseen).toBe(1)
		await userEvent.setup().click(screen.getByRole("button", { name: "결과 보기" }))
		expect(screen.getByText("배치 화면")).toBeInTheDocument()
		act(() => holder.current.markSeen())
		expect(holder.current.unseen).toBe(0)
	})

	it("그 작업 화면에 있으면 토스트 없이 끝남만 기록한다", async () => {
		states.b = "DONE"
		show({ path: "/batches" })
		track("b")
		await waitFor(() => expect(jobOf("b").state).toBe("DONE"))
		expect(document.querySelector(".toast")).toBeNull()
	})

	it("실패는 닫을 때까지 남는 토스트, 404는 확인할 수 없음(토스트 없음)", async () => {
		states.c = "FAILED"
		states.d = 404
		show()
		track("c")
		track("d")
		expect(await screen.findByRole("alert")).toHaveTextContent("작업c 실패")
		expect(screen.getByRole("button", { name: "알림 닫기" })).toBeInTheDocument()
		await waitFor(() => expect(jobOf("d")).toMatchObject({ state: "LOST" }))
		expect(jobOf("d").text).toBe("작업d · 확인할 수 없어요")
		expect(document.querySelectorAll(".toast")).toHaveLength(1)
	})

	it("복구했는데 10분이 지나도 진행 중이면 확인 필요 → [다시 확인]으로 다시 추적", async () => {
		states.e = "RUNNING"
		const old = new Date(Date.now() - STALE_MS - 1000).toISOString()
		sessionStorage.setItem(
			storageKey("admin"),
			JSON.stringify([
				{
					kind: "FAKE",
					id: "e",
					label: "작업e",
					to: "/batches",
					state: "TRACKING",
					trackedAt: old,
					seen: true,
				},
			]),
		)
		show()
		await waitFor(() => expect(jobOf("e").state).toBe("STALE"))
		expect(holder.current.running).toBe(1)
		states.e = "DONE"
		act(() => holder.current.recheck(jobOf("e")))
		expect(await screen.findByRole("status")).toHaveTextContent("작업e 끝")
	})

	it("복구했는데 끝난 지 1분이 넘은 결과는 토스트 없이 목록에만", async () => {
		states.f = "OLD"
		sessionStorage.setItem(
			storageKey("admin"),
			JSON.stringify([
				{
					kind: "FAKE",
					id: "f",
					label: "작업f",
					to: "/batches",
					state: "TRACKING",
					trackedAt: new Date().toISOString(),
					seen: true,
				},
			]),
		)
		show()
		await waitFor(() => expect(jobOf("f").state).toBe("DONE"))
		expect(document.querySelector(".toast")).toBeNull()
	})

	it("실패로 끝난 작업을 같은 번호로 다시 등록하면 캐시에 남은 예전 결과로 끝나지 않고 새로 추적한다", async () => {
		// PDF 다시 만들기처럼 같은 종류·번호로 다시 등록(#96 리뷰)
		states.h = "FAILED"
		show()
		track("h")
		await waitFor(() => expect(jobOf("h").state).toBe("FAILED"))
		states.h = "RUNNING"
		track("h")
		expect(jobOf("h").state).toBe("TRACKING")
		await new Promise((resolve) => setTimeout(resolve, 80))
		expect(jobOf("h").state).toBe("TRACKING")
		states.h = "DONE"
		await waitFor(() => expect(jobOf("h").state).toBe("DONE"))
		expect(screen.getByRole("status")).toHaveTextContent("작업h 끝")
	})

	it("같은 작업은 한 번만 등록하고, 로그아웃하면 저장값을 지운다", async () => {
		states.g = "RUNNING"
		const { rerenderAs } = show()
		track("g")
		expect(
			holder.current.track({ kind: "FAKE", id: "g", label: "작업g", to: "/batches" }),
		).toBe(false)
		await waitFor(() => expect(sessionStorage.getItem(storageKey("admin"))).toContain('"g"'))
		rerenderAs(null)
		expect(sessionStorage.getItem(storageKey("admin"))).toBeNull()
		expect(holder.current.jobs).toEqual([])
	})
})
