import { describe, expect, it } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"

// 계정 관리 화면 (SCRUM-169, ADM-03, 계약서 5.8). MSW 는 계약서 모양 — BE SCRUM-135 ② 전.
const USERS = {
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
}

function renderApp(who = "admin") {
	resetCases(USERS[who])
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={["/admin/accounts"]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return userEvent.setup()
}

const table = () => screen.findByRole("region", { name: "계정 목록 표" })
async function rowOf(loginId) {
	const cell = await within(await table()).findByRole("cell", { name: loginId })
	return cell.closest("tr")
}
function recordBodies(suffix) {
	const bodies = []
	server.events.on("request:start", async ({ request }) => {
		if (request.method === "POST" && new URL(request.url).pathname.endsWith(suffix))
			bodies.push(await request.clone().json())
	})
	return bodies
}

describe("계정 목록", () => {
	it("기본은 활성만, 조사역 행에 진행 중 담당 건수, 내 계정·SYSTEM 에는 버튼이 없다", async () => {
		const user = renderApp()
		const inv01 = await rowOf("inv01")
		expect(within(inv01).getByText("2")).toBeInTheDocument() // DRAFTED + REVIEWING (APPROVED 는 안 셈)
		expect(within(inv01).getByRole("link", { name: "케이스 보기" })).toHaveAttribute(
			"href",
			"/cases?assignee=inv01",
		)
		expect(within(inv01).getByRole("button", { name: "역할 변경" })).toBeInTheDocument()
		const me = await rowOf("admin")
		expect(within(me).queryByRole("button")).not.toBeInTheDocument()
		expect(within(me).getByText("내 계정")).toBeInTheDocument()
		const apr = await rowOf("apr01")
		expect(within(apr).getAllByText("—").length).toBeGreaterThan(0) // 조사역 아닌 행은 건수 없음
		expect(
			within(await table()).queryByRole("cell", { name: "system" }),
		).not.toBeInTheDocument()

		await user.selectOptions(screen.getByLabelText("상태"), "inactive")
		const system = await rowOf("system")
		expect(within(system).queryByRole("button")).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument()
	})
	it("관리자가 아니면 화면을 볼 수 없다", async () => {
		renderApp("inv01")
		expect(await screen.findByRole("heading", { name: "권한이 없어요" })).toBeInTheDocument()
	})
})

describe("계정 발급", () => {
	it("발급하면 목록에 보이고, 비밀번호는 다시 보여 주지 않는다", async () => {
		const bodies = recordBodies("/admin/users")
		const user = renderApp()
		await table()
		await user.click(screen.getByRole("button", { name: "계정 발급" }))
		const dialog = await screen.findByRole("dialog", { name: "계정 발급" })
		await user.type(within(dialog).getByLabelText("아이디"), "inv03")
		await user.type(within(dialog).getByLabelText("이름"), "조사원 C")
		await user.type(within(dialog).getByLabelText("초기 비밀번호"), "secret-pass-1")
		await user.click(within(dialog).getByRole("button", { name: "발급" }))
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
		expect(
			await screen.findByText(/inv03 계정을 발급했어요. 비밀번호는 다시 보여 주지 않아요./),
		).toBeInTheDocument()
		expect(await rowOf("inv03")).toBeInTheDocument()
		expect(bodies).toEqual([
			{
				login_id: "inv03",
				display_name: "조사원 C",
				role: "INVESTIGATOR",
				initial_password: "secret-pass-1",
			},
		])
		expect(document.body).not.toHaveTextContent("secret-pass-1")
		server.events.removeAllListeners()
	})
	it("입력 규칙은 화면에서 먼저 막고, 409 LOGIN_ID_TAKEN 은 아이디 칸 아래에 입력을 남긴다", async () => {
		const user = renderApp()
		await table()
		await user.click(screen.getByRole("button", { name: "계정 발급" }))
		const dialog = await screen.findByRole("dialog", { name: "계정 발급" })
		const loginId = within(dialog).getByLabelText("아이디")
		await user.type(loginId, "ab")
		await user.type(within(dialog).getByLabelText("초기 비밀번호"), "short")
		await user.click(within(dialog).getByRole("button", { name: "발급" }))
		expect(within(dialog).getByText("아이디는 영문·숫자·_·- 3~64자예요.")).toBeInTheDocument()
		expect(within(dialog).getByText("이름은 1~50자예요.")).toBeInTheDocument()
		expect(within(dialog).getByText("비밀번호는 8~128자예요.")).toBeInTheDocument()
		expect(loginId).toHaveAttribute("aria-invalid", "true")

		await user.clear(loginId)
		await user.type(loginId, "inv02")
		await user.type(within(dialog).getByLabelText("이름"), "중복")
		await user.type(within(dialog).getByLabelText("초기 비밀번호"), "-long-enough")
		await user.click(within(dialog).getByRole("button", { name: "발급" }))
		expect(await within(dialog).findByText("이미 쓰는 아이디예요.")).toBeInTheDocument()
		expect(loginId).toHaveValue("inv02")
		expect(screen.getByRole("dialog", { name: "계정 발급" })).toBeInTheDocument()
	})
})

describe("역할 변경", () => {
	it("진행 중 담당이 남은 조사역은 409 — N건 안내와 [담당 케이스 보기]", async () => {
		const user = renderApp()
		await user.click(within(await rowOf("inv01")).getByRole("button", { name: "역할 변경" }))
		const dialog = await screen.findByRole("dialog", { name: "역할 변경" })
		expect(dialog).toHaveTextContent("조사역 → 승인자")
		expect(dialog).toHaveTextContent("로그인이 끊겨")
		expect(dialog).toHaveTextContent("이 사람이 담당했던 케이스는 승인할 수 없어요.")
		await user.click(within(dialog).getByRole("button", { name: "변경" }))
		expect(
			await within(dialog).findByText(
				/진행 중인 담당 케이스가 2건 있어요. 먼저 담당자를 바꿔 주세요./,
			),
		).toBeInTheDocument()
		expect(within(dialog).getByRole("link", { name: "담당 케이스 보기" })).toHaveAttribute(
			"href",
			"/cases?assignee=inv01",
		)
		expect(within(dialog).getByRole("button", { name: "변경" })).toBeDisabled()
	})
	it("담당이 없으면 조사역 → 승인자로 바뀐다, 관리자 행에는 역할 변경이 없다", async () => {
		const bodies = recordBodies("/change-role")
		const user = renderApp()
		await user.click(within(await rowOf("inv02")).getByRole("button", { name: "역할 변경" }))
		const dialog = await screen.findByRole("dialog", { name: "역할 변경" })
		await user.click(within(dialog).getByRole("button", { name: "변경" }))
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
		await waitFor(async () =>
			expect(within(await rowOf("inv02")).getByText("승인자")).toBeInTheDocument(),
		)
		expect(bodies).toEqual([{ role: "APPROVER" }])
		server.events.removeAllListeners()
	})
})

describe("비활성화·재활성화·비밀번호 초기화", () => {
	it("비활성화는 막지 않고, 끝난 뒤 진행 중 담당 N건과 [케이스 보기]를 알린다 — 비활성 목록에서 재활성화", async () => {
		const user = renderApp()
		await user.click(within(await rowOf("inv01")).getByRole("button", { name: "비활성화" }))
		const dialog = await screen.findByRole("dialog", { name: "계정 비활성화" })
		await user.click(within(dialog).getByRole("button", { name: "비활성화" }))
		const notice = await screen.findByText(
			/예시 inv01 계정을 비활성화했어요. 진행 중 담당 2건이 남았어요/,
		)
		expect(
			within(notice.closest("[role=status]")).getByRole("link", { name: "케이스 보기" }),
		).toHaveAttribute("href", "/cases?assignee=inv01")
		await waitFor(async () =>
			expect(
				within(await table()).queryByRole("cell", { name: "inv01" }),
			).not.toBeInTheDocument(),
		)

		await user.selectOptions(screen.getByLabelText("상태"), "inactive")
		await user.click(within(await rowOf("inv01")).getByRole("button", { name: "재활성화" }))
		await user.click(
			within(await screen.findByRole("dialog", { name: "계정 재활성화" })).getByRole(
				"button",
				{
					name: "재활성화",
				},
			),
		)
		expect(await screen.findByText("예시 inv01 계정을 다시 활성화했어요.")).toBeInTheDocument()
	})
	it("비밀번호 초기화는 8~128자를 먼저 검사하고, 보낸 뒤 입력을 비운다", async () => {
		const bodies = recordBodies("/reset-password")
		const user = renderApp()
		await user.click(
			within(await rowOf("apr01")).getByRole("button", { name: "비밀번호 초기화" }),
		)
		const dialog = await screen.findByRole("dialog", { name: "비밀번호 초기화" })
		await user.type(within(dialog).getByLabelText("새 비밀번호"), "short")
		await user.click(within(dialog).getByRole("button", { name: "초기화" }))
		expect(within(dialog).getByText("비밀번호는 8~128자예요.")).toBeInTheDocument()
		expect(bodies).toEqual([])
		await user.type(within(dialog).getByLabelText("새 비밀번호"), "-now-long")
		await user.click(within(dialog).getByRole("button", { name: "초기화" }))
		expect(await screen.findByText("예시 apr01의 비밀번호를 초기화했어요.")).toBeInTheDocument()
		expect(bodies).toEqual([{ new_password: "short-now-long" }])
		server.events.removeAllListeners()
	})
})
