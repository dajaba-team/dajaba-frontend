import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { sectionTitle } from "../features/str/sectionTitles"

const users = {
	inv01: { id: "1", login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	admin: { id: "4", login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}

function renderStr(caseId, who = "inv01") {
	resetCases(users[who])
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={[`/cases/${caseId}/str`]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
}

const sectionHeadings = async () => {
	const list = await screen.findByRole("list", { name: "서술부" })
	return within(list)
		.getAllByRole("heading", { level: 2 })
		.map((heading) => heading.textContent)
}

describe("STR 화면 — 서버가 준 서술부 목록대로 그리기 (SCRUM-115)", () => {
	it("새 초안은 서술부 7항목을 서버 순서대로 보여 준다", async () => {
		renderStr("1001")
		expect(await sectionHeadings()).toEqual([
			"거래자",
			"일자",
			"장소",
			"수단",
			"방법",
			"사유",
			"종합의견",
		])
		expect(screen.getByText(/7개 항목 · 수정본 1번 \(AI 원문\)/)).toBeInTheDocument()
		// 줄바꿈이 든 AI 문장도 글자 그대로
		const method = screen.getByRole("article", { name: "방법" })
		expect(method.querySelector(".str-section-text").textContent).toContain(
			"(FAN_IN).\n건당 USD 12,500.00",
		)
		expect(screen.getAllByText(/근거 거래 3건 · 104221, 104233, 104301/)).toHaveLength(2)
	})

	it("7항목 전환 전에 만든 6섹션 승인본도 그대로 보여 준다", async () => {
		renderStr("1003")
		expect(await sectionHeadings()).toEqual([
			"요약",
			"누가",
			"무엇을·언제·어디서",
			"어떻게",
			"의심 사유",
			"결론",
		])
		expect(screen.getByText(/DRF-000098 · 초안 LOCKED · 케이스 APPROVED/)).toBeInTheDocument()
	})

	it("제목은 서버 label이 먼저고, 모르는 섹션 이름은 그대로 보여 준다", () => {
		expect(sectionTitle({ section: "SUBJECT", label: "의심스러운 거래자 관련" })).toBe(
			"의심스러운 거래자 관련",
		)
		expect(sectionTitle({ section: "SUBJECT", label: null })).toBe("거래자")
		expect(sectionTitle({ section: "NEW_ITEM", label: null })).toBe("NEW_ITEM")
	})

	it("관리자는 본문 없이 상태만 보고, 본문 문장은 화면에 없다", async () => {
		renderStr("1001", "admin")
		expect(await screen.findByRole("note")).toHaveTextContent(
			"본문은 담당 조사역과 승인자만 볼 수 있어요",
		)
		expect(screen.getByText(/DRF-000124 · 초안 ACTIVE/)).toBeInTheDocument()
		expect(screen.queryByRole("list", { name: "서술부" })).not.toBeInTheDocument()
		expect(screen.queryByText(/Sole Proprietorship/)).not.toBeInTheDocument()
	})

	it("초안이 없는 케이스는 없다고 알려 준다", async () => {
		renderStr("1002")
		expect(await screen.findByText("이 케이스에는 아직 STR 초안이 없어요.")).toBeInTheDocument()
	})
})
