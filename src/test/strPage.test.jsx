import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { server } from "../mocks/server"
import { apiClient } from "../shared/api/apiClient"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { sectionTitle } from "../shared/str/sectionTitles"

const users = {
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}

function renderStr(caseId, who = "inv01") {
	resetCases(users[who])
	return renderAs(caseId)
}

// resetCases 없이 그리기 — 테스트가 먼저 MSW 상태를 바꿔 둘 때.
function renderAs(caseId) {
	const user = userEvent.setup()
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={[`/cases/${caseId}/str`]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return user
}

const sectionBox = async (title) =>
	within(await screen.findByRole("article", { name: title })).getByRole("textbox")

async function replaceText(user, box, text) {
	await user.clear(box)
	// user-event는 "{"·"["를 키 이름으로 읽어요. 본문 예시엔 없어요.
	await user.type(box, text)
}

const sectionHeadings = async () => {
	const list = await screen.findByRole("list", { name: "서술부" })
	return within(list)
		.getAllByRole("heading", { level: 2 })
		.map((heading) => heading.textContent)
}

describe("STR 화면 — 서버가 준 서술부 목록대로 그리기 (SCRUM-115)", () => {
	it("새 초안은 서술부 7항목을 서버 순서대로 보여 준다", async () => {
		renderStr("CASE-2022-001001")
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
		// 줄바꿈이 든 AI 문장도 글자 그대로 (담당 조사역이라 편집칸에)
		// toHaveValue는 expect.stringContaining을 못 받아(jest-dom 7) 값을 꺼내 비교해요.
		expect((await sectionBox("방법")).value).toContain("(FAN_IN).\n건당 USD 12,500.00")
		expect(screen.getAllByText(/근거 거래 3건 · 104221, 104233, 104301/)).toHaveLength(2)
	})

	it("7항목 전환 전에 만든 6섹션 승인본도 그대로 보여 준다", async () => {
		renderStr("CASE-2022-001003")
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
		expect(sectionTitle({ section: "SUBJECT", label: "" })).toBe("거래자") // 빈 label도 표로
		expect(sectionTitle({ section: "HOW", label: null })).toBe("어떻게") // 옛 6섹션
		expect(sectionTitle({ section: "NEW_ITEM", label: null })).toBe("NEW_ITEM")
	})

	it("관리자는 본문 없이 상태만 보고, 본문 문장은 화면에 없다", async () => {
		renderStr("CASE-2022-001001", "admin")
		expect(await screen.findByRole("note")).toHaveTextContent(
			"본문은 담당 조사역과 승인자만 볼 수 있어요",
		)
		expect(screen.getByText(/DRF-000124 · 초안 ACTIVE/)).toBeInTheDocument()
		expect(screen.queryByRole("list", { name: "서술부" })).not.toBeInTheDocument()
		expect(screen.queryByText(/Sole Proprietorship/)).not.toBeInTheDocument()
	})

	it("초안이 없는 케이스는 없다고 알려 준다", async () => {
		renderStr("CASE-2022-001002")
		expect(await screen.findByText("이 케이스에는 아직 STR 초안이 없어요.")).toBeInTheDocument()
	})
})

describe("STR 작성 흐름 — 항목 수정·저장 (STR-01, S3)", () => {
	it("고치면 미저장으로 표시하고, 저장하면 새 수정본이 되고 이력에 남는다", async () => {
		const user = renderStr("CASE-2022-001001")
		const date = await sectionBox("일자")
		await replaceText(user, date, "2022년 9월 2일 하루 동안.")
		expect(screen.getByText("미저장 변경이 있어요")).toBeInTheDocument()

		await user.click(screen.getByRole("button", { name: "변경 저장" }))
		expect(await screen.findByText(/7개 항목 · 수정본 2번/)).toBeInTheDocument()
		expect(screen.getByText("저장했어요.")).toBeInTheDocument()
		expect(screen.getByText("저장본과 같아요")).toBeInTheDocument()

		await user.click(screen.getByRole("button", { name: "수정 이력" }))
		expect(
			await screen.findByText(/수정본 2번/, { selector: "button, li *" }),
		).toBeInTheDocument()
	})

	it("빈 항목은 저장 버튼이 꺼진다", async () => {
		const user = renderStr("CASE-2022-001001")
		await user.clear(await sectionBox("장소"))
		expect(screen.getByText("빈 항목은 저장할 수 없어요.")).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "변경 저장" })).toBeDisabled()
	})

	it("다른 곳에서 먼저 저장했으면(409) 내 입력을 두고 최신 본문과 비교한다", async () => {
		const user = renderStr("CASE-2022-001001")
		await replaceText(user, await sectionBox("장소"), "내가 고친 장소")
		// 다른 탭에서 먼저 저장 — 케이스 version이 올라가요
		await apiClient.put("/api/v1/str-drafts/DRF-000124/revisions", {
			case_version: 3,
			sections: [{ section: "PLACE", text: "다른 사람이 고친 장소" }],
		})
		await user.click(screen.getByRole("button", { name: "변경 저장" }))
		const compare = await screen.findByRole("alert", { name: "동시 수정 비교" })
		expect(compare).toHaveTextContent("내가 고친 장소")
		expect(await within(compare).findByText("다른 사람이 고친 장소")).toBeInTheDocument()
		expect(await sectionBox("장소")).toHaveValue("내가 고친 장소")
		await user.click(
			within(compare).getByRole("button", { name: "내 입력 유지하고 다시 저장" }),
		)
		expect(await screen.findByText(/7개 항목 · 수정본 3번/)).toBeInTheDocument()
		expect(await sectionBox("장소")).toHaveValue("내가 고친 장소")
	})

	it("관리자는 편집칸·작업 버튼 없이 상태만 본다", async () => {
		renderStr("CASE-2022-001001", "admin")
		await screen.findByRole("note")
		expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "변경 저장" })).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "수정 이력" })).not.toBeInTheDocument()
	})
})

describe("STR 초안 생성 (S1)", () => {
	async function escalated() {
		resetCases(users.inv01)
		await apiClient.post("/api/v1/cases/CASE-2022-001004/escalate", {
			comment: "STR 검토 필요",
			version: 1,
		})
	}

	it("에스컬레이션된 케이스에서 초안을 만들면 새 초안을 연다", async () => {
		await escalated()
		const user = renderAs("CASE-2022-001004")
		await user.click(await screen.findByRole("button", { name: "STR 초안 생성" }))
		await user.click(screen.getByRole("button", { name: "초안 생성" }))
		expect(
			await screen.findByText(/DRF-000125 · 초안 ACTIVE · 케이스 DRAFTED/),
		).toBeInTheDocument()
		expect(await sectionBox("일자")).toBeInTheDocument() // 바로 고칠 수 있어요
	})

	it("만드는 중(409 DRAFT_IN_PROGRESS)은 장애가 아니라 진행 중으로 안내한다", async () => {
		await escalated()
		server.use(
			http.post("*/api/v1/cases/:caseNo/str-drafts", () =>
				HttpResponse.json(
					{ error: { code: "DRAFT_IN_PROGRESS", message: "만드는 중", details: {} } },
					{ status: 409 },
				),
			),
		)
		const user = renderAs("CASE-2022-001004")
		await user.click(await screen.findByRole("button", { name: "STR 초안 생성" }))
		await user.click(screen.getByRole("button", { name: "초안 생성" }))
		expect(await screen.findByRole("alert")).toHaveTextContent("초안을 만드는 중이에요")
	})

	it("S1 요청 본문은 계약서대로 case_version 이다", async () => {
		await escalated()
		let body = null
		server.use(
			http.post("*/api/v1/cases/:caseNo/str-drafts", async ({ request }) => {
				body = await request.json()
				return HttpResponse.json(
					{
						case_no: "CASE-2022-001004",
						case_status: "DRAFTED",
						case_version: 3,
						draft_no: "DRF-000777",
					},
					{ status: 201 },
				)
			}),
		)
		const user = renderAs("CASE-2022-001004")
		await user.click(await screen.findByRole("button", { name: "STR 초안 생성" }))
		await user.click(screen.getByRole("button", { name: "초안 생성" }))
		await screen.findByText(/초안 DRF-000777을 저장했어요/)
		expect(body).toEqual({ case_version: 2 })
	})
})
