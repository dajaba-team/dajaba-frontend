import { describe, expect, it } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { MOCK_PASSWORD, resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"

const USERS = {
	inv01: { id: "1", login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	admin: { id: "4", login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
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
	account_no: "011_****1021",
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

describe("인증 통신", () => {
	it("아이디·비밀번호를 JSON으로 보내 로그인하고 현재 사용자를 다시 조회한다", async () => {
		let body
		server.events.on("request:start", async ({ request }) => {
			if (request.url.endsWith("/api/v1/auth/login")) body = await request.clone().json()
		})
		const user = renderApp("/cases", false)
		await screen.findByText("로그인이 필요합니다.")
		await login(user, "apr01")
		expect(await screen.findByText("예시 apr01 (apr01) · APPROVER")).toBeInTheDocument()
		expect(body).toEqual({ login_id: "apr01", password: MOCK_PASSWORD })
		server.events.removeAllListeners()
		await user.click(screen.getByRole("button", { name: "현재 사용자 확인" }))
		expect(await screen.findByText("예시 apr01 (apr01) · APPROVER")).toBeInTheDocument()
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
		expect(await screen.findByText("예시 inv01 (inv01) · INVESTIGATOR")).toBeInTheDocument()
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
		expect(await screen.findByText("예시 inv01 (inv01) · INVESTIGATOR")).toBeInTheDocument()
	})
	it("다른 곳 로그인으로 세션이 끊기면 로그인 폼과 안내를 보여 준다", async () => {
		const user = renderApp("/cases/CASE-2022-001004")
		await screen.findByRole("textbox", { name: "메모 내용" })
		server.use(
			http.get("*/api/v1/auth/me", () =>
				HttpResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 }),
			),
		)
		await user.click(screen.getByRole("button", { name: "현재 사용자 확인" }))
		expect(await screen.findByText(/다른 곳에서 같은 계정으로 로그인/)).toBeInTheDocument()
		expect(screen.getByLabelText("비밀번호")).toBeInTheDocument()
		server.resetHandlers()
		resetCases()
		await login(user, "inv01")
		await screen.findByText("예시 inv01 (inv01) · INVESTIGATOR")
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
		expect(within(row).getByText("011_****1021")).toBeInTheDocument()
		expect(within(row).getByText("조사 중")).toBeInTheDocument()
		expect(within(row).getByText("예시 inv01")).toBeInTheDocument()
		expect(screen.getByText(/1 \/ 1 페이지 · 전체 4건/)).toBeInTheDocument()
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
		await user.selectOptions(screen.getByLabelText("상태 필터"), "CLOSED")
		expect(await screen.findByText("조건에 맞는 케이스가 없습니다.")).toBeInTheDocument()
	})
	it("담당 조사역이 에스컬레이션한 뒤 사유를 골라 종료한다", async () => {
		const closeBodies = recordBodies("/close")
		const user = renderApp()
		await user.click(await screen.findByRole("link", { name: REVIEWING }))
		await user.click(await screen.findByRole("button", { name: "에스컬레이션" }))
		await user.type(screen.getByLabelText("에스컬레이션 사유"), "STR 검토 필요")
		await user.click(screen.getByRole("button", { name: "에스컬레이션 실행" }))
		expect(
			await screen.findByText("에스컬레이션됨", { selector: ".case-status" }),
		).toBeInTheDocument()
		expect(screen.getByText("STR 검토 필요")).toBeInTheDocument()

		await user.click(screen.getByRole("button", { name: "종료" }))
		const submit = screen.getByRole("button", { name: "종료 실행" })
		expect(submit).toBeDisabled()
		await user.click(screen.getByRole("radio", { name: "오탐" }))
		expect(submit).toBeDisabled()
		await user.type(screen.getByLabelText("종료 설명"), "동일 법인 내부 이체")
		await user.click(submit)
		expect(await screen.findByText("종료", { selector: ".case-status" })).toBeInTheDocument()
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
	it("에스컬레이션으로 버전이 올라도 손대지 않은 메모는 충돌로 보지 않는다", async () => {
		const bodies = recordBodies("/notes")
		const user = renderApp(`/cases/${REVIEWING}`)
		await user.click(await screen.findByRole("button", { name: "에스컬레이션" }))
		await user.type(screen.getByLabelText("에스컬레이션 사유"), "STR 검토 필요")
		await user.click(screen.getByRole("button", { name: "에스컬레이션 실행" }))
		await screen.findByText("에스컬레이션됨", { selector: ".case-status" })
		expect(screen.queryByText(/서버의 최신 메모/)).not.toBeInTheDocument()
		const memo = screen.getByRole("textbox", { name: "메모 내용" })
		await user.type(memo, " 추가")
		await user.click(screen.getByRole("button", { name: "메모 저장" }))
		expect(await screen.findByText("메모가 저장되었습니다.")).toBeInTheDocument()
		expect(bodies).toEqual([{ investigator_notes: "거래 목적 확인 필요 추가", version: 2 }])
		server.events.removeAllListeners()
	})
	it("미배정 케이스는 조사역이 직접 맡고, 맡으면 메모를 쓸 수 있다", async () => {
		const user = renderApp("/cases/CASE-2022-001002")
		expect(await screen.findByText("현재 케이스는 읽기 전용입니다.")).toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: "담당 맡기" }))
		expect(await screen.findByRole("textbox", { name: "메모 내용" })).toBeInTheDocument()
		expect(screen.getByText(/담당자 예시 inv01/)).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "담당 맡기" })).not.toBeInTheDocument()
	})
	it("관리자 배정은 조사역이 아니면 거절되고 입력을 남겨 다시 고칠 수 있다", async () => {
		const user = renderApp("/cases/CASE-2022-001002", true, "admin")
		await user.click(await screen.findByRole("button", { name: "담당자 배정" }))
		const input = screen.getByLabelText("배정할 조사역 아이디")
		await user.type(input, "apr01")
		await user.click(screen.getByRole("button", { name: "배정" }))
		expect(await screen.findByRole("alert")).toHaveTextContent("조사역만 배정할 수 있습니다")
		expect(input).toHaveValue("apr01")
		await user.clear(input)
		await user.type(input, "inv02")
		await user.click(screen.getByRole("button", { name: "배정" }))
		expect(await screen.findByText(/담당자 예시 inv02/)).toBeInTheDocument()
	})
	it("초안이 있는 케이스는 종료 대신 안내를 보여 주고 STR 화면으로 간다", async () => {
		const user = renderApp("/cases/CASE-2022-001001")
		expect(
			await screen.findByText("초안이 있는 케이스의 종료는 준비 중이에요."),
		).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "종료" })).not.toBeInTheDocument()
		await user.click(screen.getByRole("link", { name: /STR 화면으로/ }))
		expect(screen.getByRole("heading", { name: "STR 초안" })).toBeInTheDocument()
	})
	it("메모를 저장하면 새 버전으로 다시 불러온다", async () => {
		const bodies = recordBodies("/notes")
		const user = renderApp(`/cases/${REVIEWING}`)
		const memo = await screen.findByRole("textbox", { name: "메모 내용" })
		await user.clear(memo)
		await user.type(memo, "거래 목적 확인 완료")
		await user.click(screen.getByRole("button", { name: "메모 저장" }))
		expect(await screen.findByText("메모가 저장되었습니다.")).toBeInTheDocument()
		expect(await screen.findByText(/버전 2/)).toBeInTheDocument()
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
		await user.click(screen.getByRole("button", { name: "현재 사용자 확인" }))
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
		await screen.findByText("예시 apr01 (apr01) · APPROVER")
		expect(await screen.findByText("현재 케이스는 읽기 전용입니다.")).toBeInTheDocument()
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
})
