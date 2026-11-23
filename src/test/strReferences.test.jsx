import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse, delay } from "msw"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { server } from "../mocks/server"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { seedStrDrafts, visibleStrDraft } from "../mocks/strDrafts"
import { queryLength } from "../features/str/model/referenceSearch"

// 참고 사례 패널 + [유형으로 더 찾아보기] (SCRUM-312·333, 설계 문서 A 7절). MSW 목업:
// SCATTER_GATHER만 → 0건, 검색어 "일부" → degraded, "AI오류" → 502 (src/mocks/referenceSearch.js)
const users = {
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	apr01: { id: 3, login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" },
}
const WITH_REFS = "CASE-2022-001001" // DRF-000124 — 참고 사례 3건, 경보 유형 FAN_IN
const NO_REFS = "CASE-2022-001003" // DRF-000098 — 승인돼 잠긴 초안, 참고 사례 없음

function renderStr(caseNo, who = "inv01") {
	resetCases(users[who])
	const user = userEvent.setup()
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={[`/cases/${caseNo}/str`]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return user
}

const panel = async () => screen.findByRole("region", { name: "참고 사례" })
const searchForm = () => screen.getByRole("form", { name: "참고 사례 찾기" })
const chip = (name) => within(searchForm()).getByRole("button", { name })
const findButton = () => within(searchForm()).getByRole("button", { name: /찾기|찾는 중/ })

async function openSearch(user) {
	await user.click(within(await panel()).getByRole("button", { name: "유형으로 더 찾아보기" }))
	return searchForm()
}

describe("참고 사례 패널 — 초안에 붙은 자료 (SCRUM-312)", () => {
	it("3건이면 카드 3장에 문서명 · PDF n쪽 · 유사도(소수 둘째 자리)를 보여 주고 본문은 없다", async () => {
		renderStr(WITH_REFS)
		const list = within(await panel()).getByRole("list", { name: "초안에 붙은 참고 사례" })
		const cards = within(list).getAllByRole("listitem")
		expect(cards).toHaveLength(3)
		expect(cards[0]).toHaveTextContent("APG Yearly Typologies Report 2025")
		expect(cards[0]).toHaveTextContent("PDF 53쪽 · 유사도 0.58")
		expect(
			within(await panel()).getByText("원문은 해당 문서의 쪽에서 확인해 주세요."),
		).toBeInTheDocument()
	})
	it("0건이면 빈 상태 안내를 보여 주고, 잠긴 초안에서도 [유형으로 더 찾아보기]가 있다", async () => {
		renderStr(NO_REFS)
		expect(
			within(await panel()).getByRole("button", { name: "유형으로 더 찾아보기" }),
		).toBeInTheDocument()
		expect(
			within(await panel()).getByText("이 초안에 붙은 참고 사례가 없어요."),
		).toBeInTheDocument()
	})
	it("서버가 SEARCH_REFERENCES를 안 주면 [유형으로 더 찾아보기]가 없다", async () => {
		const draft = seedStrDrafts().find((item) => item.draft_no === "DRF-000124")
		server.use(
			http.get("*/api/v1/str-drafts/:draftNo", () =>
				HttpResponse.json({
					...visibleStrDraft(users.inv01, draft),
					available_actions: [],
				}),
			),
		)
		renderStr(WITH_REFS)
		const region = await panel()
		expect(within(region).getAllByRole("listitem")).toHaveLength(3)
		expect(
			within(region).queryByRole("button", { name: "유형으로 더 찾아보기" }),
		).not.toBeInTheDocument()
	})
})

describe("참고 사례 찾기 영역 (SCRUM-333, 설계 7.1~7.3)", () => {
	it("경보 유형이 미리 골라져 있고, 찾으면 유사도순 카드에 발행처·연도·유형·이미 붙어 있음을 보여 준다", async () => {
		const user = renderStr(WITH_REFS)
		let body
		server.use(
			http.post("*/api/v1/str-drafts/:draftNo/references/search", async ({ request }) => {
				body = await request.json()
				return HttpResponse.json({
					items: [
						{
							doc_title: "APG Yearly Typologies Report 2025",
							publisher: "Asia/Pacific Group on Money Laundering",
							year: 2025,
							page: 53,
							score: 0.6,
							typologies: ["FAN_IN", "LAYERING"],
							source_type: "PUBLIC",
						},
						{
							doc_title: "Egmont Group FIU Case Studies",
							publisher: "Egmont Group",
							year: 2023,
							page: 12,
							score: 0.413,
							typologies: ["FAN_IN"],
							source_type: "PUBLIC",
						},
					],
					degraded: false,
				})
			}),
		)
		await openSearch(user)
		expect(chip("집중 입금")).toHaveAttribute("aria-pressed", "true")
		await user.type(within(searchForm()).getByLabelText("검색어 (선택)"), "  해외 계좌  ")
		await user.click(findButton())
		const results = await within(searchForm()).findByRole("list", { name: "찾은 참고 사례" })
		// 검색어는 앞뒤 공백을 지워 보내고, top_k는 보내지 않아요
		expect(body).toEqual({ typologies: ["FAN_IN"], query: "해외 계좌" })
		const first = within(results).getByText("APG Yearly Typologies Report 2025").closest("li")
		expect(first).toHaveTextContent("APG Yearly Typologies Report 2025")
		expect(first).toHaveTextContent("이미 붙어 있음")
		expect(first).toHaveTextContent(
			"Asia/Pacific Group on Money Laundering 2025 · PDF 53쪽 · 유사도 0.60",
		)
		// 모르는 유형 태그는 코드 그대로
		expect(within(first).getByRole("list", { name: "유형" })).toHaveTextContent("LAYERING")
		const second = within(results).getByText("Egmont Group FIU Case Studies").closest("li")
		expect(second).not.toHaveTextContent("이미 붙어 있음")
		expect(second).toHaveTextContent("유사도 0.41")
		// 유사도 도움말
		await user.click(within(searchForm()).getByRole("button", { name: "유사도 설명" }))
		expect(within(searchForm()).getByText(/높다고 같은 사건이라는 뜻은 아니에요/)).toBeVisible()
		// 영역을 닫았다 열어도 마지막 결과가 남아요
		const toggle = within(await panel()).getByRole("button", { name: "유형으로 더 찾아보기" })
		await user.click(toggle)
		await user.click(toggle)
		expect(within(searchForm()).getByRole("list", { name: "찾은 참고 사례" })).toBeVisible()
	})
	it("유형은 3개까지 — 4번째를 누르면 안내하고 고르지 않으며, 0개면 [찾기]를 막는다", async () => {
		const user = renderStr(WITH_REFS)
		await openSearch(user)
		await user.click(chip("분산 송금"))
		await user.click(chip("순환 거래"))
		await user.click(chip("흩었다 모으기"))
		expect(screen.getByText("유형은 3개까지 고를 수 있어요.")).toBeInTheDocument()
		expect(chip("흩었다 모으기")).toHaveAttribute("aria-pressed", "false")
		for (const name of ["집중 입금", "분산 송금", "순환 거래"]) await user.click(chip(name))
		expect(findButton()).toBeDisabled()
		expect(within(searchForm()).getByText("유형을 하나 이상 골라 주세요.")).toBeInTheDocument()
	})
	it("검색어가 200자를 넘으면 숫자가 빨갛고 [찾기]를 막는다 — 200자는 통과", async () => {
		const user = renderStr(WITH_REFS)
		await openSearch(user)
		const input = within(searchForm()).getByLabelText("검색어 (선택)")
		await user.click(input)
		await user.paste("가".repeat(200))
		expect(within(searchForm()).getByText("200 / 200")).not.toHaveClass("is-over")
		expect(findButton()).toBeEnabled()
		await user.paste("나")
		expect(within(searchForm()).getByText("201 / 200")).toHaveClass("is-over")
		expect(input).toHaveAttribute("aria-invalid", "true")
		expect(findButton()).toBeDisabled()
	})
	it("결과가 0건이면 안내, degraded면 회색 한 줄을 같이 보여 준다", async () => {
		const user = renderStr(WITH_REFS)
		await openSearch(user)
		await user.click(chip("집중 입금"))
		await user.click(chip("흩었다 모으기"))
		await user.click(findButton())
		expect(
			await within(searchForm()).findByText("이 유형의 참고 자료가 아직 없어요."),
		).toBeInTheDocument()
		await user.click(chip("흩었다 모으기"))
		await user.click(chip("집중 입금"))
		await user.type(within(searchForm()).getByLabelText("검색어 (선택)"), "일부")
		await user.click(findButton())
		expect(
			await within(searchForm()).findByText(
				"일부 검색 방식이 응답하지 않아 결과가 줄었을 수 있어요.",
			),
		).toBeInTheDocument()
		expect(
			within(searchForm()).getByRole("list", { name: "찾은 참고 사례" }),
		).toBeInTheDocument()
	})
	it("502는 영역 안에만 안내 + [다시 시도], 다시 시도가 성공하면 결과를 보여 준다. 쓰던 검색어는 남는다", async () => {
		const user = renderStr(WITH_REFS)
		await openSearch(user)
		const input = within(searchForm()).getByLabelText("검색어 (선택)")
		await user.type(input, "AI오류")
		await user.click(findButton())
		const alert = await within(searchForm()).findByRole("alert")
		expect(alert).toHaveTextContent("AI 서버가 응답하지 않아요. 잠시 후 다시 시도해 주세요.")
		expect(input).toHaveValue("AI오류")
		// 본문 편집 영역은 그대로
		expect(screen.getByRole("region", { name: "서술부" })).toBeInTheDocument()
		server.use(
			http.post("*/api/v1/str-drafts/:draftNo/references/search", () =>
				HttpResponse.json({ items: [], degraded: false }),
			),
		)
		await user.click(within(alert).getByRole("button", { name: "다시 시도" }))
		expect(
			await within(searchForm()).findByText("이 유형의 참고 자료가 아직 없어요."),
		).toBeInTheDocument()
	})
	it("400 INVALID_REQUEST는 입력 아래 칸별 안내, 입력은 그대로", async () => {
		server.use(
			http.post("*/api/v1/str-drafts/:draftNo/references/search", () =>
				HttpResponse.json(
					{
						error: {
							code: "INVALID_REQUEST",
							message: "잘못된 요청",
							details: { query: "too long" },
						},
					},
					{ status: 400 },
				),
			),
		)
		const user = renderStr(WITH_REFS)
		await openSearch(user)
		const input = within(searchForm()).getByLabelText("검색어 (선택)")
		await user.type(input, "검색어")
		await user.click(findButton())
		expect(await within(searchForm()).findByRole("alert")).toHaveTextContent(
			"검색어는 200자까지 쓸 수 있어요.",
		)
		expect(input).toHaveValue("검색어")
		expect(
			within(searchForm()).queryByRole("button", { name: "다시 시도" }),
		).not.toBeInTheDocument()
	})
	it("찾는 중에는 [찾기]를 막고 안내를 보여 준다", async () => {
		server.use(
			http.post("*/api/v1/str-drafts/:draftNo/references/search", async () => {
				await delay(200)
				return HttpResponse.json({ items: [], degraded: false })
			}),
		)
		const user = renderStr(WITH_REFS)
		await openSearch(user)
		await user.click(findButton())
		expect(within(searchForm()).getByText("참고 사례를 찾는 중이에요.")).toBeInTheDocument()
		expect(findButton()).toBeDisabled()
		expect(
			await within(searchForm()).findByText("이 유형의 참고 자료가 아직 없어요."),
		).toBeInTheDocument()
	})
	it("승인자도 찾을 수 있다", async () => {
		const user = renderStr(WITH_REFS, "apr01")
		await openSearch(user)
		await user.click(findButton())
		expect(
			await within(searchForm()).findByRole("list", { name: "찾은 참고 사례" }),
		).toBeInTheDocument()
	})
})

describe("참고 사례 찾기 — 검색어 길이 기준", () => {
	it("앞뒤 공백을 빼고 NFC 뒤 UTF-16 단위로 센다 (AI·BE와 같은 기준)", () => {
		expect(queryLength("  abc  ")).toBe(3)
		// 조합형 한글 "가"(ᄀ+ᅡ)는 NFC 뒤 한 글자
		expect(queryLength("가")).toBe(1)
		// 이모지는 UTF-16 두 단위
		expect(queryLength("😀")).toBe(2)
		expect(queryLength(null)).toBe(0)
	})
})
