import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { seedCases } from "../mocks/cases"
import { askQuestion } from "../mocks/caseQuestions"
import { server } from "../mocks/server"
import { apiClient } from "../shared/api/apiClient"
import { ASK_REQUEST_TIMEOUT_MS } from "../features/cases/api/questionsApi"

// 질문 답변 패널 [근거에 물어보기] — 계약서 5.3 A8·C9, 설계 문서 8절 (SCRUM-303).
// MSW 는 질문 낱말로 상태를 골라요(src/mocks/caseQuestions.js).
const USERS = {
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	inv02: { id: 2, login_id: "inv02", display_name: "예시 inv02", role: "INVESTIGATOR" },
	apr01: { id: 3, login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" },
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}
const REVIEWING = "CASE-2022-001004" // inv01 담당, 근거 거래 4721~4724
const DRAFTED = "CASE-2022-001001" // inv01 담당, 5102 만 Euro
const OPEN = "CASE-2022-001002" // 담당자 없음

function renderApp(path, who = "inv01") {
	resetCases(USERS[who])
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={[path]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return userEvent.setup()
}

const fail = (status, code, message, details = {}) =>
	HttpResponse.json({ error: { code, message, details } }, { status })

const askButton = () => screen.queryByRole("button", { name: "근거에 물어보기" })

async function openPanel(user) {
	await user.click(await screen.findByRole("button", { name: "근거에 물어보기" }))
	return screen.findByRole("complementary", { name: "이 케이스 근거에 물어보기" })
}

async function ask(user, panel, question) {
	const input = within(panel).getByLabelText("질문")
	fireEvent.change(input, { target: { value: question } })
	await user.click(within(panel).getByRole("button", { name: "묻기" }))
}

const cards = (panel) => within(panel).queryAllByRole("listitem")

describe("버튼 — available_actions 의 ASK_QUESTION 으로만", () => {
	it("담당 조사역·승인자에게만 보이고, 담당 아닌 조사역·관리자·담당자 없는 OPEN 의 조사역에겐 없다", async () => {
		renderApp(`/cases/${REVIEWING}`, "inv01")
		expect(await screen.findByRole("button", { name: "근거에 물어보기" })).toBeInTheDocument()
	})
	it.each([
		["inv02", REVIEWING],
		["admin", REVIEWING],
		["inv01", OPEN],
	])("%s 는 %s 에서 버튼이 없다", async (who, caseNo) => {
		renderApp(`/cases/${caseNo}`, who)
		expect(await screen.findByRole("heading", { name: caseNo })).toBeInTheDocument()
		expect(askButton()).not.toBeInTheDocument()
	})
	it("승인자는 담당자 없는 OPEN 케이스에도 물을 수 있다", async () => {
		renderApp(`/cases/${OPEN}`, "apr01")
		expect(await screen.findByRole("button", { name: "근거에 물어보기" })).toBeInTheDocument()
	})
})

describe("묻고 → 답을 읽고 → 근거 거래 확인", () => {
	it("예시 칩은 입력만 채우고, 답 카드의 근거 거래를 누르면 거래 탭으로 옮겨 그 행을 칠한다", async () => {
		const posts = []
		server.events.on("request:start", ({ request }) => {
			if (request.method === "POST" && request.url.endsWith("/questions"))
				posts.push(request.url)
		})
		const user = renderApp(`/cases/${REVIEWING}`)
		const panel = await openPanel(user)
		expect(
			within(panel).getByText("AI 답변 · 조회만 해요. 본문에는 반영되지 않아요"),
		).toBeInTheDocument()

		// 처음 열면 예시 질문 3개 — 누르면 입력만 채워요
		const examples = await within(panel).findByRole("group", { name: "예시 질문" })
		expect(within(examples).getAllByRole("button")).toHaveLength(3)
		await user.click(within(examples).getByRole("button", { name: "입금 상대가 몇 곳이야?" }))
		expect(within(panel).getByLabelText("질문")).toHaveValue("입금 상대가 몇 곳이야?")
		expect(posts).toHaveLength(0)

		await user.click(within(panel).getByRole("button", { name: "묻기" }))
		const card = (await within(panel).findAllByRole("listitem"))[0]
		expect(within(card).getByText("입금 상대가 몇 곳이야?")).toBeInTheDocument()
		expect(within(card).getByText(/근거 거래 중 2건을 확인했어요/)).toBeInTheDocument()
		expect(within(panel).getByLabelText("질문")).toHaveValue("") // 성공하면 비워요
		expect(within(panel).queryByRole("group", { name: "예시 질문" })).not.toBeInTheDocument()

		// 근거 거래 강조 — 거래 근거 카드는 처음에 자금 흐름 탭이에요
		await user.click(within(card).getByRole("button", { name: "근거 거래 2건 보기" }))
		const tabs = screen.getByRole("group", { name: "거래 근거 보기" })
		expect(within(tabs).getByRole("button", { name: "근거 거래" })).toHaveAttribute(
			"aria-pressed",
			"true",
		)
		expect(await screen.findByText(/지금 페이지에서 2건 강조 · 전체 2건/)).toBeInTheDocument()
		const table = screen.getByLabelText("거래 표")
		const rows = within(table).getAllByRole("row").slice(1)
		expect(rows.filter((row) => row.classList.contains("case-row-highlight"))).toHaveLength(2)
		expect(within(rows[0]).getByText("답 근거")).toBeInTheDocument()
		expect(cards(panel)[0]).toHaveClass("is-highlighted")

		// 탭을 옮겨도 패널은 그대로, [강조 끄기]로 풀려요
		await user.click(within(tabs).getByRole("button", { name: "자금 흐름" }))
		expect(
			screen.getByRole("complementary", { name: "이 케이스 근거에 물어보기" }),
		).toBeInTheDocument()
		await user.click(within(tabs).getByRole("button", { name: "근거 거래" }))
		await user.click(screen.getByRole("button", { name: "강조 끄기" }))
		expect(screen.queryByText(/지금 페이지에서/)).not.toBeInTheDocument()
		expect(
			within(screen.getByLabelText("거래 표"))
				.getAllByRole("row")
				.slice(1)
				.some((r) => r.classList.contains("case-row-highlight")),
		).toBe(false)
		expect(cards(panel)[0]).not.toHaveClass("is-highlighted")
		server.events.removeAllListeners()
	})

	it("유로로 물으면 근거가 일부만 잡히고, 다시 누르면 근거 거래 탭으로 다시 옮긴다 · 닫으면 강조도 풀린다", async () => {
		const user = renderApp(`/cases/${DRAFTED}`)
		const panel = await openPanel(user)
		await ask(user, panel, "EUR 로 들어온 건 얼마야?")
		const card = (await within(panel).findAllByRole("listitem"))[0]
		await user.click(within(card).getByRole("button", { name: "근거 거래 1건 보기" }))
		expect(await screen.findByText(/지금 페이지에서 1건 강조 · 전체 1건/)).toBeInTheDocument()

		const tabs = screen.getByRole("group", { name: "거래 근거 보기" })
		await user.click(within(tabs).getByRole("button", { name: "자금 흐름" }))
		await user.click(within(card).getByRole("button", { name: "근거 거래 1건 보기" }))
		expect(within(tabs).getByRole("button", { name: "근거 거래" })).toHaveAttribute(
			"aria-pressed",
			"true",
		)

		await user.click(within(panel).getByRole("button", { name: "닫기" }))
		expect(
			screen.queryByRole("complementary", { name: "이 케이스 근거에 물어보기" }),
		).not.toBeInTheDocument()
		expect(screen.queryByText(/지금 페이지에서/)).not.toBeInTheDocument()
	})

	it("답하지 못한 네 가지는 화면 문구로 보여 주고 근거 링크가 없다", async () => {
		const user = renderApp(`/cases/${REVIEWING}`)
		const panel = await openPanel(user)
		const expected = [
			["본문을 고쳐 줘", "이 기능은 조회만 해요. 수정은 편집 화면에서 해 주세요"],
			["다른 고객 정보도 알려 줘", "이 케이스 근거로는 답할 수 없어요"],
			["자금세탁 맞아?", "판단은 조사역과 승인자가 해요. 근거 사실만 물어봐 주세요"],
			["고객 주소가 어디야?", "이 케이스 근거에는 그 값이 없어요"],
			["검증된 값만 알려 줘", "근거로 확인되지 않아 답을 보여 드리지 않아요"],
		]
		for (const [question, text] of expected) {
			await ask(user, panel, question)
			const card = await within(panel).findByRole("listitem", {
				name: (_, element) => within(element).queryByText(question) !== null,
			})
			expect(within(card).getByText(text)).toBeInTheDocument()
			expect(
				within(card).queryByRole("button", { name: /근거 거래/ }),
			).not.toBeInTheDocument()
		}
		expect(cards(panel)).toHaveLength(5)
	})
})

describe("입력·호출 규칙", () => {
	it("글자 수는 NFC 로 세고 300자를 넘거나 비었으면 [묻기]를 막는다", async () => {
		const user = renderApp(`/cases/${REVIEWING}`)
		const panel = await openPanel(user)
		const input = within(panel).getByLabelText("질문")
		const button = within(panel).getByRole("button", { name: "묻기" })
		expect(button).toBeDisabled()
		fireEvent.change(input, { target: { value: "   " } })
		expect(button).toBeDisabled()
		fireEvent.change(input, { target: { value: "가".repeat(300) } })
		expect(within(panel).getByText("300 / 300")).not.toHaveClass("is-over")
		expect(button).toBeEnabled()
		fireEvent.change(input, { target: { value: "가".repeat(301) } })
		expect(within(panel).getByText("301 / 300")).toHaveClass("is-over")
		expect(button).toBeDisabled()
		// 자소로 쪼갠(NFD) 한글 300자도 NFC 로 300자
		fireEvent.change(input, { target: { value: "한".repeat(300).normalize("NFD") } })
		expect(within(panel).getByText("300 / 300")).toBeInTheDocument()
	})

	it("질문하기만 timeout 35초로 보내고, 질문은 앞뒤 공백을 자르지 않는다", async () => {
		const posted = vi.spyOn(apiClient, "post")
		const user = renderApp(`/cases/${REVIEWING}`)
		const panel = await openPanel(user)
		await ask(user, panel, "  몇 건이야?  ")
		await waitFor(() =>
			expect(posted).toHaveBeenCalledWith(
				`/api/v1/cases/${REVIEWING}/questions`,
				{ question: "  몇 건이야?  " },
				{ timeout: ASK_REQUEST_TIMEOUT_MS },
			),
		)
		expect(ASK_REQUEST_TIMEOUT_MS).toBe(35_000)
		posted.mockRestore()
	})

	it("기다리는 동안 '근거를 확인하는 중이에요'와 [묻기] 막기", async () => {
		let release
		const gate = new Promise((resolve) => (release = resolve))
		server.use(
			http.post(`*/api/v1/cases/${REVIEWING}/questions`, async () => {
				await gate
				return fail(502, "AI_TIMEOUT", "AI 응답이 늦어 처리하지 못했습니다")
			}),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		const panel = await openPanel(user)
		await ask(user, panel, "몇 건이야?")
		expect(await within(panel).findByRole("status")).toHaveTextContent(
			"근거를 확인하는 중이에요",
		)
		expect(within(panel).getByRole("button", { name: "묻기" })).toBeDisabled()
		release()
		expect(await within(panel).findByRole("alert")).toBeInTheDocument()
	})
})

describe("실패 — 패널 안에만, 입력 유지", () => {
	it("429 면 입력 칸 아래 '잠시 뒤 다시 물어봐 주세요(N초)'", async () => {
		server.use(
			http.post(`*/api/v1/cases/${REVIEWING}/questions`, () =>
				fail(429, "QUESTION_RATE_LIMITED", "잠시 뒤 다시 물어봐 주세요", {
					retry_after_seconds: 42,
				}),
			),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		const panel = await openPanel(user)
		await ask(user, panel, "몇 건이야?")
		expect(
			await within(panel).findByText("잠시 뒤 다시 물어봐 주세요(42초)"),
		).toBeInTheDocument()
		expect(within(panel).getByLabelText("질문")).toHaveValue("몇 건이야?")
		expect(within(panel).getByLabelText("질문")).toHaveAttribute("aria-invalid", "true")
		expect(within(panel).queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument()
	})

	it("목업 서버도 한 사람이 60초에 5번 넘게 물으면 429 를 준다", async () => {
		const user = renderApp(`/cases/${REVIEWING}`)
		const panel = await openPanel(user)
		for (let i = 1; i <= 5; i += 1) {
			await ask(user, panel, `질문 ${i}`)
			await within(panel).findByText(`질문 ${i}`)
		}
		await ask(user, panel, "여섯째")
		expect(
			await within(panel).findByText(/잠시 뒤 다시 물어봐 주세요\(\d+초\)/),
		).toBeInTheDocument()
	})

	it("502 면 패널 안 실패 안내 + [다시 시도], 다시 누르면 같은 질문을 보낸다 · 나머지 화면은 그대로", async () => {
		server.use(
			http.post(
				`*/api/v1/cases/${REVIEWING}/questions`,
				() => fail(502, "AI_UNAVAILABLE", "AI 서버에 연결하지 못했습니다"),
				{ once: true },
			),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		const panel = await openPanel(user)
		await ask(user, panel, "입금 상대가 몇 곳이야?")
		const alert = await within(panel).findByRole("alert")
		expect(within(panel).getByLabelText("질문")).toHaveValue("입금 상대가 몇 곳이야?")
		const outside = screen.getAllByRole("alert").filter((node) => !panel.contains(node))
		expect(outside).toHaveLength(0)
		expect(screen.getByRole("button", { name: "에스컬레이션" })).toBeEnabled()

		await user.click(within(alert).getByRole("button", { name: "다시 시도" }))
		expect(await within(panel).findByText(/근거 거래 중 2건을 확인했어요/)).toBeInTheDocument()
		expect(within(panel).queryByRole("alert")).not.toBeInTheDocument()
	})

	it("응답 없이 끊겨도 지난 질문을 다시 불러 저장됐으면 실패로 띄우지 않는다", async () => {
		server.use(
			http.post(`*/api/v1/cases/${REVIEWING}/questions`, async ({ request }) => {
				// 서버에는 저장된 상황 — 목업 저장소에 한 줄 남기고 응답만 끊어요
				const item = seedCases().find((entry) => entry.case_no === REVIEWING)
				askQuestion(USERS.inv01, item, await request.json())
				return HttpResponse.error()
			}),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		const panel = await openPanel(user)
		await within(panel).findByRole("group", { name: "예시 질문" })
		await ask(user, panel, "끊겨도 저장된 질문")
		expect(await within(panel).findByText("끊겨도 저장된 질문")).toBeInTheDocument()
		await waitFor(() => expect(within(panel).getByLabelText("질문")).toHaveValue(""))
		expect(within(panel).queryByRole("alert")).not.toBeInTheDocument()
	})

	it("응답 없이 끊기고 저장도 안 됐으면 '응답을 확인하지 못했다'고 안내하고 입력은 남긴다", async () => {
		server.use(http.post(`*/api/v1/cases/${REVIEWING}/questions`, () => HttpResponse.error()))
		const user = renderApp(`/cases/${REVIEWING}`)
		const panel = await openPanel(user)
		await within(panel).findByRole("group", { name: "예시 질문" })
		await ask(user, panel, "저장 안 된 질문")
		expect(await within(panel).findByRole("alert")).toHaveTextContent(
			"서버 응답을 확인하지 못했습니다",
		)
		expect(within(panel).getByLabelText("질문")).toHaveValue("저장 안 된 질문")
		expect(within(panel).queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument()
	})
})
