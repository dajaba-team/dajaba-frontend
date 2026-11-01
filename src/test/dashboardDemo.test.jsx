import { describe, expect, it } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation, useNavigate } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"

function NavigationProbe() {
	const location = useLocation()
	const navigate = useNavigate()
	return (
		<>
			<output data-testid="location">
				{location.pathname}
				{location.search}
			</output>
			<button onClick={() => navigate(-1)}>이전 경로</button>
			<button onClick={() => navigate("/demo/admin/batches")}>관리자 경로 직접 접근</button>
		</>
	)
}
function renderDemo(path = "/demo/overview") {
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={[path]}>
				<NavigationProbe />
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return userEvent.setup()
}
const role = async (user, value) =>
	user.selectOptions(await screen.findByLabelText("역할 전환"), value)

describe("대시보드 URL과 화면 분리", () => {
	it("메뉴를 URL로 이동하고 뒤로가기로 이전 화면을 복원한다", async () => {
		const user = renderDemo("/demo")
		await screen.findByRole("heading", {
			name: "합성 데이터 기반 AML 조사·STR 작성 지원 시스템",
		})
		expect(screen.getByTestId("location")).toHaveTextContent("/demo/overview")
		await user.click(screen.getByRole("link", { name: "경보 점검" }))
		await screen.findByRole("heading", { name: "경보 점검" })
		expect(screen.getByTestId("location")).toHaveTextContent("/demo/admin/alerts")
		await user.click(screen.getByRole("button", { name: "이전 경로" }))
		expect(
			await screen.findByRole("heading", {
				name: "합성 데이터 기반 AML 조사·STR 작성 지원 시스템",
			}),
		).toBeInTheDocument()
	})
	it("직접 접근한 케이스 ID를 확인하고 잘못된 ID는 다른 케이스로 대체하지 않는다", async () => {
		renderDemo("/demo/cases/unknown")
		expect(
			await screen.findByRole("heading", { name: "케이스를 찾을 수 없습니다." }),
		).toBeInTheDocument()
	})
	it("메뉴뿐 아니라 직접 접근한 관리자 경로에서도 역할을 검사한다", async () => {
		const user = renderDemo()
		await role(user, "INVESTIGATOR")
		await user.click(screen.getByRole("button", { name: "관리자 경로 직접 접근" }))
		expect(
			await screen.findByRole("heading", { name: "접근 권한이 없습니다." }),
		).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "실행" })).not.toBeInTheDocument()
	})
	it("경보 검색과 점수 필터를 URL에 보관한다", async () => {
		const user = renderDemo("/demo/admin/alerts")
		await user.selectOptions(await screen.findByLabelText("점수 상태"), "FAILED")
		expect(screen.getByTestId("location")).toHaveTextContent("score_status=FAILED")
		expect(screen.getByText("ALT-20220902-000143")).toBeInTheDocument()
		expect(screen.queryByText("ALT-20220902-000142")).not.toBeInTheDocument()
		await user.type(screen.getByRole("textbox", { name: "경보 검색" }), "없는계좌")
		expect(await screen.findByText("조건에 맞는 경보가 없습니다.")).toBeInTheDocument()
	})
	it("상세 그래프를 키보드로 선택하고 모달을 Escape로 닫을 수 있다", async () => {
		const user = renderDemo("/demo/cases/CASE-2022-000057")
		const graphItems = await screen.findAllByRole("button", {
			name: "거래 TX-220902-4702 선택",
		})
		graphItems[0].focus()
		await user.keyboard("{Enter}")
		expect(screen.getByRole("heading", { name: "자금 흐름 그래프" })).toBeInTheDocument()
		await user.click(screen.getByRole("link", { name: "경보 점검" }))
		const trigger = screen.getAllByRole("button", { name: "상세 보기" })[0]
		await user.click(trigger)
		expect(await screen.findByRole("dialog")).toHaveAccessibleName(
			"경보 상세 · ALT-20220902-000142",
		)
		await user.keyboard("{Escape}")
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		expect(trigger).toHaveFocus()
	})
})

describe("이관한 업무 시연", () => {
	it("배정부터 수동 검증·승인까지 연결하고 승인 문서를 잠근다", async () => {
		const user = renderDemo("/demo/cases")
		await role(user, "INVESTIGATOR")
		await user.click(await screen.findByRole("button", { name: "내게 배정" }))
		await waitFor(() =>
			expect(screen.queryByRole("button", { name: "내게 배정" })).not.toBeInTheDocument(),
		)
		await user.click(screen.getByRole("button", { name: "상세 보기" }))
		await user.click(await screen.findByRole("button", { name: "에스컬레이션" }))
		const dialog = await screen.findByRole("dialog")
		await user.type(within(dialog).getByLabelText("상신 사유"), "거래 목적 확인 후 STR 작성")
		await user.click(within(dialog).getByRole("button", { name: "에스컬레이션만 실행" }))
		await user.click(await screen.findByRole("button", { name: "STR 초안 생성" }))
		await user.click(
			within(await screen.findByRole("dialog")).getByRole("button", { name: "생성 시작" }),
		)
		await screen.findByRole("heading", { name: "STR 보고서 편집" })
		expect(screen.getByText("검증 결과 없음")).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "책임자 승인 요청" })).toBeDisabled()
		await user.click(screen.getByRole("button", { name: "저장된 본문 검증" }))
		await screen.findByText("불통과")
		const how = screen.getByRole("textbox", { name: "거래 방식" })
		await user.clear(how)
		await user.type(how, "9월 2일 입금 이후 두 계좌로 송금되었습니다.")
		expect(screen.getByRole("button", { name: "저장된 본문 검증" })).toBeDisabled()
		await user.click(screen.getByRole("button", { name: "변경 단락 저장" }))
		await screen.findByText("과거 수정본")
		await user.click(screen.getByRole("button", { name: "저장된 본문 검증" }))
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "책임자 승인 요청" })).toBeEnabled(),
		)
		await user.click(screen.getByRole("button", { name: "책임자 승인 요청" }))
		await screen.findByText("승인 대기 · 편집 잠금")
		await role(user, "APPROVER")
		await user.click(await screen.findByRole("button", { name: "승인 확인" }))
		await user.click(
			within(await screen.findByRole("dialog")).getByRole("button", { name: "승인 및 잠금" }),
		)
		await screen.findByText("승인 대기 건이 없습니다")
		await user.click(screen.getByRole("link", { name: "STR 보고서" }))
		await screen.findByText("승인 완료 · 문서 잠금")
		expect(screen.getByRole("textbox", { name: "거래 방식" })).toBeDisabled()
	}, 20000)
})
