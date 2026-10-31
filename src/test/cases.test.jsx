import { describe, expect, it } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"

function renderApp(path = "/cases", authenticated = true) {
	if (authenticated)
		resetCases({ id: "1", login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" })
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

describe("인증 통신", () => {
	it("선택 계정으로 로그인하고 현재 사용자를 다시 조회한다", async () => {
		const user = renderApp("/cases", false)
		await screen.findByText("로그인이 필요합니다.")
		await user.selectOptions(screen.getByLabelText("로컬 테스트 계정"), "apr01")
		await user.click(screen.getByRole("button", { name: "테스트 로그인" }))
		expect(await screen.findByText("예시 apr01 (apr01) · APPROVER")).toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: "현재 사용자 확인" }))
		expect(await screen.findByText("예시 apr01 (apr01) · APPROVER")).toBeInTheDocument()
	})
	it("로그인 실패를 표시하고 다시 시도할 수 있다", async () => {
		server.use(
			http.post("*/api/v1/auth/mock-login", () => new HttpResponse(null, { status: 500 }), {
				once: true,
			}),
		)
		const user = renderApp("/cases", false)
		await screen.findByText("로그인이 필요합니다.")
		await user.click(screen.getByRole("button", { name: "테스트 로그인" }))
		expect(await screen.findByRole("alert")).toHaveTextContent("요청을 처리하지 못했습니다.")
		await user.click(screen.getByRole("button", { name: "테스트 로그인" }))
		expect(await screen.findByText("예시 inv01 (inv01) · INVESTIGATOR")).toBeInTheDocument()
	})
})

describe("케이스 조사", () => {
	it("목록에서 상세를 열어 메모를 저장하고 STR로 이동한다", async () => {
		const user = renderApp()
		await user.click(await screen.findByRole("link", { name: "반복 고액 이체 조사" }))
		const memo = await screen.findByRole("textbox", { name: "메모 내용" })
		await user.clear(memo)
		await user.type(memo, "거래 목적 확인 완료")
		await user.click(screen.getByRole("button", { name: "메모 저장" }))
		expect(await screen.findByText("메모가 저장되었습니다.")).toBeInTheDocument()
		expect(await screen.findByText("조사 메모 저장 (버전 2)")).toBeInTheDocument()
		await user.click(screen.getByRole("link", { name: /STR 화면으로/ }))
		expect(screen.getByRole("heading", { name: "STR 초안" })).toBeInTheDocument()
	})
	it("저장 충돌 시 입력을 보존하며 최신 내용을 확인한 후 재저장한다", async () => {
		const user = renderApp("/cases/1001")
		const memo = await screen.findByRole("textbox", { name: "메모 내용" })
		await user.clear(memo)
		await user.type(memo, "내가 작성 중인 메모")
		server.use(
			http.put(
				"*/api/cases/1001/memo",
				() => HttpResponse.json({ code: "CASE_VERSION_CONFLICT" }, { status: 409 }),
				{ once: true },
			),
		)
		await user.click(screen.getByRole("button", { name: "메모 저장" }))
		expect(await screen.findByRole("alert")).toHaveTextContent("다른 사용자가 먼저 변경")
		expect(memo).toHaveValue("내가 작성 중인 메모")
		server.use(
			http.get("*/api/cases/1001", () =>
				HttpResponse.json({
					id: "1001",
					title: "반복 고액 이체 조사",
					status: "REVIEWING",
					assignee_name: "예시 조사원",
					case_version: 2,
					memo: "다른 조사원의 메모",
					evidence: "거래 근거",
					allowed_actions: ["SAVE_MEMO"],
					history: [],
				}),
			),
		)
		await user.click(screen.getByRole("button", { name: "최신 내용 확인" }))
		expect(await screen.findByText("다른 조사원의 메모")).toBeInTheDocument()
		expect(memo).toHaveValue("내가 작성 중인 메모")
		expect(screen.getByRole("button", { name: "메모 저장" })).toBeDisabled()
		await user.click(screen.getByRole("checkbox"))
		server.use(
			http.put("*/api/cases/1001/memo", async ({ request }) => {
				const body = await request.json()
				expect(body).toEqual({ memo: "내가 작성 중인 메모", case_version: 2 })
				return HttpResponse.json({
					id: "1001",
					title: "반복 고액 이체 조사",
					status: "REVIEWING",
					case_version: 3,
					memo: body.memo,
					allowed_actions: ["SAVE_MEMO"],
					history: ["충돌 확인 후 저장"],
				})
			}),
		)
		await user.click(screen.getByRole("button", { name: "메모 저장" }))
		expect(await screen.findByText("메모가 저장되었습니다.")).toBeInTheDocument()
	})
	it("권한 없는 케이스는 읽기 전용이다", async () => {
		renderApp("/cases/1002")
		expect(await screen.findByText("현재 케이스는 읽기 전용입니다.")).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "메모 저장" })).not.toBeInTheDocument()
	})
	it("상태 필터가 빈 결과를 표시한다", async () => {
		const user = renderApp()
		await user.selectOptions(await screen.findByLabelText("상태 필터"), "CLOSED")
		expect(await screen.findByText("조건에 맞는 케이스가 없습니다.")).toBeInTheDocument()
	})
	it("상세 조회 오류에서 다시 불러올 수 있다", async () => {
		server.use(
			http.get("*/api/cases/1001", () => new HttpResponse(null, { status: 500 }), {
				once: true,
			}),
		)
		const user = renderApp("/cases/1001")
		await user.click(await screen.findByRole("button", { name: "다시 불러오기" }))
		expect(
			await screen.findByRole("heading", { name: "반복 고액 이체 조사" }),
		).toBeInTheDocument()
	})
})

describe("세션과 업무 정보 격리", () => {
	it("미인증 상태에서는 업무 조회를 시작하지 않고 로그인 후 상세 URL을 유지한다", async () => {
		let requests = 0
		server.use(
			http.get("*/api/cases/1001", () => {
				requests += 1
				return HttpResponse.json({
					id: "1001",
					title: "복귀한 상세",
					allowed_actions: [],
					history: [],
				})
			}),
		)
		const user = renderApp("/cases/1001", false)
		await screen.findByText("로그인이 필요합니다.")
		expect(requests).toBe(0)
		await user.click(screen.getByRole("button", { name: "테스트 로그인" }))
		expect(await screen.findByRole("heading", { name: "복귀한 상세" })).toBeInTheDocument()
	})
	it("로그아웃 204 후 업무 화면과 캐시를 제거한다", async () => {
		const user = renderApp("/cases/1001")
		await screen.findByRole("textbox", { name: "메모 내용" })
		await user.click(screen.getByRole("button", { name: "로그아웃" }))
		await screen.findByText("로그인이 필요합니다.")
		expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
		expect(user.queryClient.getQueryData(["case", "1001"])).toBeUndefined()
	})
	it("업무 API의 401에서 세션과 민감한 업무 화면을 제거한다", async () => {
		server.use(
			http.get("*/api/cases/1001", () =>
				HttpResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 }),
			),
		)
		const user = renderApp("/cases/1001")
		await screen.findByText("로그인이 필요합니다.")
		expect(user.queryClient.getQueryData(["case", "1001"])).toBeUndefined()
		expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
	})
	it("me 재확인에서 외부 세션 만료를 발견해도 업무 캐시를 제거한다", async () => {
		const user = renderApp("/cases/1001")
		await screen.findByRole("textbox", { name: "메모 내용" })
		server.use(http.get("*/api/v1/auth/me", () => new HttpResponse(null, { status: 401 })))
		await user.click(screen.getByRole("button", { name: "현재 사용자 확인" }))
		await screen.findByText("로그인이 필요합니다.")
		expect(user.queryClient.getQueryData(["case", "1001"])).toBeUndefined()
	})
	it("백엔드 CONCURRENT_UPDATE에서도 입력을 유지하며 최신 내용을 가져온다", async () => {
		const user = renderApp("/cases/1001")
		const memo = await screen.findByRole("textbox", { name: "메모 내용" })
		await user.type(memo, " 추가 입력")
		server.use(
			http.put("*/api/cases/1001/memo", () =>
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
			http.put("*/api/cases/1001/memo", async () => {
				saveStarted = true
				return await new Promise((resolve) => {
					finishSave = () =>
						resolve(
							HttpResponse.json({ id: "1001", memo: "늦은 저장", case_version: 2 }),
						)
				})
			}),
		)
		const user = renderApp("/cases/1001")
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
		expect(user.queryClient.getQueryData(["case", "1001"])).toBeUndefined()
	})
})

describe("예시 계정 권한과 입력 보호", () => {
	it("승인자 계정으로 전환하면 조사 메모를 편집할 수 없다", async () => {
		const user = renderApp("/cases/1001")
		await screen.findByRole("textbox", { name: "메모 내용" })
		await user.selectOptions(screen.getByLabelText("로컬 테스트 계정"), "apr01")
		await user.click(screen.getByRole("button", { name: "테스트 로그인" }))
		await screen.findByText("예시 apr01 (apr01) · APPROVER")
		expect(await screen.findByText("현재 케이스는 읽기 전용입니다.")).toBeInTheDocument()
		expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
	})
	it("입력 검증 오류를 메모 입력에 연결하며 내용을 유지한다", async () => {
		server.use(
			http.put("*/api/cases/1001/memo", () =>
				HttpResponse.json(
					{
						error: {
							code: "INVALID_REQUEST",
							details: { memo: "메모 길이를 확인하세요" },
						},
					},
					{ status: 400 },
				),
			),
		)
		const user = renderApp("/cases/1001")
		const memo = await screen.findByRole("textbox", { name: "메모 내용" })
		await user.click(screen.getByRole("button", { name: "메모 저장" }))
		await screen.findByText("메모 길이를 확인하세요")
		expect(memo).toHaveAttribute("aria-invalid", "true")
		expect(memo).toHaveAccessibleDescription("메모 길이를 확인하세요")
		expect(memo).toHaveValue("거래 목적 확인 필요")
	})
	it("변경한 메모가 있을 때 새로고침 확인을 요청한다", async () => {
		const user = renderApp("/cases/1001")
		const memo = await screen.findByRole("textbox", { name: "메모 내용" })
		await user.type(memo, " 추가")
		const event = new Event("beforeunload", { cancelable: true })
		window.dispatchEvent(event)
		expect(event.defaultPrevented).toBe(true)
	})
})
