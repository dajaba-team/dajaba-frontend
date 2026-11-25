import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"

// 탭 복귀(포커스) 재조회 (11/25 전체 점검) — 서버가 열람 기록을 남기는 조회(케이스 상세 C2·STR 초안 S2·
// 수정 이력 S4·거래 원본 C4)는 탭으로 돌아와도 다시 부르지 않아요. 그 밖(알림·케이스 목록·근거 거래)은 전역 기본값대로 다시 불러요.
const inv = { id: 1, login_id: "inv01", role: "INVESTIGATOR", display_name: "담당 조사역" }

let counts
let visibility
let offset
beforeEach(() => {
	sessionStorage.clear()
	counts = {}
	visibility = "visible"
	offset = 0
	vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility)
	// 조회 기본 staleTime(30초)이 지난 것처럼 — 실제로 기다리지 않고 시계만 옮겨요.
	const realNow = Date.now.bind(Date)
	vi.spyOn(Date, "now").mockImplementation(() => realNow() + offset)
})
afterEach(() => {
	server.events.removeAllListeners()
	vi.restoreAllMocks()
})

/** 요청 경로(쿼리 문자열 포함)를 이름으로 세요. */
function countRequests(names) {
	server.events.on("response:mocked", ({ request }) => {
		const url = new URL(request.url)
		const key = names[url.pathname + url.search] ?? names[url.pathname]
		if (key) counts[key] = (counts[key] ?? 0) + 1
	})
}

function openPage(path) {
	resetCases(inv)
	const client = createQueryClient()
	render(
		<QueryClientProvider client={client}>
			<MemoryRouter initialEntries={[path]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return { client, user: userEvent.setup() }
}

/** 31초 동안 다른 탭에 있다가 돌아와요. */
async function returnToStaleTab() {
	visibility = "hidden"
	await act(async () => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })))
	offset += 31_000
	visibility = "visible"
	await act(async () => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })))
}

it("STR 화면: 오래 가려졌던 탭으로 돌아와도 케이스 상세·초안·수정 이력은 다시 부르지 않고, 알림은 다시 부른다", async () => {
	const draft = "/api/v1/str-drafts/DRF-000124"
	countRequests({
		"/api/v1/cases/CASE-2022-001001": "C2",
		[draft]: "S2",
		[`${draft}/revisions`]: "S4",
		"/api/v1/notifications": "bell",
	})
	const { client, user } = openPage("/cases/CASE-2022-001001/str")
	await user.click(await screen.findByRole("button", { name: "수정 이력" }))
	await screen.findByText("지금 저장본")
	await waitFor(() => expect(client.isFetching()).toBe(0))
	const before = { ...counts }
	expect(before).toMatchObject({ C2: 1, S2: 1, S4: 1 })

	await returnToStaleTab()
	await waitFor(() => expect(counts.bell).toBe(before.bell + 1))
	await waitFor(() => expect(client.isFetching()).toBe(0))
	expect(counts).toMatchObject({ C2: 1, S2: 1, S4: 1 })
})

it("케이스 상세: 거래 원본 창을 연 채 돌아와도 상세·원본은 다시 부르지 않고, 근거 거래 목록은 다시 부른다", async () => {
	const root = "/api/v1/cases/CASE-2022-001004"
	countRequests({ [root]: "C2", [`${root}/transactions`]: "C3", [`${root}/evidence/4721`]: "C4" })
	const { client, user } = openPage("/cases/CASE-2022-001004")
	await user.click(await screen.findByRole("button", { name: "근거 거래" }))
	const table = within(await screen.findByRole("region", { name: "근거 거래" }))
	await user.click((await table.findAllByRole("button", { name: "거래 원본" }))[0])
	const dialog = within(await screen.findByRole("dialog", { name: "거래 원본 · 4721" }))
	await dialog.findByText(/IBM AML HI-Small · 행 4721 · 합성 데이터/)
	await waitFor(() => expect(client.isFetching()).toBe(0))
	const before = { ...counts }
	expect(before).toMatchObject({ C2: 1, C4: 1 })

	await returnToStaleTab()
	await waitFor(() => expect(counts.C3).toBe(before.C3 + 1))
	await waitFor(() => expect(client.isFetching()).toBe(0))
	expect(counts).toMatchObject({ C2: 1, C4: 1 })
	expect(dialog.getByText(/IBM AML HI-Small · 행 4721 · 합성 데이터/)).toBeVisible()
})

it("케이스 목록: 오래 가려졌던 탭으로 돌아오면 목록은 다시 부른다", async () => {
	countRequests({ "/api/v1/cases": "C1" })
	const { client } = openPage("/cases")
	await screen.findByRole("link", { name: "CASE-2022-001004" })
	await waitFor(() => expect(client.isFetching()).toBe(0))
	const before = counts.C1

	await returnToStaleTab()
	await waitFor(() => expect(counts.C1).toBe(before + 1))
})
