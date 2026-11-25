import { describe, expect, it } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { sessionKey } from "../features/auth/hooks/useSession"
import { MOCK_PASSWORD, resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"

const USERS = {
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}

function renderApp(path = "/cases", authenticated = true, who = "inv01") {
	if (authenticated) resetCases(USERS[who])
	const queryClient = createQueryClient()
	render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={[path]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return Object.assign(userEvent.setup(), { queryClient })
}

const REVIEWING = "CASE-2022-001004"
// 서버 응답 모양(계약서 C2·5.3) — 테스트에서 응답을 바꿀 때 씁니다.
const detailJson = (fields = {}) => ({
	case_no: REVIEWING,
	status: "REVIEWING",
	account_ref: "ACR-0004",
	account_no: "11_****1021",
	assignee: { login_id: "inv01", display_name: "예시 inv01" },
	score: null,
	rejection_reason_code: null,
	version: 1,
	created_at: "2026-11-02T01:03:00Z",
	investigator_notes: "거래 목적 확인 필요",
	close_reason: null,
	current_draft_no: null,
	history: [],
	available_actions: ["UPDATE_NOTES", "REFRESH_SUMMARY", "ESCALATE", "CLOSE"],
	...fields,
})
const changeJson = (fields = {}) => ({
	case_no: REVIEWING,
	status: "REVIEWING",
	assignee: { login_id: "inv01", display_name: "예시 inv01" },
	rejection_reason_code: null,
	current_draft_no: null,
	version: 2,
	updated_at: "2026-11-02T02:00:00Z",
	...fields,
})

function recordBodies(suffix) {
	const bodies = []
	server.events.on("request:start", async ({ request }) => {
		if (new URL(request.url).pathname.endsWith(suffix))
			bodies.push(await request.clone().json())
	})
	return bodies
}

async function login(user, loginId, password = MOCK_PASSWORD) {
	await user.type(screen.getByLabelText("아이디"), loginId)
	await user.type(screen.getByLabelText("비밀번호"), password)
	await user.click(screen.getByRole("button", { name: "로그인" }))
}

// 로그인 뒤엔 대시보드에서 시작해요(SCRUM-428) — 왼쪽 메뉴 [조사 케이스] → 목록에서 케이스를 열어요.
async function openCase(user, caseNo) {
	const menu = await screen.findByRole("navigation", { name: "주요 메뉴" })
	await user.click(within(menu).getByRole("link", { name: "조사 케이스" }))
	await user.click(await screen.findByRole("link", { name: caseNo }))
}

describe("인증 통신", () => {
	it("현재 사용자 조회가 401이 아닌 오류면 안내와 다시 확인 버튼을 보여 준다", async () => {
		resetCases(null)
		server.use(
			http.get(
				"*/api/v1/auth/me",
				() =>
					HttpResponse.json(
						{ error: { code: "INTERNAL_ERROR", message: "서버 오류", details: {} } },
						{ status: 500 },
					),
				{ once: true },
			),
		)
		const user = renderApp("/cases", false)
		expect(await screen.findByRole("alert")).toBeInTheDocument()
		expect(screen.getByText("로그인 상태를 확인하지 못했습니다.")).toBeInTheDocument()
		expect(screen.queryByLabelText("아이디")).not.toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: "다시 확인" }))
		expect(await screen.findByLabelText("아이디")).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "다시 확인" })).not.toBeInTheDocument()
	})
	it("아이디·비밀번호를 JSON으로 보내 로그인하고 현재 사용자를 다시 조회한다", async () => {
		let body
		server.events.on("request:start", async ({ request }) => {
			if (request.url.endsWith("/api/v1/auth/login")) body = await request.clone().json()
		})
		const user = renderApp("/cases", false)
		await screen.findByText("로그인이 필요합니다.")
		await login(user, "apr01")
		expect(
			await screen.findByText("예시 apr01", { selector: ".persona-name" }),
		).toBeInTheDocument()
		expect(body).toEqual({ login_id: "apr01", password: MOCK_PASSWORD })
		server.events.removeAllListeners()
		// 사용자 메뉴에는 "현재 사용자 확인" 버튼이 없어요(SCRUM-407).
		expect(screen.queryByRole("button", { name: "현재 사용자 확인" })).not.toBeInTheDocument()
		await act(() => user.queryClient.refetchQueries({ queryKey: sessionKey }))
		expect(
			await screen.findByText("예시 apr01", { selector: ".persona-name" }),
		).toBeInTheDocument()
	})
	it("LOGIN_FAILED는 사유 없이 한 문구로 보여 주고 다시 시도할 수 있다", async () => {
		const user = renderApp("/cases", false)
		await screen.findByText("로그인이 필요합니다.")
		await login(user, "inv01", "wrong-password")
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"아이디 또는 비밀번호가 맞지 않아요.",
		)
		// 비밀번호만 지우고 아이디는 남깁니다. 세션 끊김 안내는 나오지 않습니다.
		expect(screen.getByLabelText("비밀번호")).toHaveValue("")
		expect(screen.getByLabelText("아이디")).toHaveValue("inv01")
		expect(screen.queryByText(/다른 곳에서 같은 계정으로 로그인/)).not.toBeInTheDocument()
		await user.type(screen.getByLabelText("비밀번호"), MOCK_PASSWORD)
		await user.click(screen.getByRole("button", { name: "로그인" }))
		expect(
			await screen.findByText("예시 inv01", { selector: ".persona-name" }),
		).toBeInTheDocument()
	})
	it("서버 오류도 표시하고 다시 시도할 수 있다", async () => {
		server.use(
			http.post("*/api/v1/auth/login", () => new HttpResponse(null, { status: 500 }), {
				once: true,
			}),
		)
		const user = renderApp("/cases", false)
		await screen.findByText("로그인이 필요합니다.")
		await login(user, "inv01")
		expect(await screen.findByRole("alert")).toHaveTextContent("요청을 처리하지 못했습니다.")
		await user.type(screen.getByLabelText("비밀번호"), MOCK_PASSWORD)
		await user.click(screen.getByRole("button", { name: "로그인" }))
		expect(
			await screen.findByText("예시 inv01", { selector: ".persona-name" }),
		).toBeInTheDocument()
	})
	it("다른 곳 로그인으로 세션이 끊기면 로그인 폼과 안내를 보여 준다", async () => {
		const user = renderApp("/cases/CASE-2022-001004")
		await screen.findByRole("textbox", { name: "메모 내용" })
		server.use(
			http.get("*/api/v1/auth/me", () =>
				HttpResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 }),
			),
		)
		await act(() => user.queryClient.refetchQueries({ queryKey: sessionKey }))
		expect(await screen.findByText(/다른 곳에서 같은 계정으로 로그인/)).toBeInTheDocument()
		expect(screen.getByLabelText("비밀번호")).toBeInTheDocument()
		server.resetHandlers()
		resetCases()
		await login(user, "inv01")
		await screen.findByText("예시 inv01", { selector: ".persona-name" })
		expect(screen.queryByText(/다른 곳에서 같은 계정으로 로그인/)).not.toBeInTheDocument()
	})
	it("로그아웃 버튼으로 나가면 세션 끊김 안내를 보여 주지 않는다", async () => {
		const user = renderApp("/cases")
		await screen.findByRole("button", { name: "로그아웃" })
		await user.click(screen.getByRole("button", { name: "로그아웃" }))
		await screen.findByText("로그인이 필요합니다.")
		await user.click(screen.getByRole("button", { name: "로그인" }))
		expect(screen.queryByText(/다른 곳에서 같은 계정으로 로그인/)).not.toBeInTheDocument()
	})
})

// 케이스 버전은 「케이스·경보 정보」 카드의 버전 줄에 있어요(SCRUM-369).
async function expectCaseVersion(version) {
	const info = await screen.findByRole("region", { name: "케이스·경보 정보" })
	await waitFor(() =>
		expect(within(info).getByText("버전").nextElementSibling).toHaveTextContent(version),
	)
}

describe("케이스 조사", () => {
	it("목록은 가린 계좌·상태 이름·담당자를 보여 주고 API page는 0부터 보낸다", async () => {
		let query
		server.events.on("request:start", ({ request }) => {
			const url = new URL(request.url)
			if (url.pathname === "/api/v1/cases") query = url.searchParams.toString()
		})
		renderApp()
		const link = await screen.findByRole("link", { name: REVIEWING })
		const row = link.closest("tr")
		expect(within(row).getByText("11_****1021")).toBeInTheDocument()
		expect(within(row).getByText("조사 중")).toBeInTheDocument()
		expect(within(row).getByText("예시 inv01")).toBeInTheDocument()
		const pager = screen.getByRole("navigation", { name: "페이지" })
		expect(pager).toHaveTextContent("전체 4건 · 1–4")
		expect(within(pager).getByRole("button", { name: "1 페이지" })).toHaveAttribute(
			"aria-current",
			"page",
		)
		expect(within(pager).getByRole("button", { name: "다음 페이지" })).toBeDisabled()
		expect(query).toBe("page=0&size=20")
		server.events.removeAllListeners()
	})
	it("내 담당·상태 필터를 서버 쿼리로 보내고 빈 결과를 알려 준다", async () => {
		const user = renderApp()
		await screen.findByRole("link", { name: REVIEWING })
		await user.click(screen.getByRole("checkbox", { name: "내 담당만" }))
		await waitFor(() =>
			expect(
				screen.queryByRole("link", { name: "CASE-2022-001002" }),
			).not.toBeInTheDocument(),
		)
		await user.click(
			within(screen.getByRole("group", { name: "상태" })).getByRole("checkbox", {
				name: "종료",
			}),
		)
		expect(await screen.findByText("조건에 맞는 케이스가 없습니다.")).toBeInTheDocument()
	})
	it("담당 조사역이 에스컬레이션한 뒤 사유를 골라 종료한다", async () => {
		const closeBodies = recordBodies("/close")
		const user = renderApp()
		await user.click(await screen.findByRole("link", { name: REVIEWING }))
		await user.click(await screen.findByRole("button", { name: "에스컬레이션" }))
		await user.type(screen.getByLabelText("에스컬레이션 사유"), "STR 검토 필요")
		expect(screen.getByRole("button", { name: "에스컬레이션 실행" })).not.toHaveClass(
			"is-irreversible",
		)
		await user.click(screen.getByRole("button", { name: "에스컬레이션 실행" }))
		expect(
			await screen.findByText("에스컬레이션됨", { selector: ".status-badge" }),
		).toBeInTheDocument()
		expect(screen.getByText("STR 검토 필요")).toBeInTheDocument()

		await user.click(screen.getByRole("button", { name: "종료" }))
		const submit = screen.getByRole("button", { name: "종료 실행" })
		expect(submit).toBeDisabled()
		// 되돌릴 수 없는 종료는 파란 주 버튼이 아니라 따로 표시, 진행 동작(에스컬레이션)은 그대로 (#37 리뷰)
		expect(submit).toHaveClass("is-irreversible")
		await user.click(screen.getByRole("radio", { name: "오탐" }))
		expect(submit).toBeDisabled()
		await user.type(screen.getByLabelText("종료 설명"), "동일 법인 내부 이체")
		await user.click(submit)
		expect(await screen.findByText("종료", { selector: ".status-badge" })).toBeInTheDocument()
		expect(screen.getByText("오탐")).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "종료" })).not.toBeInTheDocument()
		expect(screen.getByText("현재 케이스는 읽기 전용입니다.")).toBeInTheDocument()
		expect(closeBodies).toEqual([
			{ close_reason: "FALSE_POSITIVE", comment: "동일 법인 내부 이체", version: 2 },
		])
		server.events.removeAllListeners()
	})
	it("에스컬레이션이 충돌하면 사유를 지우지 않고 최신 상세를 다시 불러온다", async () => {
		let detailRequests = 0
		server.events.on("request:start", ({ request }) => {
			if (new URL(request.url).pathname === `/api/v1/cases/${REVIEWING}`) detailRequests += 1
		})
		server.use(
			http.post(
				"*/escalate",
				() =>
					HttpResponse.json(
						{ error: { code: "CONCURRENT_UPDATE", message: "충돌", details: {} } },
						{ status: 409 },
					),
				{ once: true },
			),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		await user.click(await screen.findByRole("button", { name: "에스컬레이션" }))
		await user.type(screen.getByLabelText("에스컬레이션 사유"), "작성 중인 사유")
		await user.click(screen.getByRole("button", { name: "에스컬레이션 실행" }))
		expect(await screen.findByRole("alert")).toHaveTextContent("다른 사용자가 먼저 변경")
		expect(screen.getByLabelText("에스컬레이션 사유")).toHaveValue("작성 중인 사유")
		await waitFor(() => expect(detailRequests).toBe(2))
		server.events.removeAllListeners()
	})
	it("다른 사람이 먼저 에스컬레이션해 그 동작이 빠지면 열린 폼을 닫는다", async () => {
		let escalatedByOther = false
		server.use(
			http.get(`*/api/v1/cases/${REVIEWING}`, () =>
				HttpResponse.json(
					escalatedByOther
						? detailJson({
								status: "ESCALATED",
								version: 2,
								available_actions: ["UPDATE_NOTES", "CLOSE"],
							})
						: detailJson(),
				),
			),
			http.post(
				"*/escalate",
				() => {
					escalatedByOther = true
					return HttpResponse.json(
						{
							error: {
								code: "INVALID_CASE_TRANSITION",
								message: "조사 중에만 에스컬레이션할 수 있습니다",
								details: {},
							},
						},
						{ status: 409 },
					)
				},
				{ once: true },
			),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		await user.click(await screen.findByRole("button", { name: "에스컬레이션" }))
		await user.type(screen.getByLabelText("에스컬레이션 사유"), "작성 중인 사유")
		await user.click(screen.getByRole("button", { name: "에스컬레이션 실행" }))
		expect(
			await screen.findByText("에스컬레이션됨", { selector: ".status-badge" }),
		).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "종료" })).toBeEnabled()
		expect(screen.queryByLabelText("에스컬레이션 사유")).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "에스컬레이션 실행" })).not.toBeInTheDocument()
	})
	it("메모 API가 아직 없으면(404 NOT_FOUND) 케이스가 없다고 하지 않고 입력을 남긴다", async () => {
		server.use(
			http.put(
				"*/notes",
				() =>
					HttpResponse.json(
						{
							error: {
								code: "NOT_FOUND",
								message: "요청한 주소가 없습니다",
								details: {},
							},
						},
						{ status: 404 },
					),
				{ once: true },
			),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		const memo = await screen.findByLabelText("메모 내용")
		await user.clear(memo)
		await user.type(memo, "새 메모")
		await user.click(screen.getByRole("button", { name: "메모 저장" }))
		expect(await screen.findByRole("alert")).toHaveTextContent("아직 서버에 없는 기능이에요")
		expect(screen.queryByText(/대상을 찾을 수 없습니다/)).not.toBeInTheDocument()
		expect(screen.getByText(REVIEWING, { exact: false })).toBeInTheDocument()
		expect(memo).toHaveValue("새 메모")
	})
	it("에스컬레이션으로 버전이 올라도 손대지 않은 메모는 충돌로 보지 않는다", async () => {
		const bodies = recordBodies("/notes")
		const user = renderApp(`/cases/${REVIEWING}`)
		await user.click(await screen.findByRole("button", { name: "에스컬레이션" }))
		await user.type(screen.getByLabelText("에스컬레이션 사유"), "STR 검토 필요")
		await user.click(screen.getByRole("button", { name: "에스컬레이션 실행" }))
		await screen.findByText("에스컬레이션됨", { selector: ".status-badge" })
		expect(screen.queryByText(/서버의 최신 메모/)).not.toBeInTheDocument()
		const memo = screen.getByRole("textbox", { name: "메모 내용" })
		await user.type(memo, " 추가")
		await user.click(screen.getByRole("button", { name: "메모 저장" }))
		expect(await screen.findByText("메모가 저장되었습니다.")).toBeInTheDocument()
		expect(bodies).toEqual([{ investigator_notes: "거래 목적 확인 필요 추가", version: 2 }])
		server.events.removeAllListeners()
	})
	it("미배정 케이스는 조사역에게 배정 버튼이 없고, 직접 부르면 403 FORBIDDEN이다 (SCRUM-339)", async () => {
		renderApp("/cases/CASE-2022-001002")
		expect(await screen.findByText("현재 케이스는 읽기 전용입니다.")).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "담당 맡기" })).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "담당자 배정" })).not.toBeInTheDocument()
		const response = await fetch("/api/v1/cases/CASE-2022-001002/assign", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ version: 0, assignee: "inv01" }),
		})
		expect(response.status).toBe(403)
		expect((await response.json()).error.code).toBe("FORBIDDEN")
	})
	it("조사역 배정 요청은 틀린 version·없는 케이스여도 409·404보다 403 FORBIDDEN이 먼저다 (BE #160)", async () => {
		renderApp("/cases/CASE-2022-001002")
		await screen.findByText("현재 케이스는 읽기 전용입니다.")
		const post = (caseNo, command, version) =>
			fetch(`/api/v1/cases/${caseNo}/${command}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ version, assignee: "inv02" }),
			})
		for (const response of [
			await post("CASE-2022-001002", "assign", 999),
			await post("CASE-NOPE", "assign", 0),
			await post(REVIEWING, "reassign", 999),
		]) {
			expect(response.status).toBe(403)
			expect((await response.json()).error.code).toBe("FORBIDDEN")
		}
	})
	it("관리자가 배정하면 조사역은 로그인해서 그 케이스에 메모를 쓸 수 있다 (SCRUM-339)", async () => {
		const user = renderApp("/cases/CASE-2022-001002", true, "admin")
		await user.click(await screen.findByRole("button", { name: "담당자 배정" }))
		const dialog = await screen.findByRole("dialog", { name: "담당자 배정" })
		await user.selectOptions(await within(dialog).findByLabelText("배정할 조사역"), "inv01")
		await user.click(within(dialog).getByRole("button", { name: "배정" }))
		expect(await screen.findByText(/담당 예시 inv01/)).toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: "로그아웃" }))
		await screen.findByText("로그인이 필요합니다.")
		await login(user, "inv01")
		// 로그아웃 뒤 다시 로그인하면 대시보드에서 시작해요(SCRUM-428) — 메뉴로 케이스를 열어요.
		await openCase(user, "CASE-2022-001002")
		expect(await screen.findByRole("textbox", { name: "메모 내용" })).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "담당자 배정" })).not.toBeInTheDocument()
	})
	it("관리자 배정은 활성 조사역 목록에서 골라요 — 아이디를 치지 않고, 승인자는 목록에 없다 (SCRUM-428)", async () => {
		const bodies = recordBodies("/assign")
		const user = renderApp("/cases/CASE-2022-001002", true, "admin")
		await user.click(await screen.findByRole("button", { name: "담당자 배정" }))
		const dialog = await screen.findByRole("dialog", { name: "담당자 배정" })
		const select = await within(dialog).findByLabelText("배정할 조사역")
		const options = within(select)
			.getAllByRole("option")
			.map((option) => option.value)
		expect(options).toEqual(["", "inv01", "inv02"])
		expect(within(dialog).getByRole("button", { name: "배정" })).toBeDisabled()
		await user.selectOptions(select, "inv02")
		await user.click(within(dialog).getByRole("button", { name: "배정" }))
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
		expect(await screen.findByText(/담당 예시 inv02/)).toBeInTheDocument()
		expect(bodies).toEqual([{ assignee: "inv02", version: 0 }])
		server.events.removeAllListeners()
	})
	it("관리자는 상세에서 [담당자 변경]으로 활성 조사역을 골라 바꾼다 (A2)", async () => {
		const bodies = recordBodies("/reassign")
		const user = renderApp(`/cases/${REVIEWING}`, true, "admin")
		await user.click(await screen.findByRole("button", { name: "담당자 변경" }))
		const dialog = await screen.findByRole("dialog", { name: "담당자 변경" })
		const select = await within(dialog).findByLabelText("새 담당 조사역")
		// 지금 담당(inv01)과 조사역 아닌 사람은 목록에 없다
		const options = within(select)
			.getAllByRole("option")
			.map((option) => option.value)
		expect(options).toEqual(["", "inv02"])
		expect(within(dialog).getByRole("button", { name: "변경" })).toBeDisabled()
		await user.selectOptions(select, "inv02")
		await user.type(within(dialog).getByLabelText("변경 사유 (선택)"), "업무 분담")
		await user.click(within(dialog).getByRole("button", { name: "변경" }))
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
		expect(await screen.findByText(/담당 예시 inv02/)).toBeInTheDocument()
		expect(bodies).toEqual([{ assignee: "inv02", comment: "업무 분담", version: 1 }])
		// 처리 이력에 누구에게서 누구로 — 변경은 둘 다, 배정은 받은 사람만 (SCRUM-348)
		await user.click(screen.getByRole("button", { name: "처리 이력" }))
		const history = screen.getByRole("region", { name: "처리 이력" })
		expect(await within(history).findByText("(예시 inv01 → 예시 inv02)")).toBeInTheDocument()
		expect(within(history).getByText("(→ 예시 inv01)")).toBeInTheDocument()
		server.events.removeAllListeners()
	})
	it("담당자 변경이 409 INVALID_ASSIGNEE면 안내하고 조사역 목록을 다시 부른다", async () => {
		let listCalls = 0
		server.events.on("request:start", ({ request }) => {
			if (new URL(request.url).pathname === "/api/v1/admin/users") listCalls += 1
		})
		server.use(
			http.post(`*/api/v1/cases/${REVIEWING}/reassign`, () =>
				HttpResponse.json(
					{
						error: {
							code: "INVALID_ASSIGNEE",
							message: "활성 조사역에게만 배정할 수 있습니다",
							details: { reason: "NOT_ACTIVE_INVESTIGATOR" },
						},
					},
					{ status: 409 },
				),
			),
		)
		const user = renderApp(`/cases/${REVIEWING}`, true, "admin")
		await user.click(await screen.findByRole("button", { name: "담당자 변경" }))
		const dialog = await screen.findByRole("dialog", { name: "담당자 변경" })
		await user.selectOptions(await within(dialog).findByLabelText("새 담당 조사역"), "inv02")
		await user.click(within(dialog).getByRole("button", { name: "변경" }))
		expect(await within(dialog).findByRole("alert")).toHaveTextContent(
			"활성 조사역에게만 맡길 수 있어요",
		)
		await waitFor(() => expect(listCalls).toBe(2))
		expect(within(dialog).getByLabelText("새 담당 조사역")).toHaveValue("")
		server.events.removeAllListeners()
	})
	it("조사역에게는 [담당자 변경]이 보이지 않고, 관리자는 목록에서도 바꿀 수 있다", async () => {
		const user = renderApp(`/cases/${REVIEWING}`)
		await screen.findByRole("button", { name: "에스컬레이션" })
		expect(screen.queryByRole("button", { name: "담당자 변경" })).not.toBeInTheDocument()
		await user.click(screen.getByRole("link", { name: "← 케이스 목록" }))
		await screen.findByRole("link", { name: REVIEWING })
		expect(screen.queryByRole("button", { name: "담당자 변경" })).not.toBeInTheDocument()
	})
	it("목록 [담당자 변경]은 상태가 아니라 서버 available_actions 를 따른다 (#23 리뷰)", async () => {
		server.use(
			http.get("*/api/v1/cases", () =>
				HttpResponse.json({
					items: [
						{
							case_no: REVIEWING,
							status: "REVIEWING",
							account_ref: "ACR-0004",
							account_no: "11_****1021",
							assignee: { login_id: "inv01", display_name: "예시 inv01" },
							score: 0.91,
							rejection_reason_code: null,
							version: 1,
							created_at: "2026-11-02T01:03:00Z",
							available_actions: [],
						},
					],
					page: 0,
					size: 20,
					total: 1,
				}),
			),
		)
		renderApp("/cases", true, "admin")
		await screen.findByRole("link", { name: REVIEWING })
		expect(screen.queryByRole("button", { name: "담당자 변경" })).not.toBeInTheDocument()
		expect(screen.queryByRole("columnheader", { name: "관리" })).not.toBeInTheDocument()
	})
	it("관리자 목록에서 조사 중인 행의 [담당자 변경]이 확인창을 연다", async () => {
		const user = renderApp("/cases", true, "admin")
		const row = (await screen.findByRole("link", { name: REVIEWING })).closest("tr")
		await user.click(within(row).getByRole("button", { name: "담당자 변경" }))
		const dialog = await screen.findByRole("dialog", { name: "담당자 변경" })
		expect(within(dialog).getByText(new RegExp(REVIEWING))).toBeInTheDocument()
		await user.click(within(dialog).getByRole("button", { name: "취소" }))
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
	})
	it("초안이 있는 케이스는 같은 [종료] 버튼으로 close-with-draft를 부른다", async () => {
		const closeBodies = recordBodies("/close")
		const draftBodies = recordBodies("/close-with-draft")
		const user = renderApp("/cases/CASE-2022-001001")
		await user.click(await screen.findByRole("button", { name: "종료" }))
		// 케이스 상세의 STR 링크에도 초안 번호가 있어서(SCRUM-295) 종료 폼 안에서만 찾아요.
		const closeForm = await screen.findByRole("form", { name: "케이스 종료" })
		expect(within(closeForm).getByText(/DRF-000124/)).toHaveTextContent("대체됨")
		await user.click(screen.getByRole("radio", { name: "중복 경보" }))
		await user.type(screen.getByLabelText("종료 설명"), "같은 경보가 다른 케이스로 조사 중")
		await user.click(screen.getByRole("button", { name: "종료 실행" }))
		expect(await screen.findByText("종료", { selector: ".status-badge" })).toBeInTheDocument()
		expect(screen.getByText("중복 경보")).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "종료" })).not.toBeInTheDocument()
		expect(draftBodies).toEqual([
			{ close_reason: "DUPLICATE", comment: "같은 경보가 다른 케이스로 조사 중", version: 3 },
		])
		expect(closeBodies).toEqual([])
		server.events.removeAllListeners()
	})
	it("'보고 안 함' 반려 케이스도 종료할 수 있고 종료 사유는 세 값 중에서 고른다", async () => {
		server.use(
			http.get(`*/api/v1/cases/${REVIEWING}`, () =>
				HttpResponse.json(
					detailJson({
						status: "REJECTED",
						rejection_reason_code: "NOT_REPORTABLE",
						current_draft_no: "DRF-000124",
						version: 7,
						available_actions: ["CLOSE_WITH_DRAFT"],
					}),
				),
			),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		await user.click(await screen.findByRole("button", { name: "종료" }))
		expect(screen.getByText(/보고 안 함.*으로 반려한 케이스예요/)).toBeInTheDocument()
		expect(screen.getAllByRole("radio").map((radio) => radio.value)).toEqual([
			"FALSE_POSITIVE",
			"DUPLICATE",
			"NO_ACTION",
		])
	})
	it("초안 있는 종료 API가 아직 없으면(404 NOT_FOUND) 사유·설명을 남기고 다시 시도할 수 있다", async () => {
		server.use(
			http.post(
				"*/close-with-draft",
				() =>
					HttpResponse.json(
						{
							error: {
								code: "NOT_FOUND",
								message: "요청한 주소가 없습니다",
								details: {},
							},
						},
						{ status: 404 },
					),
				{ once: true },
			),
		)
		const user = renderApp("/cases/CASE-2022-001001")
		await user.click(await screen.findByRole("button", { name: "종료" }))
		await user.click(screen.getByRole("radio", { name: "오탐" }))
		await user.type(screen.getByLabelText("종료 설명"), "정상 급여 이체")
		await user.click(screen.getByRole("button", { name: "종료 실행" }))
		expect(await screen.findByRole("alert")).toHaveTextContent("아직 서버에 없는 기능이에요")
		expect(screen.getByRole("radio", { name: "오탐" })).toBeChecked()
		expect(screen.getByLabelText("종료 설명")).toHaveValue("정상 급여 이체")
		await user.click(screen.getByRole("button", { name: "종료 실행" }))
		expect(await screen.findByText("종료", { selector: ".status-badge" })).toBeInTheDocument()
	})
	it("메모를 저장하면 메모 이력에 새 메모와 이전 메모가 보인다 (C8)", async () => {
		const user = renderApp(`/cases/${REVIEWING}`)
		const historySection = await screen.findByRole("region", { name: "메모 이력" })
		expect(await within(historySection).findByText("메모 이력이 없습니다.")).toBeInTheDocument()
		const memo = await screen.findByRole("textbox", { name: "메모 내용" })
		await user.clear(memo)
		await user.type(memo, "거래 목적 자료 요청 완료")
		await user.click(screen.getByRole("button", { name: "메모 저장" }))
		expect(await screen.findByText("메모가 저장되었습니다.")).toBeInTheDocument()
		expect(
			await within(historySection).findByText("거래 목적 자료 요청 완료"),
		).toBeInTheDocument()
		expect(within(historySection).getByText("이전 메모 보기")).toBeInTheDocument()
		expect(within(historySection).getByText("거래 목적 확인 필요")).toBeInTheDocument()
		// 가장 최근 기록에 [현재] 표시, 내부 버전 번호는 보이지 않아요(SCRUM-408)
		expect(within(historySection).getByText("현재")).toBeInTheDocument()
		expect(within(historySection).queryByText(/버전/)).not.toBeInTheDocument()
	})
	it("메모를 비운 기록은 (메모 비움)으로 보인다", async () => {
		server.use(
			http.get(`*/api/v1/cases/${REVIEWING}/note-histories`, () =>
				HttpResponse.json({
					items: [
						{
							before_text: "거래 목적 확인 필요",
							after_text: "",
							case_version_before: 1,
							created_by: "inv01",
							created_at: "2026-11-02T02:00:00Z",
						},
					],
					page: 0,
					size: 20,
					total: 1,
				}),
			),
		)
		renderApp(`/cases/${REVIEWING}`)
		const historySection = await screen.findByRole("region", { name: "메모 이력" })
		expect(await within(historySection).findByText("(메모 비움)")).toBeInTheDocument()
	})
	it("초안이 있는 케이스는 판단 요약의 [보고서 열기]로 STR 화면에 간다", async () => {
		const user = renderApp("/cases/CASE-2022-001001")
		const link = await screen.findByRole("link", { name: "보고서 열기" })
		// 초안 번호는 판단 요약 메타 줄에 보여 줘요(SCRUM-369).
		expect(screen.getByText("STR 초안 DRF-000124")).toBeInTheDocument()
		await user.click(link)
		expect(screen.getByRole("heading", { name: "STR 보고서 초안" })).toBeInTheDocument()
	})
	it("메모를 저장하면 새 버전으로 다시 불러온다", async () => {
		const bodies = recordBodies("/notes")
		const user = renderApp(`/cases/${REVIEWING}`)
		const memo = await screen.findByRole("textbox", { name: "메모 내용" })
		await user.clear(memo)
		await user.type(memo, "거래 목적 확인 완료")
		await user.click(screen.getByRole("button", { name: "메모 저장" }))
		expect(await screen.findByText("메모가 저장되었습니다.")).toBeInTheDocument()
		await expectCaseVersion("2")
		expect(bodies).toEqual([{ investigator_notes: "거래 목적 확인 완료", version: 1 }])
		server.events.removeAllListeners()
	})
	it("저장 충돌 시 입력을 보존하며 최신 내용을 확인한 후 재저장한다", async () => {
		const user = renderApp(`/cases/${REVIEWING}`)
		const memo = await screen.findByRole("textbox", { name: "메모 내용" })
		await user.clear(memo)
		await user.type(memo, "내가 작성 중인 메모")
		server.use(
			http.put(
				`*/api/v1/cases/${REVIEWING}/notes`,
				() =>
					HttpResponse.json(
						{ error: { code: "CONCURRENT_UPDATE", message: "충돌", details: {} } },
						{ status: 409 },
					),
				{ once: true },
			),
			http.get(`*/api/v1/cases/${REVIEWING}`, () =>
				HttpResponse.json(
					detailJson({ version: 2, investigator_notes: "다른 조사원의 메모" }),
				),
			),
		)
		await user.click(screen.getByRole("button", { name: "메모 저장" }))
		expect(await screen.findByRole("alert")).toHaveTextContent("다른 사용자가 먼저 변경")
		expect(await screen.findByText("다른 조사원의 메모")).toBeInTheDocument()
		expect(memo).toHaveValue("내가 작성 중인 메모")
		expect(screen.getByRole("button", { name: "메모 저장" })).toBeDisabled()
		const bodies = recordBodies("/notes")
		server.use(
			http.put(`*/api/v1/cases/${REVIEWING}/notes`, () =>
				HttpResponse.json(changeJson({ version: 3 })),
			),
		)
		await user.click(screen.getByRole("checkbox"))
		await user.click(screen.getByRole("button", { name: "메모 저장" }))
		expect(await screen.findByText("메모가 저장되었습니다.")).toBeInTheDocument()
		expect(bodies).toEqual([{ investigator_notes: "내가 작성 중인 메모", version: 2 }])
		server.events.removeAllListeners()
	})
	it("상세에 경보 정보와 최근 모델 점수를 보여 준다", async () => {
		renderApp(`/cases/${REVIEWING}`)
		// 경보 정보는 「케이스·경보 정보」 카드로 합쳤어요(SCRUM-369).
		const panel = await screen.findByRole("region", { name: "케이스·경보 정보" })
		expect(within(panel).getByText("ALT-20221101-000104")).toBeInTheDocument()
		expect(within(panel).getByText("R02_FAN_IN")).toBeInTheDocument()
		// 탐지 기간은 판단 요약에만 있어요. 데이터 시각은 시간대를 붙이지 않고 받은 그대로(T만 공백)
		expect(
			screen.getByText(/탐지 기간 2022-10-31 00:00 ~ 2022-11-01 00:00/), // 상세는 분까지
		).toBeInTheDocument()
		expect(within(panel).getByText("15건")).toBeInTheDocument()
		// 점수·등급은 맨 위 판단 요약(h1 이 있는 banner)으로 올라왔어요. 범죄 확률 아님 안내는 ⓘ 설명으로.
		const summary = screen.getByRole("heading", { level: 1, name: REVIEWING }).closest("header")
		expect(within(summary).getByText("0.91")).toBeInTheDocument() // 둘째 자리 표기
		expect(within(summary).getByText("등급 HIGH")).toBeInTheDocument()
		expect(within(summary).getByRole("tooltip", { hidden: true })).toHaveTextContent(
			"모델 점수예요. 범죄 확률이 아니에요.",
		)
		// 모델 버전 문자열은 보이지 않아요(SCRUM-408)
		expect(within(summary).getByRole("tooltip", { hidden: true })).not.toHaveTextContent(
			"xgb-2022.11",
		)
	})
	it("점수 근거: 기여 크기 순 상위 3개를 관측값·기준값·모델 기여로 나눠 보여 준다 (SCRUM-208)", async () => {
		renderApp(`/cases/${REVIEWING}`)
		const panel = await screen.findByRole("region", { name: "점수 근거" })
		const items = within(panel).getAllByRole("listitem")
		// 목업 reasons 4개(기여 0.05·0.42·0.31·-0.18) → 절댓값 순 0.42·0.31·-0.18, 0.05는 빠짐
		// 지표 코드는 한글 이름으로, 원래 코드는 data-reason 에 남겨요
		expect(items.map((item) => item.querySelector("[data-reason]").dataset.reason)).toEqual([
			"account_in_counterparties_24h",
			"amount_out_sum_24h",
			"fan_out_degree_24h",
		])
		expect(within(items[0]).getByText("24시간 입금 상대 계좌 수")).toBeInTheDocument()
		expect(within(items[1]).getByText("24시간 출금 합계")).toBeInTheDocument()
		expect(within(items[2]).getByText("24시간 송금 상대 계좌 수")).toBeInTheDocument()
		expect(within(panel).queryByText("24시간 야간 거래 비율")).not.toBeInTheDocument()
		// 단위는 한글, 계산 방식(SHAP)·척도(raw_margin)는 값 옆에 쓰지 않아요
		expect(within(items[0]).getByText("12개")).toBeInTheDocument()
		expect(within(items[0]).getByText("3개 (같은 계좌 직전 30일 평균)")).toBeInTheDocument()
		expect(within(items[0]).getByText("(점수를 높임)")).toBeInTheDocument()
		expect(within(items[1]).getByText("152,000.5 $(미국)")).toBeInTheDocument()
		expect(within(items[1]).getByText("기준값 없음")).toBeInTheDocument()
		expect(within(items[2]).getByText("확인 못 함")).toBeInTheDocument()
		expect(within(items[2]).getByText("(점수를 낮춤)")).toBeInTheDocument()
		expect(within(panel).queryByText(/raw_margin|SHAP ·|\bcount\b/)).not.toBeInTheDocument()
		expect(
			within(panel).getAllByText(/^모델 기여 \(거래 사실 아님\)/, { selector: "dt" }),
		).toHaveLength(3)
	})
	it.each([
		["FAILED", [], "점수 산출에 실패해서 이유가 없어요. 위험이 낮다는 뜻이 아니에요."],
		["PENDING", [], "점수 산출 전이라 이유가 아직 없어요."],
		["SCORED", [], "모델이 이유를 보내지 않았어요."],
	])("점수 근거: %s · 이유 없음은 목록 대신 안내만 보여 준다", async (status, reasons, text) => {
		server.use(
			http.get(`*/api/v1/cases/${REVIEWING}`, () =>
				HttpResponse.json(
					detailJson({
						latest_score: {
							score_status: status,
							score: status === "SCORED" ? 0.91 : null,
							score_band: null,
							failure_code: status === "FAILED" ? "AI_TIMEOUT" : null,
							model_version: null,
							feature_version: null,
							data_quality_status: null,
							reasons,
						},
					}),
				),
			),
		)
		renderApp(`/cases/${REVIEWING}`)
		const panel = await screen.findByRole("region", { name: "점수 근거" })
		expect(within(panel).getByText(text)).toBeInTheDocument()
		expect(within(panel).queryByRole("listitem")).not.toBeInTheDocument()
	})
	it("점수 전·산출 실패면 점수 대신 상태를 보여 준다", async () => {
		const latest = { score: null, model_version: null, reasons: [] }
		server.use(
			http.get(`*/api/v1/cases/${REVIEWING}`, () =>
				HttpResponse.json(
					detailJson({
						alert: null,
						latest_score: {
							...latest,
							score_status: "FAILED",
							failure_code: "AI_TIMEOUT",
						},
					}),
				),
			),
		)
		renderApp(`/cases/${REVIEWING}`)
		expect(await screen.findByText("산출 실패 (AI_TIMEOUT)")).toBeInTheDocument()
		expect(screen.getByText("경보 정보 없음")).toBeInTheDocument()
	})
	it("요약이 없으면 [요약 생성]으로 만들고 현재 입력 기준 배지를 보여 준다", async () => {
		const bodies = recordBodies("/refresh-summary")
		const user = renderApp(`/cases/${REVIEWING}`)
		const panel = await screen.findByRole("region", { name: "AI 요약" })
		expect(within(panel).getByText("아직 만든 요약이 없습니다.")).toBeInTheDocument()
		await user.click(within(panel).getByRole("button", { name: "요약 생성" }))
		expect(await within(panel).findByText("현재 입력 기준")).toBeInTheDocument()
		expect(within(panel).getByText(/모델이 주목한 점/)).toBeInTheDocument()
		// AI 문장 속 지표 코드는 한글 이름으로
		expect(within(panel).getByText(/'24시간 입금 상대 계좌 수' 신호/)).toBeInTheDocument()
		expect(within(panel).queryByText(/account_in_counterparties_24h/)).not.toBeInTheDocument()
		expect(within(panel).getByRole("button", { name: "요약 갱신" })).toBeInTheDocument()
		expect(bodies).toEqual([{ version: 1 }])
		// 요약 갱신은 version을 올려요 — 상세를 다시 불러 새 버전을 보여 줘요
		await expectCaseVersion("2")
	})
	it("입력이 바뀐 요약은 '입력 변경됨'으로 보여 준다", async () => {
		renderApp("/cases/CASE-2022-001001")
		const panel = await screen.findByRole("region", { name: "AI 요약" })
		expect(await within(panel).findByText("입력 변경됨")).toBeInTheDocument()
		expect(within(panel).getByRole("button", { name: "요약 갱신" })).toBeInTheDocument()
	})
	it("요약 실패는 그 칸에만 보여 주고 기존 요약은 이전 요약으로 남기며 다른 작업은 그대로 된다", async () => {
		server.use(
			http.get(`*/api/v1/cases/${REVIEWING}`, () =>
				HttpResponse.json(
					detailJson({
						latest_summary: {
							summary_lines: ["예전 요약 첫 줄"],
							model_focus: null,
							produced_at: "2026-11-02T01:20:00Z",
							generator_version: "p-1",
							based_on_case_version: 0,
							is_current: true,
						},
					}),
				),
			),
			http.post(`*/api/v1/cases/${REVIEWING}/refresh-summary`, () =>
				HttpResponse.json(
					{
						error: {
							code: "SUMMARY_CODE_CHECK_FAILED",
							message: "코드 검사 실패",
							details: { failed_checks: ["AMOUNT_MATCH"] },
						},
					},
					{ status: 502 },
				),
			),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		const panel = await screen.findByRole("region", { name: "AI 요약" })
		await user.click(within(panel).getByRole("button", { name: "요약 갱신" }))
		expect(await within(panel).findByRole("alert")).toHaveTextContent(
			"AI 요약이 원본 데이터 검사를 통과하지 못해 저장하지 않았어요.",
		)
		expect(within(panel).getByRole("group", { name: "이전에 만든 요약" })).toHaveTextContent(
			"예전 요약 첫 줄",
		)
		// 다른 작업 버튼·메모 칸은 그대로
		expect(screen.getByRole("button", { name: "에스컬레이션" })).toBeEnabled()
		await user.click(screen.getByRole("button", { name: "조사 메모" }))
		expect(screen.getByRole("textbox", { name: "메모 내용" })).toBeEnabled()
	})
	it("요약 버튼은 REFRESH_SUMMARY가 있을 때만 보여 준다", async () => {
		renderApp("/cases/CASE-2022-001003")
		const panel = await screen.findByRole("region", { name: "AI 요약" })
		expect(within(panel).queryByRole("button")).not.toBeInTheDocument()
	})
	it("없는 케이스는 404 안내를, 조회 오류는 다시 불러오기를 보여 준다", async () => {
		server.use(
			http.get(`*/api/v1/cases/${REVIEWING}`, () => new HttpResponse(null, { status: 500 }), {
				once: true,
			}),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		await user.click(await screen.findByRole("button", { name: "다시 불러오기" }))
		expect(await screen.findByRole("heading", { name: REVIEWING })).toBeInTheDocument()
	})
})

describe("세션과 업무 정보 격리", () => {
	it("미인증 상태에서는 업무 조회를 시작하지 않고 로그인 후 상세 URL을 유지한다", async () => {
		let requests = 0
		server.use(
			http.get("*/api/v1/cases/CASE-2022-001004", () => {
				requests += 1
				return HttpResponse.json(detailJson({ investigator_notes: "복귀한 상세" }))
			}),
		)
		const user = renderApp("/cases/CASE-2022-001004", false)
		await screen.findByText("로그인이 필요합니다.")
		expect(requests).toBe(0)
		await login(user, "inv01")
		expect(await screen.findByText("복귀한 상세")).toBeInTheDocument()
	})
	it("로그아웃 204 후 업무 화면과 캐시를 제거한다", async () => {
		const user = renderApp("/cases/CASE-2022-001004")
		await screen.findByRole("textbox", { name: "메모 내용" })
		await user.click(screen.getByRole("button", { name: "로그아웃" }))
		await screen.findByText("로그인이 필요합니다.")
		expect(screen.queryByRole("textbox", { name: "메모 내용" })).not.toBeInTheDocument()
		expect(user.queryClient.getQueryData(["case", "CASE-2022-001004"])).toBeUndefined()
	})
	it("업무 API의 401에서 세션과 민감한 업무 화면을 제거한다", async () => {
		server.use(
			http.get("*/api/v1/cases/CASE-2022-001004", () =>
				HttpResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 }),
			),
		)
		const user = renderApp("/cases/CASE-2022-001004")
		await screen.findByText("로그인이 필요합니다.")
		expect(user.queryClient.getQueryData(["case", "CASE-2022-001004"])).toBeUndefined()
		expect(screen.getByText(/다른 곳에서 같은 계정으로 로그인/)).toBeInTheDocument()
		expect(screen.queryByRole("textbox", { name: "메모 내용" })).not.toBeInTheDocument()
	})
	it("me 재확인에서 외부 세션 만료를 발견해도 업무 캐시를 제거한다", async () => {
		const user = renderApp("/cases/CASE-2022-001004")
		await screen.findByRole("textbox", { name: "메모 내용" })
		server.use(http.get("*/api/v1/auth/me", () => new HttpResponse(null, { status: 401 })))
		await act(() => user.queryClient.refetchQueries({ queryKey: sessionKey }))
		await screen.findByText("로그인이 필요합니다.")
		expect(user.queryClient.getQueryData(["case", "CASE-2022-001004"])).toBeUndefined()
	})
	it("백엔드 CONCURRENT_UPDATE에서도 입력을 유지하며 최신 내용을 가져온다", async () => {
		const user = renderApp("/cases/CASE-2022-001004")
		const memo = await screen.findByRole("textbox", { name: "메모 내용" })
		await user.type(memo, " 추가 입력")
		server.use(
			http.put("*/api/v1/cases/CASE-2022-001004/notes", () =>
				HttpResponse.json({ error: { code: "CONCURRENT_UPDATE" } }, { status: 409 }),
			),
		)
		await user.click(screen.getByRole("button", { name: "메모 저장" }))
		expect(await screen.findByRole("alert")).toHaveTextContent("다른 사용자가 먼저 변경")
		expect(memo).toHaveValue("거래 목적 확인 필요 추가 입력")
	})
	it("로그아웃 후 도착하는 저장 응답이 업무 캐시를 복원하지 않는다", async () => {
		let finishSave
		let saveStarted = false
		server.use(
			http.put("*/api/v1/cases/CASE-2022-001004/notes", async () => {
				saveStarted = true
				return await new Promise((resolve) => {
					finishSave = () => resolve(HttpResponse.json(changeJson({ version: 2 })))
				})
			}),
		)
		const user = renderApp("/cases/CASE-2022-001004")
		await screen.findByRole("textbox", { name: "메모 내용" })
		await user.click(screen.getByRole("button", { name: "메모 저장" }))
		await waitFor(() => expect(saveStarted).toBe(true))
		const pendingSave = user.queryClient
			.getMutationCache()
			.getAll()
			.find((mutation) => mutation.state.status === "pending")
		await user.click(screen.getByRole("button", { name: "로그아웃" }))
		await screen.findByText("로그인이 필요합니다.")
		finishSave()
		await waitFor(() => expect(pendingSave.state.status).toBe("success"))
		expect(user.queryClient.getQueryData(["case", "CASE-2022-001004"])).toBeUndefined()
	})
})

describe("예시 계정 권한과 입력 보호", () => {
	it("승인자 계정으로 다시 로그인하면 조사 메모를 편집할 수 없다", async () => {
		const user = renderApp("/cases/CASE-2022-001004")
		await screen.findByRole("textbox", { name: "메모 내용" })
		// 같은 브라우저에서 계정을 바꾸려면 로그아웃 후 다시 로그인합니다.
		await user.click(screen.getByRole("button", { name: "로그아웃" }))
		await screen.findByText("로그인이 필요합니다.")
		await login(user, "apr01")
		await screen.findByText("예시 apr01", { selector: ".persona-name" })
		await openCase(user, "CASE-2022-001004")
		// 조사 중인 케이스라 "읽기 전용"이 아니라 담당자 안내 (SCRUM-176)
		expect(
			await screen.findByText("담당 조사역만 메모를 수정할 수 있어요."),
		).toBeInTheDocument()
		expect(screen.queryByRole("textbox", { name: "메모 내용" })).not.toBeInTheDocument()
	})
	it("입력 검증 오류를 메모 입력에 연결하며 내용을 유지한다", async () => {
		server.use(
			http.put("*/api/v1/cases/CASE-2022-001004/notes", () =>
				HttpResponse.json(
					{
						error: {
							code: "INVALID_REQUEST",
							details: { investigator_notes: "메모 길이를 확인하세요" },
						},
					},
					{ status: 400 },
				),
			),
		)
		const user = renderApp("/cases/CASE-2022-001004")
		const memo = await screen.findByRole("textbox", { name: "메모 내용" })
		await user.click(screen.getByRole("button", { name: "메모 저장" }))
		await screen.findByText("메모 길이를 확인하세요")
		expect(memo).toHaveAttribute("aria-invalid", "true")
		expect(memo).toHaveAccessibleDescription("메모 길이를 확인하세요")
		expect(memo).toHaveValue("거래 목적 확인 필요")
	})
	it("변경한 메모가 있을 때 새로고침 확인을 요청한다", async () => {
		const user = renderApp("/cases/CASE-2022-001004")
		const memo = await screen.findByRole("textbox", { name: "메모 내용" })
		await user.type(memo, " 추가")
		const event = new Event("beforeunload", { cancelable: true })
		window.dispatchEvent(event)
		expect(event.defaultPrevented).toBe(true)
	})
	it("변경한 메모가 있을 때 다른 화면 링크를 누르면 확인하고, 계속 작성을 고르면 메모가 남는다", async () => {
		const user = renderApp("/cases/CASE-2022-001004")
		const memo = await screen.findByRole("textbox", { name: "메모 내용" })
		await user.type(memo, " 추가")
		await user.click(screen.getByRole("link", { name: "← 케이스 목록" }))
		const dialog = await screen.findByRole("dialog", { name: "저장하지 않은 메모가 있습니다" })
		await user.click(within(dialog).getByRole("button", { name: "계속 작성" }))
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		expect(screen.getByRole("textbox", { name: "메모 내용" })).toHaveValue(
			"거래 목적 확인 필요 추가",
		)
	})
	it("확인창이 열리면 계속 작성에 포커스가 가서, 바로 Enter를 눌러도 메모가 남는다", async () => {
		const user = renderApp("/cases/CASE-2022-001004")
		const memo = await screen.findByRole("textbox", { name: "메모 내용" })
		await user.type(memo, " 추가")
		await user.click(screen.getByRole("link", { name: "← 케이스 목록" }))
		const dialog = await screen.findByRole("dialog", { name: "저장하지 않은 메모가 있습니다" })
		expect(document.activeElement).toBe(
			within(dialog).getByRole("button", { name: "계속 작성" }),
		)
		await user.keyboard("{Enter}")
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		expect(screen.getByRole("textbox", { name: "메모 내용" })).toHaveValue(
			"거래 목적 확인 필요 추가",
		)
	})
	it("확인창에서 저장하지 않고 이동을 고르면 그 화면으로 간다", async () => {
		const user = renderApp("/cases/CASE-2022-001004")
		const memo = await screen.findByRole("textbox", { name: "메모 내용" })
		await user.type(memo, " 추가")
		await user.click(screen.getByRole("link", { name: "← 케이스 목록" }))
		const dialog = await screen.findByRole("dialog", { name: "저장하지 않은 메모가 있습니다" })
		await user.click(within(dialog).getByRole("button", { name: "저장하지 않고 이동" }))
		await waitFor(() =>
			expect(screen.queryByRole("textbox", { name: "메모 내용" })).not.toBeInTheDocument(),
		)
	})
	it("메모를 고치지 않았으면 링크를 눌러도 확인 없이 이동한다", async () => {
		const user = renderApp("/cases/CASE-2022-001004")
		await screen.findByRole("textbox", { name: "메모 내용" })
		await user.click(screen.getByRole("link", { name: "← 케이스 목록" }))
		await waitFor(() =>
			expect(screen.queryByRole("textbox", { name: "메모 내용" })).not.toBeInTheDocument(),
		)
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
	})
})
describe("근거 거래·그래프·이력 (SCRUM-179)", () => {
	it("상세에 통화별 합계, 근거 거래 표, 자금 흐름 그래프가 보인다", async () => {
		const user = renderApp(`/cases/${REVIEWING}`)
		const agg = await screen.findByRole("region", { name: "유입·유출 합계" })
		expect(within(agg).getByText("유입 합계 (2건)")).toBeInTheDocument()
		expect(within(agg).getByText("1,000 $(미국)")).toBeInTheDocument()
		expect(within(agg).getByText("유출 합계 (1건)")).toBeInTheDocument()

		// 처음 열려 있는 탭은 자금 흐름 그래프
		expect(screen.getByRole("button", { name: "자금 흐름" })).toHaveAttribute(
			"aria-pressed",
			"true",
		)
		const graph = await screen.findByRole("group", { name: /거래 4건/ })
		expect(within(graph).getAllByTestId("graph-edge")).toHaveLength(4)
		expect(within(graph).getByText("11_****1021 (대상)")).toBeInTheDocument()
		expect(screen.getByText("유입 2건")).toBeInTheDocument()

		await user.click(screen.getByRole("button", { name: "근거 거래" }))
		const table = await screen.findByRole("region", { name: "근거 거래" })
		const rows = await within(table).findAllByRole("row")
		expect(rows).toHaveLength(5) // 머리 + 4건
		expect(within(rows[1]).getByText("III부 1 · 입금")).toBeInTheDocument()
		// 날짜 / 시각은 두 줄로 나눠 보여요(SCRUM-410)
		expect(rows[1].cells[1]).toHaveTextContent("2022-10-31 09:00")
		expect(within(rows[3]).getByText("III부 3 · 출금")).toBeInTheDocument()
		expect(within(rows[4]).getByText("대상 계좌 미참여")).toBeInTheDocument()
	})
	it("그래프에서 거래 선을 누르면 그 거래 내용이 아래에 고정된다", async () => {
		const user = renderApp(`/cases/${REVIEWING}`)
		const graph = await screen.findByRole("group", { name: /거래 4건/ })
		expect(document.querySelector(".flow-graph-detail")).toBeEmptyDOMElement()
		await user.click(within(graph).getAllByTestId("graph-edge")[0])
		await user.unhover(graph)
		expect(screen.getByText(/거래 4721/)).toBeInTheDocument()
	})
	it("그래프의 계좌는 Tab으로 옮기고 Enter로 고정·해제할 수 있다", async () => {
		const user = renderApp(`/cases/${REVIEWING}`)
		const graph = await screen.findByRole("group", { name: /거래 4건/ })
		const target = within(graph).getByRole("button", { name: /11_\*{4}1021 \(조사 대상\)/ })
		act(() => target.focus())
		expect(screen.getByText(/이 그림에서 보낸 거래/)).toBeInTheDocument()
		await user.keyboard("{Enter}")
		expect(target).toHaveAttribute("aria-pressed", "true")
		// 포커스가 떠나도 고정된 내용은 남아요
		act(() => target.blur())
		expect(screen.getByText(/이 그림에서 보낸 거래/)).toBeInTheDocument()
		act(() => target.focus())
		await user.keyboard("{Enter}")
		expect(target).toHaveAttribute("aria-pressed", "false")
		act(() => target.blur())
		expect(document.querySelector(".flow-graph-detail")).toBeEmptyDOMElement()
	})
	it("[거래 원본]은 C4 원본을 창으로 보여 주고, 404면 그 창에만 안내", async () => {
		const user = renderApp(`/cases/${REVIEWING}`)
		await user.click(await screen.findByRole("button", { name: "근거 거래" }))
		const table = await screen.findByRole("region", { name: "근거 거래" })
		await user.click((await within(table).findAllByRole("button", { name: "거래 원본" }))[0])
		const dialog = await screen.findByRole("dialog", { name: "거래 원본 · 4721" })
		expect(
			await within(dialog).findByText(/IBM AML HI-Small · 행 4721 · 합성 데이터/),
		).toBeInTheDocument()
		expect(within(dialog).getByText("입금")).toBeInTheDocument()
		// 데이터셋 원문(ACH·US Dollar)은 한글로
		expect(within(dialog).getByText("자동이체(ACH)")).toBeInTheDocument()
		expect(within(dialog).queryByText(/US Dollar/)).not.toBeInTheDocument()
		await user.click(within(dialog).getByRole("button", { name: "닫기" }))

		server.use(
			http.get(`*/api/v1/cases/${REVIEWING}/evidence/:id`, () =>
				HttpResponse.json(
					{
						error: {
							code: "EVIDENCE_NOT_FOUND",
							message: "이 케이스의 근거 거래가 아닙니다",
							details: {},
						},
					},
					{ status: 404 },
				),
			),
		)
		await user.click(within(table).getAllByRole("button", { name: "거래 원본" })[1])
		const failed = await screen.findByRole("dialog", { name: "거래 원본 · 4722" })
		expect(
			await within(failed).findByText("이 케이스의 근거 거래가 아닙니다"),
		).toBeInTheDocument()
		expect(screen.getByRole("region", { name: "근거 거래" })).toBeInTheDocument()
	})
	it("참고 거래 탭과 근거 없는 케이스는 칸마다 빈 상태를 보여 준다", async () => {
		const user = renderApp(`/cases/${REVIEWING}`)
		await user.click(await screen.findByRole("button", { name: "참고 거래" }))
		const table = await screen.findByRole("region", { name: "참고 거래" })
		expect(await within(table).findByText("참고 거래가 없어요.")).toBeInTheDocument()
		// 탭을 바꾸면 근거 거래 표는 내려가고, 그래프 탭에서 돌아와도 보던 범위 그대로
		expect(screen.queryByRole("region", { name: "근거 거래" })).not.toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: "자금 흐름" }))
		await user.click(screen.getByRole("button", { name: "근거 거래" }))
		expect(await screen.findByRole("region", { name: "근거 거래" })).toBeInTheDocument()
	})
	it("대상 계좌로 돌아온 돈은 경로 지도와 경로 거래 표로 보여 준다 (SCRUM-280)", async () => {
		renderApp("/cases/CASE-2022-001001")
		const route = await screen.findByRole("figure", {
			name: "경로 1: 10_****8842 → 21_****7F12 → 33_****A901 → 10_****8842",
		})
		expect(within(route).getByText("3단계 · 대상 계좌 복귀")).toBeInTheDocument()
		expect(within(route).getByText("대상 계좌 복귀")).toBeInTheDocument()
		expect(within(route).getByText("4,600 €(유로)")).toBeInTheDocument()
		// 화면이 찾은 길이지 룰 판정이 아니라고 적어요 (SCRUM-296)
		expect(screen.getByText("화면에서 시간 순서로 찾은 길 · 룰 판정 아님")).toBeInTheDocument()
		// 경로 표에 거래 ID가 단계 순서대로
		const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1)
		expect(rows.map((row) => within(row).getAllByRole("cell").at(-1).textContent)).toEqual([
			"5101",
			"5102",
			"5103",
		])
	})
	it("4단계 이상 경로는 가로로 늘이지 않고 다음 줄로 이어 그린다 (SCRUM-296)", async () => {
		const ts = (t) => `2022-10-31T${t}:00`
		const graphEdge = (id, source, target, time) => ({
			transaction_id: id,
			source,
			target,
			amount: 100,
			currency: "US Dollar",
			amount_basis: "RECEIVED",
			scope: "EVIDENCE",
			ts: ts(time),
		})
		const refs = ["ACR-0001", "ACR-201", "ACR-202", "ACR-203", "ACR-204"]
		server.use(
			http.get("*/api/v1/cases/CASE-2022-001001/graph", () =>
				HttpResponse.json({
					nodes: refs.map((ref, i) => ({
						account_ref: ref,
						account_no: `0${i}0_****000${i}`,
					})),
					edges: refs.map((ref, i) =>
						graphEdge(i + 1, ref, refs[(i + 1) % refs.length], `1${i}:00`),
					),
					returned_transaction_count: 5,
					total_transaction_count: 5,
					truncated: false,
				}),
			),
		)
		renderApp("/cases/CASE-2022-001001")
		const route = await screen.findByRole("figure", { name: /^경로 1:/ })
		const rows = within(route).getAllByRole("list")
		expect(rows).toHaveLength(2)
		// 첫 줄 3단계, 둘째 줄 2단계 — 단계 번호는 이어져요
		expect(within(rows[0]).getAllByRole("listitem")).toHaveLength(3)
		expect(within(rows[1]).getAllByRole("listitem")).toHaveLength(2)
		expect(within(rows[1]).getByText(/04 · 경유 거래/)).toBeInTheDocument()
		expect(within(rows[1]).getByText("대상 계좌 복귀")).toBeInTheDocument()
	})
	it("R04_CYCLE 이 아닌 케이스는 돌아온 길이 있어도 전체 그래프를 먼저 보여 준다 (SCRUM-296)", async () => {
		// REVIEWING 케이스의 경보는 R02_FAN_IN — 그래프에 A → B → A 길이 있어도 경로 지도를 띄우지 않아요
		const graphEdge = (id, source, target, ts) => ({
			transaction_id: id,
			source,
			target,
			amount: 100,
			currency: "US Dollar",
			amount_basis: "RECEIVED",
			scope: "EVIDENCE",
			ts,
		})
		server.use(
			http.get(`*/api/v1/cases/${REVIEWING}/graph`, () =>
				HttpResponse.json({
					nodes: [
						{ account_ref: "ACR-0004", account_no: "11_****1021" },
						{ account_ref: "ACR-102", account_no: "20_****2020" },
					],
					edges: [
						graphEdge(1, "ACR-0004", "ACR-102", "2022-10-31T09:00:00"),
						graphEdge(2, "ACR-102", "ACR-0004", "2022-10-31T10:00:00"),
					],
					returned_transaction_count: 2,
					total_transaction_count: 2,
					truncated: false,
				}),
			),
		)
		renderApp(`/cases/${REVIEWING}`)
		expect(await screen.findByRole("region", { name: "자금 흐름 그림" })).toBeInTheDocument()
		expect(screen.queryByRole("figure")).not.toBeInTheDocument()
		expect(screen.queryByText(/룰 판정 아님/)).not.toBeInTheDocument()
	})
	it("직접 거래 밖의 건수는 경유·내 계좌 이체를 묶어 '그 밖'으로 적는다 (SCRUM-296)", async () => {
		renderApp(`/cases/${REVIEWING}`)
		const card = await screen.findByRole("region", { name: "거래 분석" })
		expect(await within(card).findByText(/\(경유·내 계좌 이체\)/)).toHaveTextContent(
			"그 밖 1건(경유·내 계좌 이체)",
		)
	})
	it("근거 거래가 없는 케이스는 합계·표·그래프가 비어 있다고 알린다", async () => {
		renderApp("/cases/CASE-2022-001002")
		expect(await screen.findByText("근거 거래가 없어요.")).toBeInTheDocument()
		expect(await screen.findByText("이 케이스의 근거 거래가 없어요.")).toBeInTheDocument()
		expect(await screen.findByText("그릴 거래가 없어요.")).toBeInTheDocument()
	})
	it("그래프가 잘리면 전체 N건 중 M건, 표가 실패해도 다른 칸은 남는다", async () => {
		server.use(
			http.get(`*/api/v1/cases/${REVIEWING}/graph`, () =>
				HttpResponse.json({
					nodes: [
						{ account_ref: "ACR-0004", account_no: "11_****1021" },
						{ account_ref: "ACR-102", account_no: "20_****2020" },
					],
					edges: [
						{
							transaction_id: 1,
							source: "ACR-102",
							target: "ACR-0004",
							amount: 10,
							currency: "US Dollar",
							amount_basis: "RECEIVED",
							scope: "EVIDENCE",
							ts: "2022-10-31T09:00:00",
						},
					],
					returned_transaction_count: 200,
					total_transaction_count: 300,
					truncated: true,
				}),
			),
			http.get(`*/api/v1/cases/${REVIEWING}/transactions`, () =>
				HttpResponse.json(
					{ error: { code: "INTERNAL_ERROR", message: "서버 오류", details: {} } },
					{ status: 500 },
				),
			),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		expect(await screen.findByText(/전체 300건 중 200건만 그렸어요/)).toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: "근거 거래" }))
		const table = screen.getByRole("region", { name: "근거 거래" })
		expect(await within(table).findByRole("alert")).toHaveTextContent(
			"데이터를 불러오지 못했습니다.",
		)
		expect(screen.getByRole("region", { name: "유입·유출 합계" })).toBeInTheDocument()
	})
	it("처리 이력은 최근 5건만 보이고, [더 보기]로 C6 전체를 펼치고 [접기]로 돌아간다 (SCRUM-428)", async () => {
		// 상세의 최근 이력을 6건으로 늘려 [더 보기]가 나오게 해요. 펼친 전체 목록(C6)은 MSW 원래 이력이에요.
		const rows = Array.from({ length: 6 }, (_, i) => ({
			action: "ASSIGN",
			from_status: "OPEN",
			to_status: "REVIEWING",
			created_by: "admin",
			created_at: `2026-11-0${i + 1}T00:00:00Z`,
			comment: `최근 이력 ${i + 1}`,
		}))
		server.use(
			http.get(`*/api/v1/cases/${REVIEWING}`, () =>
				HttpResponse.json(detailJson({ history: rows })),
			),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		await user.click(await screen.findByRole("button", { name: "처리 이력" }))
		const recent = await screen.findByRole("region", { name: "처리 이력" })
		expect(await within(recent).findByText("최근 이력 5")).toBeInTheDocument()
		expect(within(recent).queryByText("최근 이력 6")).not.toBeInTheDocument()
		const more = within(recent).getByRole("button", { name: "이력 1건 더 보기" })
		expect(more).toHaveAttribute("aria-expanded", "false")
		await user.click(more)
		const history = await screen.findByRole("region", { name: "처리 이력 전체" })
		expect(await within(history).findByText("담당 배정")).toBeInTheDocument()
		expect(within(history).getByText("케이스 생성")).toBeInTheDocument()
		// 배치가 만든 줄의 작업자 system 은 "시스템"
		expect(within(history).getByText(/^시스템 ·/)).toBeInTheDocument()
		expect(within(history).queryByText("메모 저장")).not.toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: "조사 메모" }))
		expect(screen.getByRole("region", { name: "메모 이력" })).toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: "처리 이력" }))
		await user.click(within(history).getByRole("button", { name: "접기" }))
		expect(await screen.findByRole("region", { name: "처리 이력" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "이력 1건 더 보기" })).toBeInTheDocument()
	})
})

describe("케이스 목록 필터 (SCRUM-181)", () => {
	function recordListUrls() {
		const urls = []
		server.events.on("request:start", ({ request }) => {
			const url = new URL(request.url)
			if (url.pathname === "/api/v1/cases") urls.push(url)
		})
		return urls
	}
	const statusBox = (name) =>
		within(screen.getByRole("group", { name: "상태" })).getByRole("checkbox", { name })

	it("상태 여러 개를 골라 서버에 쉼표로 보내고 주소에 남긴다", async () => {
		const urls = recordListUrls()
		const user = renderApp("/cases")
		await screen.findByRole("link", { name: REVIEWING })
		await user.click(statusBox("조사 중"))
		await user.click(statusBox("초안 작성됨"))
		expect(await screen.findByRole("link", { name: "CASE-2022-001001" })).toBeInTheDocument()
		await waitFor(() =>
			expect(
				screen.queryByRole("link", { name: "CASE-2022-001002" }),
			).not.toBeInTheDocument(),
		)
		expect(urls.at(-1).searchParams.get("status")).toBe("REVIEWING,DRAFTED")
		expect(screen.getByText("점수 높은 순")).toBeInTheDocument()
		server.events.removeAllListeners()
	})
	it("시작일이 종료일보다 늦으면 안내하고 목록을 부르지 않는다", async () => {
		const user = renderApp("/cases")
		await screen.findByRole("link", { name: REVIEWING })
		const urls = recordListUrls()
		await user.type(screen.getByLabelText("생성일 종료"), "2026-11-01")
		await user.type(screen.getByLabelText("생성일 시작"), "2026-11-05")
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"시작일은 종료일보다 늦을 수 없어요.",
		)
		expect(screen.queryByRole("region", { name: "케이스 목록 표" })).not.toBeInTheDocument()
		expect(urls.some((url) => url.searchParams.get("from") === "2026-11-05")).toBe(false)
		server.events.removeAllListeners()
	})
	it("결과가 없으면 [필터 초기화]로 전체 목록에 돌아온다", async () => {
		const user = renderApp("/cases?status=CLOSED")
		expect(await screen.findByText("조건에 맞는 케이스가 없습니다.")).toBeInTheDocument()
		await user.click(screen.getAllByRole("button", { name: "필터 초기화" }).at(-1))
		expect(await screen.findByRole("link", { name: REVIEWING })).toBeInTheDocument()
		expect(statusBox("종료")).not.toBeChecked()
	})
	it("주소로 들어오면 필터가 채워지고, 상세에 갔다 돌아와도 필터·정렬이 그대로다", async () => {
		const urls = recordListUrls()
		const user = renderApp("/cases?status=REVIEWING&sort=created_at,desc&from=2026-11-01")
		await user.click(await screen.findByRole("link", { name: REVIEWING }))
		await user.click(await screen.findByRole("link", { name: "← 케이스 목록" }))
		await screen.findByRole("link", { name: REVIEWING })
		expect(statusBox("조사 중")).toBeChecked()
		expect(screen.getByLabelText("정렬")).toHaveValue("created_at,desc")
		expect(screen.getByLabelText("생성일 시작")).toHaveValue("2026-11-01")
		const last = urls.at(-1)
		expect(last.searchParams.get("status")).toBe("REVIEWING")
		expect(last.searchParams.get("sort")).toBe("created_at,desc")
		expect(last.searchParams.get("from")).toBe("2026-11-01")
		server.events.removeAllListeners()
	})
	it("계정 관리 [케이스 보기]의 assignee=login_id 를 그대로 보낸다", async () => {
		const urls = recordListUrls()
		const user = renderApp("/cases?assignee=inv01", true, "admin")
		expect(await screen.findByText(/담당자: inv01/)).toBeInTheDocument()
		await screen.findByRole("link", { name: REVIEWING })
		expect(urls.at(-1).searchParams.get("assignee")).toBe("inv01")
		expect(screen.queryByRole("link", { name: "CASE-2022-001002" })).not.toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: "담당자 조건 해제" }))
		expect(await screen.findByRole("link", { name: "CASE-2022-001002" })).toBeInTheDocument()
		server.events.removeAllListeners()
	})
	it("반려 케이스는 보완 요청·보고 안 함을 나눠 보여 준다", async () => {
		const row = (caseNo, code) => ({
			case_no: caseNo,
			status: "REJECTED",
			account_ref: "ACR-9",
			account_no: "10_****0009",
			assignee: { login_id: "inv01", display_name: "예시 inv01" },
			score: 0.9,
			rejection_reason_code: code,
			version: 5,
			created_at: "2026-11-02T01:00:00Z",
		})
		server.use(
			http.get("*/api/v1/cases", () =>
				HttpResponse.json({
					items: [
						row("CASE-2022-009001", "NEED_REVISION"),
						row("CASE-2022-009002", "NOT_REPORTABLE"),
					],
					page: 0,
					size: 20,
					total: 2,
				}),
			),
		)
		renderApp("/cases")
		expect(await screen.findByText("반려 · 보완 요청")).toBeInTheDocument()
		expect(screen.getByText("반려 · 보고 안 함")).toBeInTheDocument()
	})
})
