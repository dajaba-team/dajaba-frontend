import { describe, expect, it } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
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
import { seedStrDrafts, visibleStrDraft } from "../mocks/strDrafts"
import { LLM_SKIPPED_NOTES } from "../features/str/verificationLabels"
import { VERIFICATION_TEXT } from "../features/str/model/strRules"

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

// 검증 결과 패널(#32 VerificationPanel) — 화면에 하나만 있어요.
const verifyPanel = async () =>
	(await screen.findByRole("heading", { name: "검증 결과" })).closest("section")
// 패널 맨 위 결과 줄(서버 status 그대로의 라벨)
const statusOf = (panel) => panel.querySelector(".str-verify-status").textContent

async function verifyAndWait(user, expected) {
	const panel = await verifyPanel()
	await user.click(within(panel).getByRole("button", { name: "다시 검증" }))
	await waitFor(() => expect(panel).toHaveTextContent(expected))
	return panel
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

describe("STR 작성 흐름 — 저장 → 검증 → 승인 요청 (STR-01·02, MSW)", () => {
	it("고친 뒤엔 저장 전까지 검증·승인 요청을 막고, 불일치를 고쳐 통과하면 승인 요청한다", async () => {
		const user = renderStr("CASE-2022-001001")
		const date = await sectionBox("일자")
		await replaceText(user, date, "2022년 9월 3일 하루 동안.")
		expect(screen.getByText("미저장 변경이 있어요")).toBeInTheDocument()
		const panel = await verifyPanel()
		// MSW 초안엔 수정본 1번 검증 기록이 있어요(SCRUM-116 예시) — 그래서 버튼 이름은 [다시 검증]
		expect(within(panel).getByRole("button", { name: "다시 검증" })).toBeDisabled()
		expect(within(panel).getByRole("status")).toHaveTextContent(VERIFICATION_TEXT.UNSAVED)
		expect(screen.getByText("먼저 변경 내용을 저장해 주세요.")).toBeInTheDocument()

		await user.click(screen.getByRole("button", { name: "변경 저장" }))
		expect(await screen.findByText(/7개 항목 · 수정본 2번/)).toBeInTheDocument()
		// 저장하면 수정본 1번 결과는 지난 결과 — #32의 안내 그대로
		expect(within(panel).getByText(/이전 수정본을 검증한 결과예요/)).toBeInTheDocument()

		await verifyAndWait(user, "코드 검사 실패 · 수정본 2번 검증")
		// AI 평가 5줄마다 "코드 검사가 실패해서…"
		expect(screen.getAllByText(LLM_SKIPPED_NOTES.CODE_FAILED)).toHaveLength(5)
		expect(within(panel).queryByText(/이전 수정본을 검증한 결과예요/)).not.toBeInTheDocument()
		// 일자 항목 아래 본문 값·원본 값
		expect(
			within(screen.getByRole("article", { name: "일자" })).getByRole("note"),
		).toHaveTextContent("본문 2022-09-03 / 원본 2022-09-02")
		// 본문 속 그 값에 밑줄 + 바로 옆 "원본: …"
		const marked = within(screen.getByRole("article", { name: "일자" })).getByLabelText(
			"일자 검증 결과 표시",
		)
		expect(marked.querySelector("mark.str-mismatch")).toHaveTextContent("2022년 9월 3일")
		expect(marked).toHaveTextContent("원본: 2022-09-02")
		expect(screen.getByRole("button", { name: "승인 요청" })).toBeDisabled()

		await replaceText(user, await sectionBox("일자"), "2022년 9월 2일 하루 동안.")
		await user.click(screen.getByRole("button", { name: "변경 저장" }))
		expect(await screen.findByText(/7개 항목 · 수정본 3번/)).toBeInTheDocument()
		await verifyAndWait(user, "통과 · 수정본 3번 검증")

		// VI부 — 유형·지점 정도는 기본값 없음
		expect(screen.getByText("의심 유형을 1개 이상 선택해 주세요.")).toBeInTheDocument()
		await user.click(screen.getByText("유형 선택 열기"))
		await user.click(screen.getAllByRole("checkbox")[0])
		expect(screen.getByText("지점 의심 정도를 선택해 주세요.")).toBeInTheDocument()
		await user.click(screen.getByRole("radio", { name: "3" }))

		await user.click(screen.getByRole("button", { name: "승인 요청" }))
		const confirm = screen.getByRole("region", { name: "승인 요청 확인" })
		await user.click(within(confirm).getByRole("button", { name: "승인 요청" }))
		expect(
			await screen.findByText("승인 대기 중이라 본문을 수정할 수 없어요."),
		).toBeInTheDocument()
		expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "변경 저장" })).not.toBeInTheDocument()
	})

	it("검증 못 함(VERIFY_UNAVAILABLE)은 코드 검사 실패 문구 없이 패널에 남고 [다시 검증]을 누를 수 있다 (테스트 11-4)", async () => {
		const user = renderStr("CASE-2022-001001")
		// MSW: 본문에 "검증불가"가 있으면 평가 서비스 오류로 답해요.
		await replaceText(user, await sectionBox("종합의견"), "검증불가 예시 의견.")
		await user.click(screen.getByRole("button", { name: "변경 저장" }))
		expect(await screen.findByText(/7개 항목 · 수정본 2번/)).toBeInTheDocument()

		const panel = await verifyAndWait(user, "검증 못 함 · 수정본 2번 검증")
		expect(within(panel).getAllByText(LLM_SKIPPED_NOTES.VERIFY_UNAVAILABLE)).toHaveLength(5)
		expect(within(panel).queryByText(LLM_SKIPPED_NOTES.CODE_FAILED)).not.toBeInTheDocument()
		expect(within(panel).getByRole("button", { name: "다시 검증" })).toBeEnabled()
		expect(screen.queryByRole("alert")).not.toBeInTheDocument()
	})

	it("PASSED·CODE_FAILED·LLM_FAILED·VERIFY_UNAVAILABLE을 서로 다른 문구로 보여 준다", async () => {
		const user = renderStr("CASE-2022-001001")
		const seen = []
		// 1) 시드 결과: 코드 검사 실패(수정본 1번)
		let panel = await verifyPanel()
		await waitFor(() =>
			expect(panel).toHaveTextContent("코드 검사 실패 · 수정본 1번 (AI 원문) 검증"),
		)
		seen.push(statusOf(panel))
		expect(within(panel).getAllByText(LLM_SKIPPED_NOTES.CODE_FAILED)).toHaveLength(5)

		// 2) AI 평가 미달 — verify 응답과 그 뒤 초안 조회를 덮어써요(MSW verify는 이 상태를 만들지 않아요).
		const llmFailed = {
			verification_id: "VRF-llm",
			revision_no: 1,
			passed: false,
			status: "LLM_FAILED",
			produced_at: "2026-11-11T00:00:00Z",
			code_checks: [
				"AMOUNT_MATCH",
				"DATE_MATCH",
				"COUNT_MATCH",
				"ACCOUNT_ID_MATCH",
				"EVIDENCE_IN_SCOPE",
				"OPINION_PRESENT",
			].map((check) => ({ check, section: null, match: true, reason: null })),
			llm_checks: [
				{ check: "FIVE_W_ONE_H_COMPLETE", score: 5, comment: "충분" },
				{ check: "TYPOLOGY_CONSISTENT", score: 2, comment: "유형과 본문이 어긋남" },
				{ check: "NO_UNSUPPORTED_CLAIM", score: 4, comment: "-" },
				{ check: "NO_SPECULATION", score: 4, comment: "-" },
				{ check: "NO_INSTRUCTION_TEXT", score: 5, comment: "-" },
			],
		}
		const seeded = seedStrDrafts().find((draft) => draft.draft_no === "DRF-000124")
		// 버튼은 케이스 C2에서 옮겨 오게(임시 다리) available_actions 키를 빼요.
		const { available_actions: _unused, ...draft } = {
			...seeded,
			latest_verification: llmFailed,
		}
		server.use(
			http.post("*/api/v1/str-drafts/:draftNo/verify", () => HttpResponse.json(llmFailed)),
			http.get("*/api/v1/str-drafts/:draftNo", () =>
				HttpResponse.json(visibleStrDraft(users.inv01, draft)),
			),
		)
		panel = await verifyAndWait(user, "AI 평가 미달 · 수정본 1번 (AI 원문) 검증")
		seen.push(statusOf(panel))
		expect(within(panel).getByText("2점 · 미달")).toBeInTheDocument()
		// 미달 항목이 AI 평가 맨 위
		const llmRows = within(within(panel).getByRole("list", { name: "AI 평가" })).getAllByRole(
			"listitem",
		)
		expect(llmRows[0]).toHaveTextContent("의심 유형과 본문이 맞음")
		server.resetHandlers()

		// 3) 검증 못 함
		await replaceText(user, await sectionBox("종합의견"), "검증불가 예시 의견.")
		await user.click(screen.getByRole("button", { name: "변경 저장" }))
		expect(await screen.findByText(/7개 항목 · 수정본 2번/)).toBeInTheDocument()
		panel = await verifyAndWait(user, "검증 못 함 · 수정본 2번 검증")
		seen.push(statusOf(panel))
		expect(within(panel).getAllByText(LLM_SKIPPED_NOTES.VERIFY_UNAVAILABLE)).toHaveLength(5)

		// 4) 통과
		await replaceText(user, await sectionBox("종합의견"), "자금 출처 확인이 필요해 보여요.")
		await user.click(screen.getByRole("button", { name: "변경 저장" }))
		expect(await screen.findByText(/7개 항목 · 수정본 3번/)).toBeInTheDocument()
		panel = await verifyAndWait(user, "통과 · 수정본 3번 검증")
		seen.push(statusOf(panel))

		expect(seen).toEqual(["코드 검사 실패", "AI 평가 미달", "검증 못 함", "통과"])
		expect(new Set(seen).size).toBe(4)
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
		expect(screen.queryByRole("button", { name: "저장본 검증" })).not.toBeInTheDocument()
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
		// 새 초안은 검증 기록이 없어요 — #32 패널 문구 + [저장본 검증]
		const panel = await verifyPanel()
		expect(within(panel).getByText("아직 검증하지 않았어요.")).toBeInTheDocument()
		expect(within(panel).getByRole("button", { name: "저장본 검증" })).toBeEnabled()
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
