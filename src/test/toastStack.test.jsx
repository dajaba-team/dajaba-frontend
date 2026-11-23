import { describe, expect, it } from "vitest"
import { useEffect } from "react"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import ToastProvider from "../shared/ui/toast/ToastProvider"
import { useToast } from "../shared/ui/toast/useToast"

// 토스트 확장(SCRUM-365, 「비동기 작업 알림 설계 문서」 7.4) — 쌓기·남기기·링크·닫기, 기존 호출 그대로.
const api = { current: null }
function Grab() {
	const toast = useToast()
	useEffect(() => {
		api.current = toast
	})
	return null
}
function show(duration = 5000) {
	render(
		<MemoryRouter initialEntries={["/here"]}>
			<ToastProvider duration={duration}>
				<Grab />
				<Routes>
					<Route path="/here" element={<p>여기</p>} />
					<Route path="/there" element={<p>저기</p>} />
				</Routes>
			</ToastProvider>
		</MemoryRouter>,
	)
}
const toasts = () => document.querySelectorAll(".toast")

describe("토스트 확장", () => {
	it("기존 호출 show({tone, text})는 그대로 — 오류는 alert, 그 밖은 status, 시간이 지나면 사라진다", async () => {
		show(60)
		act(() => api.current.show({ tone: "info", text: "저장했어요" }))
		act(() => api.current.show({ tone: "error", text: "실패했어요" }))
		expect(screen.getByRole("status")).toHaveTextContent("저장했어요")
		expect(screen.getByRole("alert")).toHaveTextContent("실패했어요")
		expect(screen.queryByRole("button", { name: "알림 닫기" })).toBeNull()
		await waitFor(() => expect(toasts()).toHaveLength(0))
	})

	it("최대 3개까지 쌓이고 넘으면 가장 오래된 것부터 사라진다", () => {
		show()
		act(() => ["하나", "둘", "셋", "넷"].forEach((text) => api.current.show({ text })))
		expect([...toasts()].map((t) => t.textContent)).toEqual(["둘", "셋", "넷"])
	})

	it("넘쳐도 실패(sticky) 토스트는 남고 일반 토스트부터 밀려난다", () => {
		show()
		act(() => api.current.show({ tone: "error", text: "실패", sticky: true }))
		act(() => ["하나", "둘", "셋"].forEach((text) => api.current.show({ text })))
		expect([...toasts()].map((t) => t.textContent.replace("×", ""))).toEqual([
			"실패",
			"둘",
			"셋",
		])
	})

	it("sticky는 시간이 지나도 남고 [알림 닫기]로 닫는다", async () => {
		show(30)
		act(() => api.current.show({ tone: "error", text: "적재에 실패했어요", sticky: true }))
		act(() => api.current.show({ text: "잠깐" }))
		await waitFor(() => expect(toasts()).toHaveLength(1))
		expect(screen.getByRole("alert")).toHaveTextContent("적재에 실패했어요")
		await userEvent.setup().click(screen.getByRole("button", { name: "알림 닫기" }))
		expect(toasts()).toHaveLength(0)
	})

	it("[결과 보기]를 누르면 그 화면으로 가고 토스트가 닫힌다", async () => {
		show()
		act(() =>
			api.current.show({ text: "끝났어요", action: { label: "결과 보기", to: "/there" } }),
		)
		const toast = screen.getByRole("status")
		await userEvent.setup().click(within(toast).getByRole("button", { name: "결과 보기" }))
		expect(screen.getByText("저기")).toBeInTheDocument()
		expect(toasts()).toHaveLength(0)
	})

	it("dismiss()는 남는 것까지 전부 닫는다", () => {
		show()
		act(() => api.current.show({ text: "하나" }))
		act(() => api.current.show({ tone: "error", text: "둘", sticky: true }))
		act(() => api.current.dismiss())
		expect(toasts()).toHaveLength(0)
	})
})
