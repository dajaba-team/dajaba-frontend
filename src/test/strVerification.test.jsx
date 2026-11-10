import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { toDraft } from "../features/str/api/strApi"
import VerificationPanel from "../features/str/components/VerificationPanel"

const inv01 = { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" }

function renderStr(caseNo) {
	resetCases(inv01)
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={[`/cases/${caseNo}/str`]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
}

// 서버 응답(snake_case)을 toDraft로 옮겨 패널만 그려요.
function renderPanel(latestVerification, currentRevisionNo = 2) {
	const draft = toDraft({
		draft_no: "DRF-000999",
		access: "FULL",
		current_revision_no: currentRevisionNo,
		latest_verification: latestVerification,
	})
	render(
		<VerificationPanel
			verification={draft.latestVerification}
			currentRevisionNo={draft.currentRevisionNo}
		/>,
	)
}

const row = (check, section, overrides = {}) => ({
	check,
	section,
	draft_value: "1",
	source_value: "1",
	match: true,
	reason: null,
	...overrides,
})
const llm = (check, score, comment = "코멘트") => ({ check, score, comment })
const ALL_CODE_PASS = [
	row("AMOUNT_MATCH", "INSTRUMENT"),
	row("DATE_MATCH", "DATE"),
	row("COUNT_MATCH", "INSTRUMENT"),
	row("ACCOUNT_ID_MATCH", "SUBJECT"),
	row("EVIDENCE_IN_SCOPE", "METHOD"),
]

const itemNames = (listName) =>
	within(screen.getByRole("list", { name: listName }))
		.getAllByRole("listitem")
		.filter((item) => item.parentElement.getAttribute("aria-label") === listName)
		.map((item) => item.querySelector("strong").textContent)

describe("검증 결과 패널 (SCRUM-116)", () => {
	it("코드 검사 실패 — 실패 항목이 위로, 못 읽음·빠짐을 구분, 검사 없음·평가 안 함 표시", async () => {
		renderStr("CASE-2022-001001")
		const panel = (await screen.findByRole("heading", { name: "검증 결과" })).closest("section")
		expect(within(panel).getByText("코드 검사 실패")).toBeInTheDocument()
		expect(within(panel).getByText(/수정본 1번 \(AI 원문\) 검증/)).toBeInTheDocument()
		expect(
			within(panel).getByText("통과 기준: 코드 검사 5개 전부 통과 + AI 평가 전부 4점 이상"),
		).toBeInTheDocument()

		// 5개 다, 실패한 날짜가 맨 위
		expect(itemNames("코드 검사")).toEqual(["날짜", "금액", "건수", "계좌", "근거 범위"])
		const date = within(screen.getByRole("list", { name: "코드 검사" }))
			.getAllByRole("listitem")
			.find((item) => item.querySelector("strong")?.textContent === "날짜")
		expect(date).toHaveTextContent("실패")
		expect(date).toHaveTextContent("읽지 못함 · 방법 · 본문 9월 초 · 원본 2022-09-02")
		expect(date).toHaveTextContent("빠짐 · 사유 · 본문 - · 원본 2022-09-02")
		expect(date).not.toHaveTextContent("불일치")

		// 줄이 안 온 건수는 "통과"가 아니라 "검사 없음"
		const count = within(screen.getByRole("list", { name: "코드 검사" }))
			.getAllByRole("listitem")
			.find((item) => item.querySelector("strong")?.textContent === "건수")
		expect(count).toHaveTextContent("검사 없음")
		expect(count).not.toHaveTextContent("통과")

		// AI 평가 null → 5개 모두 "평가 안 함"
		expect(itemNames("AI 평가")).toHaveLength(5)
		expect(
			within(screen.getByRole("list", { name: "AI 평가" })).getAllByText("평가 안 함"),
		).toHaveLength(5)
	})

	it("검증 기록이 없으면 '아직 검증하지 않았어요'", async () => {
		renderStr("CASE-2022-001003")
		expect(await screen.findByText("아직 검증하지 않았어요.")).toBeInTheDocument()
	})

	it("AI 평가 미달 — 4점 미만 항목이 위로, 점수·코멘트를 같이 보여 준다", () => {
		renderPanel({
			revision_no: 2,
			is_current: true,
			passed: false,
			status: "LLM_FAILED",
			code_checks: ALL_CODE_PASS,
			llm_checks: [
				llm("FIVE_W_ONE_H_COMPLETE", 5),
				llm("TYPOLOGY_CONSISTENT", 4),
				llm("NO_UNSUPPORTED_CLAIM", 2, "근거 거래에 없는 해외 송금을 언급해요."),
				llm("NO_SPECULATION", 5),
				llm("NO_INSTRUCTION_TEXT", 3),
			],
		})
		expect(screen.getByText("AI 평가 미달")).toBeInTheDocument()
		expect(itemNames("AI 평가")).toEqual([
			"근거 없는 주장 없음",
			"지시문·프롬프트 흔적 없음",
			"육하원칙 빠짐 없음",
			"의심 유형과 본문이 맞음",
			"추측 표현 없음",
		])
		expect(screen.getByText("2점 · 미달")).toBeInTheDocument()
		expect(screen.getByText("근거 거래에 없는 해외 송금을 언급해요.")).toBeInTheDocument()
		expect(screen.getByText("4점 · 통과")).toBeInTheDocument()
		// 코드 검사는 모두 통과, 순서는 표 그대로
		expect(itemNames("코드 검사")).toEqual(["금액", "날짜", "건수", "계좌", "근거 범위"])
	})

	it("요구사항에 없는 GROUNDING은 보이지 않고, 빠진 평가 항목은 '결과 없음'", () => {
		renderPanel({
			revision_no: 2,
			is_current: true,
			passed: true,
			status: "PASSED",
			code_checks: ALL_CODE_PASS,
			llm_checks: [llm("GROUNDING", 5, "옛 항목"), llm("FIVE_W_ONE_H_COMPLETE", 4)],
		})
		expect(document.querySelector(".str-verify-status")).toHaveTextContent("통과")
		expect(screen.queryByText("GROUNDING")).not.toBeInTheDocument()
		expect(screen.queryByText("옛 항목")).not.toBeInTheDocument()
		expect(
			within(screen.getByRole("list", { name: "AI 평가" })).getAllByText("결과 없음"),
		).toHaveLength(4)
	})

	it("지금 수정본이 아닌 검증이면 다시 검증하라고 알린다", () => {
		renderPanel(
			{
				revision_no: 2,
				is_current: false,
				passed: true,
				status: "PASSED",
				code_checks: ALL_CODE_PASS,
				llm_checks: [],
			},
			3,
		)
		expect(screen.getByRole("note")).toHaveTextContent("이전 수정본을 검증한 결과예요")
	})
})
