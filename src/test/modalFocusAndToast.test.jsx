import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { MOCK_PASSWORD, resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"
import Modal from "../shared/ui/dashboard/Modal"

const modalCss = readFileSync(resolve("src/shared/ui/dashboard/modal.css"), "utf8")
const appCss = readFileSync(resolve("src/app/styles/app.css"), "utf8")

const USERS = {
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
}

function renderApp(path, who = "admin") {
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

afterEach(() => server.events.removeAllListeners())

describe("확인창 포커스 복귀 (SCRUM-203)", () => {
	// 되돌릴 버튼이 사라져도 포커스가 body로 떨어지지 않도록, 원래 조작 요소를 렌더 단계에서 잡아요.
	it("[계정 발급] → Esc → 원래 [계정 발급] 버튼에 포커스", async () => {
		const user = renderApp("/admin/accounts")
		await screen.findByRole("region", { name: "계정 목록 표" })
		const opener = screen.getByRole("button", { name: "계정 발급" })
		await user.click(opener)
		await screen.findByRole("dialog", { name: "계정 발급" })
		await user.keyboard("{Escape}")
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
		expect(opener).toHaveFocus()
	})

	it("[취소]로 닫아도 원래 버튼에 포커스", async () => {
		const user = renderApp("/admin/accounts")
		await screen.findByRole("region", { name: "계정 목록 표" })
		const opener = screen.getByRole("button", { name: "계정 발급" })
		await user.click(opener)
		const dialog = await screen.findByRole("dialog", { name: "계정 발급" })
		await user.click(within(dialog).getByRole("button", { name: "취소" }))
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
		expect(opener).toHaveFocus()
	})

	it("[닫기] 아이콘으로 닫아도 원래 버튼에 포커스", async () => {
		const user = renderApp("/admin/accounts")
		await screen.findByRole("region", { name: "계정 목록 표" })
		const opener = screen.getByRole("button", { name: "계정 발급" })
		await user.click(opener)
		const dialog = await screen.findByRole("dialog", { name: "계정 발급" })
		await user.click(within(dialog).getByRole("button", { name: "닫기" }))
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
		expect(opener).toHaveFocus()
	})
})

describe("확인창 처음 포커스 규칙 (SCRUM-203)", () => {
	// [확인]이 disabled가 아니면 그대로 [확인]에 — 팀원들이 이번 주에 붙이는 확인창 흐름을 유지.
	it("기본은 [확인]에 포커스", () => {
		render(
			<Modal
				title="t"
				onClose={() => {}}
				footer={
					<>
						<button type="button">취소</button>
						<button type="button" className="primary">
							확인
						</button>
					</>
				}
			>
				<p>본문</p>
			</Modal>,
		)
		expect(screen.getByRole("button", { name: "확인" })).toHaveFocus()
	})

	it("[확인]이 disabled면 본문 첫 조작 요소에 포커스 ([닫기] 아이콘 아님)", () => {
		render(
			<Modal
				title="t"
				onClose={() => {}}
				footer={
					<>
						<button type="button">취소</button>
						<button type="button" className="primary" disabled>
							변경
						</button>
					</>
				}
			>
				<label htmlFor="pick">새 담당 조사역</label>
				<select id="pick" defaultValue="">
					<option value="">선택</option>
					<option value="a">A</option>
				</select>
			</Modal>,
		)
		expect(screen.getByLabelText("새 담당 조사역")).toHaveFocus()
	})

	it("부른 쪽에서 autoFocus 를 주면 그대로 둔다 (본문 textarea)", () => {
		render(
			<Modal
				title="t"
				onClose={() => {}}
				footer={
					<>
						<button type="button">취소</button>
						<button type="button" className="primary">
							확인
						</button>
					</>
				}
			>
				<label htmlFor="memo">메모</label>
				<textarea id="memo" autoFocus />
			</Modal>,
		)
		expect(screen.getByLabelText("메모")).toHaveFocus()
	})

	it("본문에 입력칸이 있으면 [확인]이 켜져 있어도 첫 입력칸에 포커스 (예: 계정 발급)", () => {
		render(
			<Modal
				title="계정 발급"
				onClose={() => {}}
				footer={
					<>
						<button type="button">취소</button>
						<button type="button" className="primary">
							발급
						</button>
					</>
				}
			>
				<label htmlFor="login-id">아이디</label>
				<input id="login-id" />
				<label htmlFor="display-name">이름</label>
				<input id="display-name" />
				<label htmlFor="role">역할</label>
				<select id="role" defaultValue="INVESTIGATOR">
					<option value="INVESTIGATOR">조사역</option>
				</select>
				<label htmlFor="pw">초기 비밀번호</label>
				<input id="pw" type="password" />
			</Modal>,
		)
		expect(screen.getByLabelText("아이디")).toHaveFocus()
	})

	it("[확인] disabled + 본문에 조작 요소가 없으면 [취소]에 포커스", () => {
		render(
			<Modal
				title="t"
				onClose={() => {}}
				footer={
					<>
						<button type="button">취소</button>
						<button type="button" className="primary" disabled>
							확인
						</button>
					</>
				}
			>
				<p>안내만</p>
			</Modal>,
		)
		expect(screen.getByRole("button", { name: "취소" })).toHaveFocus()
	})

	it("담당자 변경 확인창(실제 흐름 · confirmDisabled)에서 처음 포커스가 본문 담당자 select에 간다", async () => {
		const user = renderApp("/cases/CASE-2022-001004", "admin")
		// 처음 열면 조사역 목록을 불러오는 중이라 캐시를 미리 채우고 다시 엽니다.
		await user.click(await screen.findByRole("button", { name: "담당자 변경" }))
		let dialog = await screen.findByRole("dialog", { name: "담당자 변경" })
		await within(dialog).findByLabelText("새 담당 조사역")
		await user.keyboard("{Escape}")
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
		await user.click(screen.getByRole("button", { name: "담당자 변경" }))
		dialog = await screen.findByRole("dialog", { name: "담당자 변경" })
		const select = within(dialog).getByLabelText("새 담당 조사역")
		expect(select).toHaveFocus()
	})
})

describe("세션이 바뀌면 알림을 비운다 (SCRUM-203)", () => {
	async function showToast(user) {
		// 계정 발급을 완료하면 info 토스트가 떠요. 이 흐름으로 세션 전환 전 알림을 띄워요.
		await user.click(screen.getByRole("button", { name: "계정 발급" }))
		const dialog = await screen.findByRole("dialog", { name: "계정 발급" })
		await user.type(within(dialog).getByLabelText("아이디"), "inv09")
		await user.type(within(dialog).getByLabelText("이름"), "조사원 Z")
		await user.type(within(dialog).getByLabelText("초기 비밀번호"), "secret-pass-1")
		await user.click(within(dialog).getByRole("button", { name: "발급" }))
		await screen.findByText(/inv09 계정을 발급했어요/)
	}

	it("로그아웃하면 이전 알림이 사라진다", async () => {
		const user = renderApp("/admin/accounts")
		await screen.findByRole("region", { name: "계정 목록 표" })
		await showToast(user)
		await user.click(screen.getByRole("button", { name: "로그아웃" }))
		await waitFor(() =>
			expect(screen.queryByText(/inv09 계정을 발급했어요/)).not.toBeInTheDocument(),
		)
	})

	it("다른 계정으로 전환하면 이전 알림이 사라진다", async () => {
		const user = renderApp("/admin/accounts")
		await screen.findByRole("region", { name: "계정 목록 표" })
		await showToast(user)
		await user.click(screen.getByRole("button", { name: "로그아웃" }))
		await screen.findByLabelText("아이디")
		await user.type(screen.getByLabelText("아이디"), "inv01")
		await user.type(screen.getByLabelText("비밀번호"), MOCK_PASSWORD)
		await user.click(screen.getByRole("button", { name: "로그인" }))
		await screen.findByText(/예시 inv01/)
		expect(screen.queryByText(/inv09 계정을 발급했어요/)).not.toBeInTheDocument()
	})

	it("401로 세션이 끊기면 이전 알림이 사라진다", async () => {
		const user = renderApp("/admin/accounts")
		await screen.findByRole("region", { name: "계정 목록 표" })
		await showToast(user)
		server.use(
			http.get("*/api/v1/auth/me", () =>
				HttpResponse.json(
					{ error: { code: "UNAUTHENTICATED", message: "", details: {} } },
					{ status: 401 },
				),
			),
		)
		await user.click(screen.getByRole("button", { name: "현재 사용자 확인" }))
		await screen.findByText(/로그인이 필요합니다/)
		expect(screen.queryByText(/inv09 계정을 발급했어요/)).not.toBeInTheDocument()
	})
})

describe("모달 공통 스타일 (SCRUM-203)", () => {
	// 시연 색 변수(.dashboard-demo)가 없는 실제 화면에서도 모달이 배경을 막고 가운데 떠야 해요.
	it("모달 기본 규칙이 .dashboard-demo 접두사 없이 존재한다", () => {
		expect(modalCss).toMatch(/^\s*\.modal-backdrop\s*\{/m)
		expect(modalCss).toMatch(/^\s*\.modal\s*\{/m)
		expect(modalCss).toMatch(/^\s*\.modal\s*>\s*header\s*\{/m)
		expect(modalCss).toMatch(/^\s*\.modal-body\s*\{/m)
		expect(modalCss).toMatch(/^\s*\.modal\s*>\s*footer\s*\{/m)
		expect(modalCss).not.toMatch(/\.dashboard-demo\s+\.modal/)
	})

	it("배경 차단과 가운데 고정을 켜 둔다", () => {
		expect(modalCss).toMatch(/\.modal-backdrop[\s\S]*?position:\s*fixed/)
		expect(modalCss).toMatch(/\.modal-backdrop[\s\S]*?inset:\s*0/)
		expect(modalCss).toMatch(/\.modal-backdrop[\s\S]*?place-items:\s*center/)
	})

	it("알림이 모달 위에 뜬다 (z-index: 토스트 > 모달)", () => {
		const modalZ = Number(modalCss.match(/\.modal-backdrop[\s\S]*?z-index:\s*(\d+)/)?.[1])
		const toastZ = Number(appCss.match(/\.toast-area[\s\S]*?z-index:\s*(\d+)/)?.[1])
		expect(toastZ).toBeGreaterThan(modalZ)
	})
})
