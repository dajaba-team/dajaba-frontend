import { afterEach, describe, expect, it } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { delay, http, HttpResponse } from "msw"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"

// 위 띠 로그아웃 실패 표시(9/7 점검 BH-FE-05) — 로그아웃이 실패하면 위 띠 메뉴 안에 오류를 보여 주고,
// me 를 다시 확인해요. 본문은 가리지 않아요(아직 로그인 상태가 맞으면 정상).
const INV01 = { id: "1", login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" }

function renderSignedIn() {
	resetCases(INV01)
	let meCalls = 0
	server.events.on("request:start", ({ request }) => {
		if (request.method === "GET" && new URL(request.url).pathname.endsWith("/auth/me"))
			meCalls += 1
	})
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={["/cases"]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return { user: userEvent.setup(), meCalls: () => meCalls }
}
const headerMenu = () => document.querySelector(".app-header .persona-menu")

describe("위 띠 로그아웃 실패 (BH-FE-05)", () => {
	afterEach(() => server.events.removeAllListeners())

	it.each([
		[
			"500",
			() => new HttpResponse(null, { status: 500 }),
			"요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
		],
		[
			"네트워크 오류",
			() => HttpResponse.error(),
			"서버 응답을 확인하지 못했습니다. 저장 요청이었다면 최신 내용을 확인한 후 다시 시도해 주세요.",
		],
	])(
		"로그아웃 %s → 위 띠 메뉴에 오류, 다시 누를 수 있고 본문은 그대로",
		async (_, reply, text) => {
			server.use(http.post("*/api/v1/auth/logout", reply))
			const { user, meCalls } = renderSignedIn()
			await screen.findByRole("navigation", { name: "주요 메뉴" })
			const before = meCalls()
			await user.click(within(headerMenu()).getByRole("button", { name: "로그아웃" }))

			const alert = await within(headerMenu()).findByRole("alert")
			expect(alert).toHaveTextContent(text)
			// 실패하면 me 를 한 번 더 확인해요 — 세션이 아직 살아 있으면 위 띠 그대로
			await waitFor(() => expect(meCalls()).toBeGreaterThan(before))
			expect(within(headerMenu()).getByRole("button", { name: "로그아웃" })).toBeEnabled()
			expect(document.querySelector(".app-header")).toHaveTextContent("inv01")
			expect(screen.getByRole("navigation", { name: "주요 메뉴" })).toBeInTheDocument()
			expect(screen.queryByLabelText("아이디")).toBeNull()
		},
	)

	it("다시 확인하는 me 가 늦어도 오류 문구는 바로 보이고 버튼 문구도 바로 돌아온다", async () => {
		const { user } = renderSignedIn()
		await screen.findByRole("navigation", { name: "주요 메뉴" })
		server.use(
			http.post("*/api/v1/auth/logout", () => new HttpResponse(null, { status: 500 })),
			http.get("*/api/v1/auth/me", async () => {
				await delay("infinite")
			}),
		)
		await user.click(within(headerMenu()).getByRole("button", { name: "로그아웃" }))
		expect(await within(headerMenu()).findByRole("alert")).toHaveTextContent(
			"요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
		)
		expect(within(headerMenu()).getByRole("button", { name: "로그아웃" })).toHaveTextContent(
			"로그아웃",
		)
	})

	it("로그아웃은 실패했지만 세션이 이미 끝났으면(me 401) 기존 흐름대로 로그인 화면", async () => {
		server.use(
			http.post("*/api/v1/auth/logout", () => {
				resetCases(null)
				return new HttpResponse(null, { status: 500 })
			}),
		)
		const { user } = renderSignedIn()
		await screen.findByRole("navigation", { name: "주요 메뉴" })
		await user.click(within(headerMenu()).getByRole("button", { name: "로그아웃" }))
		expect(await screen.findByLabelText("아이디")).toBeInTheDocument()
		expect(document.querySelector(".app-header")).toBeNull()
	})

	it("로그아웃 성공 → 기존 동작 그대로(로그인 화면, 위 띠·오류 없음)", async () => {
		const { user } = renderSignedIn()
		await screen.findByRole("navigation", { name: "주요 메뉴" })
		await user.click(within(headerMenu()).getByRole("button", { name: "로그아웃" }))
		expect(await screen.findByLabelText("아이디")).toBeInTheDocument()
		expect(document.querySelector(".app-header")).toBeNull()
		expect(screen.queryByRole("alert")).toBeNull()
	})
})
