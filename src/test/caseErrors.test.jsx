import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { detailResponse, seedCases } from "../mocks/cases"
import { AI_REQUEST_TIMEOUT_MS, apiClient } from "../shared/api/apiClient"
import { server } from "../mocks/server"

// 케이스 화면 오류 표시 점검 (SCRUM-200, 계약서 3절). 오류 코드마다 MSW 로 한 번씩 띄워
// 어디에(그 칸·그 확인창) 무슨 문구가 나오는지, 입력이 남는지, 다른 동작이 막히지 않는지 본다.
const USERS = {
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}
const REVIEWING = "CASE-2022-001004"
const DRAFTED = "CASE-2022-001001" // 요약이 있는 케이스(입력 변경됨)
const OPEN = "CASE-2022-001002"

function renderApp(path, who = "inv01") {
	resetCases(USERS[who])
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={[path]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return userEvent.setup()
}

const fail = (status, code, message, details = {}) =>
	HttpResponse.json({ error: { code, message, details } }, { status })

function countDetail(caseNo) {
	const counter = { n: 0 }
	server.events.on("request:start", ({ request }) => {
		const url = new URL(request.url)
		if (request.method === "GET" && url.pathname === `/api/v1/cases/${caseNo}`) counter.n += 1
	})
	return counter
}

describe("403 — 역할 권한 없음·담당 아님", () => {
	it("FORBIDDEN 은 서버 문구 대신 '실행 권한이 없어요' — 담당자 변경 확인창 안에", async () => {
		server.use(
			http.post(`*/api/v1/cases/${REVIEWING}/reassign`, () =>
				fail(403, "FORBIDDEN", "권한이 없습니다"),
			),
		)
		const user = renderApp(`/cases/${REVIEWING}`, "admin")
		await user.click(await screen.findByRole("button", { name: "담당자 변경" }))
		const dialog = await screen.findByRole("dialog", { name: "담당자 변경" })
		await user.selectOptions(await within(dialog).findByLabelText("새 담당 조사역"), "inv02")
		await user.click(within(dialog).getByRole("button", { name: "변경" }))
		expect(await within(dialog).findByRole("alert")).toHaveTextContent("실행 권한이 없어요.")
		expect(within(dialog).getByRole("alert")).not.toHaveTextContent("권한이 없습니다")
	})
	it("NOT_ASSIGNEE 는 '담당자만 할 수 있어요' + 상세를 다시 불러 버튼을 맞추고, 입력은 남긴다", async () => {
		server.use(
			http.post(`*/api/v1/cases/${REVIEWING}/escalate`, () =>
				fail(403, "NOT_ASSIGNEE", "담당 조사역만 할 수 있습니다"),
			),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		await user.click(await screen.findByRole("button", { name: "에스컬레이션" }))
		const counter = countDetail(REVIEWING)
		await user.type(screen.getByLabelText("에스컬레이션 사유"), "STR 검토 필요")
		await user.click(screen.getByRole("button", { name: "에스컬레이션 실행" }))
		expect(await screen.findByText(/담당자만 할 수 있어요/)).toBeInTheDocument()
		await waitFor(() => expect(counter.n).toBeGreaterThan(0))
		expect(screen.getByLabelText("에스컬레이션 사유")).toHaveValue("STR 검토 필요")
		server.events.removeAllListeners()
	})
	it("조회 칸이 403 이어도 그 칸에만 안내하고 상세의 다른 칸은 그대로", async () => {
		server.use(
			http.get(`*/api/v1/cases/${REVIEWING}/graph`, () =>
				fail(403, "FORBIDDEN", "권한이 없습니다"),
			),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		const graph = await screen.findByRole("region", { name: "자금 흐름 그래프" })
		expect(await within(graph).findByRole("alert")).toHaveTextContent("실행 권한이 없어요.")
		await user.click(screen.getByRole("button", { name: "근거 거래" }))
		expect(await screen.findByRole("region", { name: "근거 거래" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "에스컬레이션" })).toBeEnabled()
	})
})

describe("409 — 버전 충돌·배정 대상", () => {
	it("CONCURRENT_UPDATE 면 종료 입력을 남기고 최신 내용을 다시 불러 확인하게 한다", async () => {
		server.use(
			http.post(`*/api/v1/cases/${REVIEWING}/close`, () =>
				fail(409, "CONCURRENT_UPDATE", "다른 요청이 먼저 케이스를 변경했습니다", {
					expected_version: 1,
					current_version: 2,
				}),
			),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		await user.click(await screen.findByRole("button", { name: "종료" }))
		const counter = countDetail(REVIEWING)
		await user.click(screen.getByRole("radio", { name: "오탐" }))
		await user.type(screen.getByLabelText("종료 설명"), "정상 거래 확인")
		await user.click(screen.getByRole("button", { name: "종료 실행" }))
		expect(
			await screen.findByText(/다른 사용자가 먼저 변경했습니다. 작성 내용은 유지됩니다/),
		).toBeInTheDocument()
		await waitFor(() => expect(counter.n).toBeGreaterThan(0))
		expect(screen.getByLabelText("종료 설명")).toHaveValue("정상 거래 확인")
		expect(screen.getByRole("radio", { name: "오탐" })).toBeChecked()
		server.events.removeAllListeners()
	})
	it("관리자 배정의 INVALID_ASSIGNEE 는 확인창 안에 안내하고, 고른 값을 비우고 조사역 목록을 다시 부른다 (SCRUM-428)", async () => {
		let lists = 0
		server.events.on("request:start", ({ request }) => {
			if (new URL(request.url).pathname === "/api/v1/admin/users") lists += 1
		})
		server.use(
			http.post(`*/api/v1/cases/${OPEN}/assign`, () =>
				fail(409, "INVALID_ASSIGNEE", "활성 조사역에게만 배정할 수 있습니다", {
					reason: "NOT_ACTIVE_INVESTIGATOR",
				}),
			),
		)
		const user = renderApp(`/cases/${OPEN}`, "admin")
		await user.click(await screen.findByRole("button", { name: "담당자 배정" }))
		const dialog = await screen.findByRole("dialog", { name: "담당자 배정" })
		const select = await within(dialog).findByLabelText("배정할 조사역")
		await user.selectOptions(select, "inv01")
		await user.click(within(dialog).getByRole("button", { name: "배정" }))
		expect(await within(dialog).findByRole("alert")).toHaveTextContent(
			"활성 조사역에게만 맡길 수 있어요",
		)
		expect(select).toHaveValue("")
		await waitFor(() => expect(lists).toBe(2))
		server.events.removeAllListeners()
	})
	it("담당자 변경의 INVALID_ASSIGNEE 는 확인창 안에 안내하고 조사역 목록을 다시 부른다", async () => {
		let lists = 0
		server.events.on("request:start", ({ request }) => {
			if (new URL(request.url).pathname === "/api/v1/admin/users") lists += 1
		})
		server.use(
			http.post(`*/api/v1/cases/${REVIEWING}/reassign`, () =>
				fail(409, "INVALID_ASSIGNEE", "활성 조사역에게만 배정할 수 있습니다"),
			),
		)
		const user = renderApp(`/cases/${REVIEWING}`, "admin")
		await user.click(await screen.findByRole("button", { name: "담당자 변경" }))
		const dialog = await screen.findByRole("dialog", { name: "담당자 변경" })
		await user.selectOptions(await within(dialog).findByLabelText("새 담당 조사역"), "inv02")
		await user.click(within(dialog).getByRole("button", { name: "변경" }))
		expect(await within(dialog).findByRole("alert")).toHaveTextContent(
			"활성 조사역에게만 맡길 수 있어요",
		)
		await waitFor(() => expect(lists).toBe(2))
		server.events.removeAllListeners()
	})
})

describe("502 — AI 요약 실패는 요약 칸에만", () => {
	it("SUMMARY_CODE_CHECK_FAILED 면 요약 칸에만 안내, 기존 요약은 '이전에 만든 요약', 다른 동작은 그대로", async () => {
		server.use(
			http.post(`*/api/v1/cases/${DRAFTED}/refresh-summary`, () =>
				fail(502, "SUMMARY_CODE_CHECK_FAILED", "코드 검사 실패", {
					failed_checks: ["AMOUNT_MATCH"],
				}),
			),
		)
		const user = renderApp(`/cases/${DRAFTED}`)
		const panel = await screen.findByRole("region", { name: "AI 요약" })
		await user.click(within(panel).getByRole("button", { name: "요약 갱신" }))
		expect(await within(panel).findByRole("alert")).toHaveTextContent(
			"AI 요약이 원본 데이터 검사를 통과하지 못해 저장하지 않았어요",
		)
		expect(within(panel).getByRole("group", { name: "이전에 만든 요약" })).toBeInTheDocument()
		expect(within(panel).getByText(/24시간 동안 12개 계좌/)).toBeInTheDocument()
		// 칸 밖에는 오류가 없고, 메모·종료는 그대로 쓸 수 있다
		const outside = screen.getAllByRole("alert").filter((node) => !panel.contains(node))
		expect(outside).toHaveLength(0)
		await user.click(screen.getByRole("button", { name: "조사 메모" }))
		expect(screen.getByRole("button", { name: "메모 저장" })).toBeEnabled()
		expect(screen.getByRole("button", { name: "종료" })).toBeEnabled()
	})
	it("AI_TIMEOUT 같은 연동 실패도 요약 칸에만, 다시 누를 수 있다", async () => {
		server.use(
			http.post(`*/api/v1/cases/${DRAFTED}/refresh-summary`, () =>
				fail(502, "AI_TIMEOUT", "AI 응답이 늦어 처리하지 못했습니다"),
			),
		)
		const user = renderApp(`/cases/${DRAFTED}`)
		const panel = await screen.findByRole("region", { name: "AI 요약" })
		await user.click(within(panel).getByRole("button", { name: "요약 갱신" }))
		expect(await within(panel).findByRole("alert")).toHaveTextContent("AI 응답이 늦어")
		expect(within(panel).getByRole("button", { name: "요약 갱신" })).toBeEnabled()
	})
})

describe("응답 없음 — AI 요약 갱신 (SCRUM-315, 계약서 2.6)", () => {
	it("요약 갱신은 AI 전용 timeout(100초)으로 보낸다 — 기본 15초가 아님", async () => {
		const posted = vi.spyOn(apiClient, "post")
		const user = renderApp(`/cases/${DRAFTED}`)
		const panel = await screen.findByRole("region", { name: "AI 요약" })
		await user.click(within(panel).getByRole("button", { name: "요약 갱신" }))
		await waitFor(() =>
			expect(posted).toHaveBeenCalledWith(
				`/api/v1/cases/${DRAFTED}/refresh-summary`,
				expect.anything(),
				{ timeout: AI_REQUEST_TIMEOUT_MS },
			),
		)
		posted.mockRestore()
	})
	it("응답 없이 끊겨도 다시 불러온 요약이 새것이면 실패로 띄우지 않는다", async () => {
		let posted = false
		server.use(
			http.post(`*/api/v1/cases/${DRAFTED}/refresh-summary`, () => {
				posted = true
				return HttpResponse.error()
			}),
			// 서버에는 저장된 상황 — POST 뒤 상세가 새 요약(produced_at 바뀜)을 준다
			http.get(`*/api/v1/cases/${DRAFTED}`, () => {
				if (!posted) return undefined
				const item = seedCases().find((entry) => entry.case_no === DRAFTED)
				item.latest_summary = {
					...item.latest_summary,
					summary_lines: ["(예시) 끊긴 뒤 저장된 새 요약"],
					produced_at: "2026-11-19T09:00:00Z",
					is_current: true,
				}
				return HttpResponse.json(detailResponse(USERS.inv01, item))
			}),
		)
		const user = renderApp(`/cases/${DRAFTED}`)
		const panel = await screen.findByRole("region", { name: "AI 요약" })
		await user.click(within(panel).getByRole("button", { name: "요약 갱신" }))
		expect(await within(panel).findByText("(예시) 끊긴 뒤 저장된 새 요약")).toBeInTheDocument()
		expect(within(panel).queryByRole("alert")).not.toBeInTheDocument()
		expect(within(panel).getByRole("group", { name: "현재 요약" })).toBeInTheDocument()
	})
	it("끊긴 뒤 상세를 다시 불러오는 동안은 실패 안내 대신 '결과 확인 중'을 보여 준다", async () => {
		let posted = false
		let release
		const held = new Promise((resolve) => (release = resolve))
		server.use(
			http.post(`*/api/v1/cases/${DRAFTED}/refresh-summary`, () => {
				posted = true
				return HttpResponse.error()
			}),
			// POST 뒤 상세 재조회를 붙잡아 두고, 풀면 새 요약(실제로 저장된 경우)을 준다
			http.get(`*/api/v1/cases/${DRAFTED}`, async () => {
				if (!posted) return undefined
				await held
				const item = seedCases().find((entry) => entry.case_no === DRAFTED)
				item.latest_summary = {
					...item.latest_summary,
					summary_lines: ["(예시) 끊긴 뒤 저장된 새 요약"],
					produced_at: "2026-11-19T09:00:00Z",
					is_current: true,
				}
				return HttpResponse.json(detailResponse(USERS.inv01, item))
			}),
		)
		const user = renderApp(`/cases/${DRAFTED}`)
		const panel = await screen.findByRole("region", { name: "AI 요약" })
		await user.click(within(panel).getByRole("button", { name: "요약 갱신" }))
		expect(await within(panel).findByRole("status")).toHaveTextContent("결과를 확인하는 중")
		expect(within(panel).queryByRole("alert")).not.toBeInTheDocument()
		release()
		expect(await within(panel).findByText("(예시) 끊긴 뒤 저장된 새 요약")).toBeInTheDocument()
		expect(within(panel).queryByRole("status")).not.toBeInTheDocument()
		expect(within(panel).queryByRole("alert")).not.toBeInTheDocument()
	})
	it("응답 없이 끊기고 요약도 그대로면 '응답을 확인하지 못했다'고 안내하고 상세를 다시 읽는다", async () => {
		server.use(
			http.post(`*/api/v1/cases/${DRAFTED}/refresh-summary`, () => HttpResponse.error()),
		)
		const details = countDetail(DRAFTED)
		const user = renderApp(`/cases/${DRAFTED}`)
		const panel = await screen.findByRole("region", { name: "AI 요약" })
		await waitFor(() => expect(details.n).toBe(1))
		await user.click(within(panel).getByRole("button", { name: "요약 갱신" }))
		expect(await within(panel).findByRole("alert")).toHaveTextContent(
			"서버 응답을 확인하지 못했습니다",
		)
		await waitFor(() => expect(details.n).toBe(2))
		expect(within(panel).getByRole("group", { name: "이전에 만든 요약" })).toBeInTheDocument()
		expect(within(panel).getByRole("button", { name: "요약 갱신" })).toBeEnabled()
		server.events.removeAllListeners()
	})
})

describe("404 — 대상 없음", () => {
	it("없는 케이스 상세는 안내와 목록으로 가는 길을 준다", async () => {
		renderApp("/cases/CASE-2099-999999")
		expect(await screen.findByRole("alert")).toHaveTextContent("케이스가 없습니다")
		expect(screen.getByRole("link", { name: "← 케이스 목록" })).toHaveAttribute(
			"href",
			"/cases",
		)
	})
})
