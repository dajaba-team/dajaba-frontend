import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"
import { seedStrDrafts, visibleStrDraft } from "../mocks/strDrafts"
import { strApi } from "../features/str/api/strApi"

// 참고 사례 관련 구절 excerpt (SCRUM-427) — S2 references[]·S9 items[] 맨 끝 칸, 문자열|null(없어도 됨).
// 빈 문자열·공백·문자열이 아닌 값은 null. 카드 툴팁은 배치 결정 전이라 화면은 지금과 같아요.
const inv01 = { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" }
const CASE_NO = "CASE-2022-001001"
const DRAFT_NO = "DRF-000124"
const EXCERPT =
	"Funds from many accounts were pooled into a single account before being moved abroad."

const ref = (excerpt, extra = {}) => ({
	chunk_id: "chk-1",
	doc_id: "doc-1",
	doc_title: "APG Yearly Typologies Report 2025",
	page: 53,
	score: 0.58,
	...extra,
	...(excerpt === undefined ? {} : { excerpt }),
})

/** S2 를 그 references 로 — 나머지는 MSW 시드 그대로. */
function draftWithReferences(references) {
	const seeded = seedStrDrafts().find((draft) => draft.draft_no === DRAFT_NO)
	server.use(
		http.get(`*/api/v1/str-drafts/${DRAFT_NO}`, () =>
			HttpResponse.json({ ...visibleStrDraft(inv01, seeded), references }),
		),
	)
}

function searchReturns(items) {
	server.use(
		http.post(`*/api/v1/str-drafts/${DRAFT_NO}/references/search`, () =>
			HttpResponse.json({ items, degraded: false }),
		),
	)
}

const item = (excerpt) => ({
	doc_title: "FATF Professional Money Laundering",
	publisher: "FATF",
	year: 2018,
	page: 21,
	score: 0.52,
	typologies: ["FAN_IN"],
	source_type: "TYPOLOGY_REPORT",
	...(excerpt === undefined ? {} : { excerpt }),
})

describe("excerpt 변환 — 초안 참고 사례(S2)", () => {
	it("문자열이면 그대로, 칸 없음·null·빈 값·공백·문자열 아님은 null", async () => {
		resetCases(inv01)
		draftWithReferences([
			ref(EXCERPT),
			ref(undefined),
			ref(null),
			ref(""),
			ref("   "),
			ref(42),
			ref({ text: EXCERPT }),
		])
		const draft = await strApi.getDraft(DRAFT_NO)
		expect(draft.references.map((row) => row.excerpt)).toEqual([
			EXCERPT,
			null,
			null,
			null,
			null,
			null,
			null,
		])
		// 다른 칸은 그대로
		expect(draft.references[0]).toMatchObject({
			chunkId: "chk-1",
			docTitle: "APG Yearly Typologies Report 2025",
			page: 53,
			score: 0.58,
		})
	})

	it("줄바꿈이 든 영어 원문도 고치지 않고 그대로", async () => {
		resetCases(inv01)
		const multiline = "First line of the passage.\nSecond line keeps its break."
		draftWithReferences([ref(multiline)])
		const draft = await strApi.getDraft(DRAFT_NO)
		expect(draft.references[0].excerpt).toBe(multiline)
	})

	// 길이 기준은 AI·BE와 같게 NFC 뒤 UTF-16 코드 단위 300 이하(11/25 결정). 넘으면 계약 밖이라 보여 주지 않아요(null).
	it("300 단위는 그대로, 301 단위·299자 + 이모지 1개(301 단위)는 null", async () => {
		resetCases(inv01)
		const at300 = "a".repeat(300)
		const at301 = "a".repeat(301)
		const emoji301 = `${"a".repeat(299)}😀`
		expect(emoji301.length).toBe(301)
		draftWithReferences([ref(at300), ref(at301), ref(emoji301)])
		searchReturns([item(at300), item(at301), item(emoji301)])
		const draft = await strApi.getDraft(DRAFT_NO)
		expect(draft.references.map((row) => row.excerpt)).toEqual([at300, null, null])
		const result = await strApi.searchReferences({
			draftNo: DRAFT_NO,
			typologies: ["FAN_IN"],
			query: "",
		})
		expect(result.items.map((row) => row.excerpt)).toEqual([at300, null, null])
	})

	it("NFC 로 합치면 300 단위 안이면 그대로(분해된 한글 자모)", async () => {
		resetCases(inv01)
		// "가"를 분해(ᄀ + ᅡ)하면 2 단위, NFC 로 합치면 1 단위 — 200개는 분해 400 · NFC 200
		const decomposed = "가".normalize("NFD").repeat(200)
		expect(decomposed.length).toBe(400)
		draftWithReferences([ref(decomposed)])
		const draft = await strApi.getDraft(DRAFT_NO)
		expect(draft.references[0].excerpt).not.toBeNull()
	})
})

describe("excerpt 변환 — 참고 사례 찾기 결과(S9)", () => {
	it("문자열이면 그대로, 칸 없음·null·빈 값·문자열 아님은 null", async () => {
		resetCases(inv01)
		searchReturns([item(EXCERPT), item(undefined), item(null), item(""), item(7)])
		const result = await strApi.searchReferences({
			draftNo: DRAFT_NO,
			typologies: ["FAN_IN"],
			query: "",
		})
		expect(result.items.map((row) => row.excerpt)).toEqual([EXCERPT, null, null, null, null])
		expect(result.items[0]).toMatchObject({ docTitle: "FATF Professional Money Laundering" })
	})
})

describe("MSW 목업 — excerpt 있는 것·없는 것이 섞여 있어요", () => {
	it("초안 시드 참고 사례에 excerpt 있음·null 이 모두 있다", async () => {
		resetCases(inv01)
		const draft = await strApi.getDraft(DRAFT_NO)
		const excerpts = draft.references.map((row) => row.excerpt)
		expect(excerpts.some((value) => typeof value === "string" && value.length > 0)).toBe(true)
		expect(excerpts).toContain(null)
	})

	it("찾기 결과에 excerpt 있음·null 이 모두 있고, 300자(UTF-16) 이하다", async () => {
		resetCases(inv01)
		const result = await strApi.searchReferences({
			draftNo: DRAFT_NO,
			typologies: ["FAN_IN", "FAN_OUT", "CYCLE"],
			query: "",
		})
		const excerpts = result.items.map((row) => row.excerpt)
		expect(excerpts.some((value) => typeof value === "string")).toBe(true)
		expect(excerpts).toContain(null)
		for (const value of excerpts.filter(Boolean))
			expect(value.normalize("NFC").length).toBeLessThanOrEqual(300)
	})
})

describe("화면 — excerpt 가 있는 카드 오른쪽 위에 HelpTooltip ⓘ", () => {
	const OLD_NOTE = "원문은 해당 문서의 쪽에서 확인해 주세요."
	const NEW_NOTE =
		"카드의 ⓘ에 마우스를 올리면 원문 발췌가 보여요. 전체 원문은 해당 문서의 쪽에서 확인해 주세요."
	const SECOND = "One incoming payment funded transfers to several unrelated recipients."

	function renderStr() {
		const user = userEvent.setup()
		render(
			<QueryClientProvider client={createQueryClient()}>
				<MemoryRouter initialEntries={[`/cases/${CASE_NO}/str`]}>
					<App />
				</MemoryRouter>
			</QueryClientProvider>,
		)
		return user
	}

	/** ⓘ 버튼이 aria-describedby 로 가리키는 말풍선. */
	const bubbleOf = (button) => document.getElementById(button.getAttribute("aria-describedby"))
	const questionIn = (card) => within(card).queryByRole("button", { name: /^원문 발췌 — / })

	async function openSearchResults(user, panel) {
		await user.click(within(panel).getByRole("button", { name: "유형으로 더 찾아보기" }))
		await user.click(within(panel).getByRole("button", { name: "찾기" }))
		return within(panel).findByRole("list", { name: "찾은 참고 사례" })
	}

	it("초안 자료: excerpt 있는 카드만 ⓘ가 있고, 포커스·hover 때 제목과 구절이 연결된다", async () => {
		resetCases(inv01)
		draftWithReferences([
			ref(EXCERPT, { doc_title: "APG Yearly Typologies Report 2025" }),
			ref(null, { chunk_id: "chk-2", doc_title: "FATF Professional Money Laundering" }),
		])
		const user = renderStr()
		const panel = await screen.findByRole("region", { name: "참고 사례" })
		const [withExcerpt, without] = within(
			within(panel).getByRole("list", { name: "초안에 붙은 참고 사례" }),
		).getAllByRole("listitem")

		expect(questionIn(without)).toBeNull()
		const button = questionIn(withExcerpt)
		expect(button).not.toBeNull()
		// 카드마다 구분되게 문서명이 이름에 들어가요(InfoTip 이 끝에 " 설명"을 붙여요)
		expect(button).toHaveAccessibleName("원문 발췌 — APG Yearly Typologies Report 2025 설명")
		const bubble = bubbleOf(button)
		expect(bubble).toHaveAttribute("role", "tooltip")
		// 제목 "[원문 발췌]" 다음 빈 줄 하나(<br /> 두 번), 그 다음 구절(리뷰 #122)
		expect(bubble.textContent).toBe(`[원문 발췌]${EXCERPT}`)
		expect(bubble.querySelectorAll("br")).toHaveLength(2)
		expect(bubble.firstChild.textContent).toBe("[원문 발췌]")
		expect(bubble).toHaveTextContent(EXCERPT)
		await user.hover(button)
		expect(bubble).toHaveTextContent(EXCERPT)
		button.focus()
		expect(button).toHaveFocus()
		expect(bubble).toHaveTextContent(EXCERPT)
		// Esc 로 닫아요 — InfoTip 은 포커스를 놓아 말풍선을 내려요
		await user.keyboard("{Escape}")
		expect(button).not.toHaveFocus()
		// 기존 글(문서명·쪽·유사도)은 그대로, 같은 순서
		expect(withExcerpt).toHaveTextContent(
			/APG Yearly Typologies Report 2025.*PDF 53쪽 · 유사도 0\.58/,
		)
		expect(without).toHaveTextContent("FATF Professional Money Laundering")
	})

	it("찾기 결과: excerpt 있는 카드만 ⓘ가 있고 구절이 연결된다", async () => {
		resetCases(inv01)
		draftWithReferences([ref(null)])
		searchReturns([item(SECOND), item(null)])
		const user = renderStr()
		const panel = await screen.findByRole("region", { name: "참고 사례" })
		const [withExcerpt, without] = within(await openSearchResults(user, panel))
			.getAllByRole("listitem")
			.filter((li) => li.parentElement.getAttribute("aria-label") === "찾은 참고 사례")
		expect(questionIn(without)).toBeNull()
		const button = questionIn(withExcerpt)
		expect(button).toHaveAccessibleName(/FATF Professional Money Laundering/)
		expect(bubbleOf(button).textContent).toBe(`[원문 발췌]${SECOND}`)
		expect(bubbleOf(button)).toHaveTextContent(SECOND)
		// 유형 배지 등 기존 글은 그대로
		expect(withExcerpt).toHaveTextContent("FATF 2018 · PDF 21쪽 · 유사도 0.52")
	})

	it("안내 문구: 그 목록에 excerpt 가 하나라도 있으면 새 문구, 없으면 지금 문구", async () => {
		resetCases(inv01)
		// 초안 자료엔 excerpt 있음, 찾기 결과엔 없음
		draftWithReferences([ref(EXCERPT), ref(null, { chunk_id: "chk-2", page: 21 })])
		searchReturns([item(null), item("   ")])
		const user = renderStr()
		const panel = await screen.findByRole("region", { name: "참고 사례" })
		expect(within(panel).getByText(NEW_NOTE)).toBeInTheDocument()
		await openSearchResults(user, panel)
		expect(within(panel).getAllByText(NEW_NOTE)).toHaveLength(1)
		expect(within(panel).getAllByText(OLD_NOTE)).toHaveLength(1)
		expect(panel).not.toHaveTextContent(/AI가 참고한/)
	})

	it("excerpt 가 하나도 없으면 ⓘ도 없고 지금과 같다", async () => {
		resetCases(inv01)
		draftWithReferences([ref(null), ref(undefined, { chunk_id: "chk-2", page: 21 })])
		searchReturns([item(null)])
		const user = renderStr()
		const panel = await screen.findByRole("region", { name: "참고 사례" })
		await openSearchResults(user, panel)
		expect(within(panel).queryAllByRole("button", { name: /^원문 발췌 — / })).toHaveLength(0)
		expect(within(panel).queryByRole("tooltip")).not.toBeInTheDocument()
		expect(within(panel).getAllByText(OLD_NOTE)).toHaveLength(2)
	})

	it("300자 구절도 말풍선에 그대로 다 들어간다", async () => {
		resetCases(inv01)
		const long = `${"Layered transfers moved funds across accounts. ".repeat(7)}`.slice(0, 300)
		expect(long.length).toBe(300)
		draftWithReferences([ref(long)])
		renderStr()
		const panel = await screen.findByRole("region", { name: "참고 사례" })
		const button = await within(panel).findByRole("button", { name: /^원문 발췌 — / })
		expect(bubbleOf(button).textContent).toContain(long)
	})
})
