import { afterEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { MOCK_PASSWORD, resetCases } from "../mocks/handlers"
import {
	appNavigation,
	menusForRole,
	visibleMenus,
	homePathFor,
} from "../app/navigation/appNavigation"
import ToastProvider from "../shared/ui/toast/ToastProvider"
import { useToast } from "../shared/ui/toast/useToast"

const USERS = {
	inv01: { id: "1", login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	apr01: { id: "3", login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" },
	admin: { id: "4", login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}

function renderApp(path, who) {
	if (who) resetCases(USERS[who])
	else resetCases(null)
	const qc = createQueryClient()
	render(
		<QueryClientProvider client={qc}>
			<MemoryRouter initialEntries={[path]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return userEvent.setup()
}

describe("appNavigation 표", () => {
	it("대시보드 뒤에 관리자 업무 메뉴가 기존 순서로 나온다", () => {
		const list = menusForRole("ADMIN")
		expect(list.map((m) => m.id)).toEqual([
			"overview",
			"batches",
			"alerts",
			"cases",
			"approvals",
			"rules",
			"audit",
			"accounts",
		])
		expect(list.map((m) => m.label)).toEqual([
			"업무 대시보드",
			"데이터·배치 운영",
			"경보 점검",
			"조사 케이스",
			"승인함",
			"탐지 룰",
			"감사 기록",
			"계정 관리",
		])
	})
	it("조사역은 대시보드와 조사 케이스 접근 가능", () => {
		expect(menusForRole("INVESTIGATOR").map((m) => m.id)).toEqual(["overview", "cases"])
	})
	it("승인자는 대시보드 다음 승인함·조사 케이스", () => {
		expect(menusForRole("APPROVER").map((m) => m.id)).toEqual([
			"overview",
			"approvals",
			"cases",
		])
	})
	it("각 항목에 설계서 화면 ID가 있다", () => {
		const by = Object.fromEntries(appNavigation.map((m) => [m.id, m.screenId]))
		expect(by.batches).toBe("ADM-01")
		expect(by.cases).toBe("CASE-01")
		expect(by.approvals).toBe("APR-01")
		expect(by.accounts).toBe("ADM-03")
	})
	it("대시보드·배치·조사 케이스·승인함·감사 기록·계정 관리가 ready: true", () => {
		expect(appNavigation.filter((m) => m.ready).map((m) => m.id)).toEqual([
			"overview",
			"batches",
			"cases",
			"approvals",
			"audit",
			"accounts",
		])
	})
})

describe("visibleMenus — ready:true만 노출", () => {
	it("관리자 visibleMenus는 대시보드·배치·조사 케이스·승인함·감사 기록·계정 관리", () => {
		expect(visibleMenus("ADMIN").map((m) => m.id)).toEqual([
			"overview",
			"batches",
			"cases",
			"approvals",
			"audit",
			"accounts",
		])
	})
	it("승인자 visibleMenus는 대시보드 다음 승인함·조사 케이스 — 승인함이 먼저(SCRUM-241)", () => {
		expect(visibleMenus("APPROVER").map((m) => m.id)).toEqual([
			"overview",
			"approvals",
			"cases",
		])
	})
})

describe("homePathFor — COM-01 첫 화면 규칙", () => {
	it("관리자는 /admin/batches, 조사역은 /cases, 승인자는 /approvals로 간다", () => {
		expect(homePathFor("ADMIN")).toBe("/admin/batches")
		expect(homePathFor("INVESTIGATOR")).toBe("/cases")
		expect(homePathFor("APPROVER")).toBe("/approvals")
	})
	it("ADM-01을 ready:false로 바꾸면 관리자 home은 첫 ready 메뉴(/cases)", () => {
		const nav = appNavigation.map((m) => (m.screenId === "ADM-01" ? { ...m, ready: false } : m))
		expect(homePathFor("ADMIN", nav)).toBe("/cases")
		// 조사역은 /cases, 승인자는 /approvals 그대로
		expect(homePathFor("INVESTIGATOR", nav)).toBe("/cases")
		expect(homePathFor("APPROVER", nav)).toBe("/approvals")
	})
})

describe("앱 셸 — 사용자 흐름", () => {
	it("admin 로그인 상태면 사이드바에 준비된 관리자 메뉴가 보이고 미완성 메뉴는 숨겨진다", async () => {
		renderApp("/cases", "admin")
		const nav = await screen.findByRole("navigation", { name: "주요 메뉴" })
		await waitFor(() =>
			expect(within(nav).getByRole("link", { name: "조사 케이스" })).toBeInTheDocument(),
		)
		expect(within(nav).getByRole("link", { name: "데이터·배치 운영" })).toHaveAttribute(
			"href",
			"/admin/batches",
		)
		expect(within(nav).getByRole("link", { name: "감사 기록" })).toHaveAttribute(
			"href",
			"/admin/audit",
		)
		expect(within(nav).getByRole("link", { name: "계정 관리" })).toHaveAttribute(
			"href",
			"/admin/accounts",
		)
		expect(within(nav).queryByRole("link", { name: "경보 점검" })).not.toBeInTheDocument()
		expect(within(nav).queryByRole("link", { name: "탐지 룰" })).not.toBeInTheDocument()
		expect(within(nav).getByRole("link", { name: "승인함" })).toHaveAttribute(
			"href",
			"/approvals",
		)
	})

	it("inv01이 /admin/batches를 직접 열면 '권한이 없어요'가 보이고 리디렉션하지 않는다", async () => {
		renderApp("/admin/batches", "inv01")
		expect(await screen.findByRole("heading", { name: "권한이 없어요" })).toBeInTheDocument()
	})

	it("inv01이 /approvals를 직접 열면 '권한이 없어요'가 보인다", async () => {
		renderApp("/approvals", "inv01")
		expect(await screen.findByRole("heading", { name: "권한이 없어요" })).toBeInTheDocument()
	})

	it("계정을 바꾸면 메뉴가 새 역할 기준으로 다시 그려진다", async () => {
		const user = renderApp("/cases", "inv01")
		const nav = await screen.findByRole("navigation", { name: "주요 메뉴" })
		await waitFor(() =>
			expect(within(nav).getByRole("link", { name: "조사 케이스" })).toBeInTheDocument(),
		)
		expect(within(nav).queryByRole("link", { name: "계정 관리" })).not.toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: "로그아웃" }))
		await screen.findByLabelText("아이디")
		await user.type(screen.getByLabelText("아이디"), "admin")
		await user.type(screen.getByLabelText("비밀번호"), MOCK_PASSWORD)
		await user.click(screen.getByRole("button", { name: "로그인" }))
		await waitFor(() => expect(screen.getByText(/예시 admin/)).toBeInTheDocument())
		const nav2 = screen.getByRole("navigation", { name: "주요 메뉴" })
		expect(within(nav2).getByRole("link", { name: "조사 케이스" })).toBeInTheDocument()
		// 관리자로 바뀌면 관리자 메뉴가 보이고, 조사역 때는 없었음
		expect(within(nav2).getByRole("link", { name: "계정 관리" })).toBeInTheDocument()
	})

	it("로그인 상태에서 /로 들어가면 일반 대시보드로 간다", async () => {
		renderApp("/", "admin")
		await screen.findByRole("heading", { name: "관리자 대시보드" })
	})

	it("로그인 전 첫 진입은 대시보드 경로에서 로그인 화면을 보여 준다", async () => {
		renderApp("/", null)
		// 세션 확인 뒤 로그인 폼만 표시
		await screen.findByLabelText("아이디")
	})
})

describe("사이드바 접기·펼치기(SCRUM-327)", () => {
	afterEach(() => localStorage.clear())

	it("닫기 버튼으로 접으면 알약이 나타나고, 열기 버튼으로 다시 펼친다", async () => {
		const user = renderApp("/cases", "inv01")
		const close = await screen.findByRole("button", { name: "사이드바 닫기" })
		expect(close).toHaveAttribute("aria-expanded", "true")
		expect(close).toHaveAttribute("aria-controls", "app-sidebar")

		await user.click(close)
		const open = screen.getByRole("button", { name: "사이드바 열기" })
		expect(open).toHaveAttribute("aria-expanded", "false")
		expect(open).toHaveFocus()
		expect(screen.getByRole("link", { name: "DAJABA 업무 대시보드" })).toHaveAttribute(
			"href",
			"/overview",
		)
		expect(document.querySelector(".app-shell")).toHaveClass("is-sidebar-collapsed")
		expect(localStorage.getItem("dajaba.sidebar.v1")).toBe("collapsed")

		await user.click(open)
		expect(screen.queryByRole("button", { name: "사이드바 열기" })).toBeNull()
		expect(screen.getByRole("button", { name: "사이드바 닫기" })).toHaveFocus()
		expect(document.querySelector(".app-shell")).not.toHaveClass("is-sidebar-collapsed")
		expect(localStorage.getItem("dajaba.sidebar.v1")).toBeNull()
	})

	it("Ctrl+B로 열고 닫는다", async () => {
		const user = renderApp("/cases", "inv01")
		await screen.findByRole("button", { name: "사이드바 닫기" })
		await user.keyboard("{Control>}b{/Control}")
		expect(screen.getByRole("button", { name: "사이드바 열기" })).toBeInTheDocument()
		await user.keyboard("{Control>}b{/Control}")
		expect(screen.queryByRole("button", { name: "사이드바 열기" })).toBeNull()
	})

	it("글을 쓰는 칸이나 확인창이 열려 있을 때 Ctrl+B는 사이드바를 건드리지 않는다", async () => {
		const user = renderApp("/cases", "inv01")
		await screen.findByRole("button", { name: "사이드바 닫기" })
		const memo = document.createElement("textarea")
		document.body.appendChild(memo)
		memo.focus()
		await user.keyboard("{Control>}b{/Control}")
		expect(screen.queryByRole("button", { name: "사이드바 열기" })).toBeNull()
		memo.remove()

		const dialog = document.createElement("div")
		dialog.setAttribute("role", "dialog")
		document.body.appendChild(dialog)
		await user.keyboard("{Control>}b{/Control}")
		expect(screen.queryByRole("button", { name: "사이드바 열기" })).toBeNull()
		dialog.remove()
	})

	it("좁은 화면에서는 Ctrl+B가 접힘 상태를 바꾸거나 저장하지 않는다", async () => {
		const original = window.matchMedia
		window.matchMedia = (query) => ({
			matches: false,
			media: query,
			addEventListener() {},
			removeEventListener() {},
		})
		try {
			const user = renderApp("/cases", "inv01")
			await screen.findByRole("button", { name: "사이드바 닫기" })
			await user.keyboard("{Control>}b{/Control}")
			expect(screen.queryByRole("button", { name: "사이드바 열기" })).toBeNull()
			expect(localStorage.getItem("dajaba.sidebar.v1")).toBeNull()
		} finally {
			window.matchMedia = original
		}
	})

	it("접은 상태는 다시 열어도 유지된다", async () => {
		localStorage.setItem("dajaba.sidebar.v1", "collapsed")
		renderApp("/cases", "inv01")
		expect(await screen.findByRole("button", { name: "사이드바 열기" })).toBeInTheDocument()
		expect(document.querySelector(".app-shell")).toHaveClass("is-sidebar-collapsed")
	})
})

describe("안내 띠(GuideBar)", () => {
	it("조사역 케이스 목록에서 첫 단계와 다음 행동이 보인다", async () => {
		renderApp("/cases", "inv01")
		const bar = await screen.findByRole("status", { name: "다음 할 일 안내" })
		await waitFor(() =>
			expect(within(bar).getByText(/1\. 케이스 확인.*내 담당 케이스/)).toBeInTheDocument(),
		)
	})
	it("관리자 기본 문구는 데이터·케이스·배정 톤", async () => {
		renderApp("/cases", "admin")
		const bar = await screen.findByRole("status", { name: "다음 할 일 안내" })
		await waitFor(() =>
			expect(within(bar).getByText(/데이터를 적재하고 케이스를 만든 뒤/)).toBeInTheDocument(),
		)
	})
	it("승인자 기본 문구는 승인함 안내", async () => {
		renderApp("/cases", "apr01")
		const bar = await screen.findByRole("status", { name: "다음 할 일 안내" })
		await waitFor(() =>
			expect(within(bar).getByText(/승인함에서 확인할 수 있어요/)).toBeInTheDocument(),
		)
	})
	it("[전체 흐름] 버튼을 누르면 흐름 데모 4단계가 보이고, 시연 전용 콜아웃은 없다", async () => {
		const user = renderApp("/cases", "inv01")
		await screen.findByRole("status", { name: "다음 할 일 안내" })
		await user.click(screen.getByRole("button", { name: "전체 흐름" }))
		const dialog = await screen.findByRole("dialog", {
			name: /한 건의 업무를 끝까지 따라가는 방법/,
		})
		expect(within(dialog).getByRole("heading", { name: /1\. 관리자/ })).toBeInTheDocument()
		expect(within(dialog).getByRole("heading", { name: /2\. 조사역/ })).toBeInTheDocument()
		expect(
			within(dialog).getByRole("heading", { name: /3\. STR 작성·검증/ }),
		).toBeInTheDocument()
		expect(within(dialog).getByRole("heading", { name: /4\. 승인자/ })).toBeInTheDocument()
		// 시연 전용 콜아웃("이 데모는 ... 변경하지 않습니다.") 없어야 함
		expect(within(dialog).queryByText(/이 데모는/)).not.toBeInTheDocument()
		// 데모 전용 "역할 전환" 안내문도 없어야 함
		expect(within(dialog).queryByText(/역할 전환/)).not.toBeInTheDocument()
	})
})

describe("알림(Toast)", () => {
	function Harness() {
		const { show } = useToast()
		return (
			<>
				<button onClick={() => show({ tone: "info", text: "첫 번째" })}>show1</button>
				<button onClick={() => show({ tone: "error", text: "두 번째" })}>show2</button>
			</>
		)
	}
	afterEach(() => vi.useRealTimers())

	it("새 알림이 이전 알림을 교체한다(쌓지 않음)", async () => {
		const u = userEvent.setup()
		render(
			<ToastProvider>
				<Harness />
			</ToastProvider>,
		)
		await u.click(screen.getByRole("button", { name: "show1" }))
		expect(screen.getByText("첫 번째")).toBeInTheDocument()
		await u.click(screen.getByRole("button", { name: "show2" }))
		await waitFor(() => expect(screen.queryByText("첫 번째")).not.toBeInTheDocument())
		expect(screen.getByText("두 번째")).toBeInTheDocument()
	})
	it("5초 뒤 사라진다", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true })
		const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
		render(
			<ToastProvider>
				<Harness />
			</ToastProvider>,
		)
		await u.click(screen.getByRole("button", { name: "show1" }))
		expect(screen.getByText("첫 번째")).toBeInTheDocument()
		await act(async () => {
			vi.advanceTimersByTime(5000)
		})
		expect(screen.queryByText("첫 번째")).not.toBeInTheDocument()
	})
	it("오류 톤은 role='alert'", async () => {
		const u = userEvent.setup()
		render(
			<ToastProvider>
				<Harness />
			</ToastProvider>,
		)
		await u.click(screen.getByRole("button", { name: "show2" }))
		expect(screen.getByRole("alert")).toHaveTextContent("두 번째")
	})
})
