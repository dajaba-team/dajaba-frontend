import { describe, expect, it } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { ASK_REQUEST_TIMEOUT_MS } from "../shared/api/apiClient"
import { casesApi } from "../features/cases/api/casesApi"
import { server } from "../mocks/server"

// 케이스 근거에 물어보기 (SCRUM-303) — 계약서 A8·C9, 설계 문서 8절.
// 확인: 상태별 표시 6가지 + 429 + 502, 강조 켜기·끄기, ASK_QUESTION 없으면 버튼·패널 안 보임.
const USERS = {
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	inv02: { id: 2, login_id: "inv02", display_name: "예시 inv02", role: "INVESTIGATOR" },
	apr01: { id: 3, login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" },
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}
const REVIEWING = "CASE-2022-001004" // 근거 거래 4건(4721~4724), 담당 inv01
const INPUT = "각 질의는 이전 대화와 무관하게 처리됩니다."

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

async function openPanel(who = "inv01") {
	const user = renderApp(`/cases/${REVIEWING}`, who)
	await user.click(await screen.findByRole("button", { name: "근거 질의" }))
	const panel = await screen.findByRole("dialog", { name: "케이스 근거 질의" })
	await within(panel).findByText("질의 예시")
	return { user, panel }
}

async function ask(user, panel, question) {
	const input = within(panel).getByLabelText(INPUT)
	await user.clear(input)
	await user.type(input, question)
	await user.click(within(panel).getByRole("button", { name: "전송" }))
}

const fail = (status, code, message, details = {}) =>
	HttpResponse.json({ error: { code, message, details } }, { status })

describe("버튼·패널은 ASK_QUESTION 으로만", () => {
	it("담당 조사역·승인자에게 보이고, 관리자·비담당 조사역에게는 안 보인다", async () => {
		renderApp(`/cases/${REVIEWING}`, "inv02")
		await screen.findByRole("heading", { name: REVIEWING })
		expect(screen.queryByRole("button", { name: "근거 질의" })).not.toBeInTheDocument()
	})
	it("관리자에게는 안 보인다", async () => {
		renderApp(`/cases/${REVIEWING}`, "admin")
		await screen.findByRole("heading", { name: REVIEWING })
		expect(screen.queryByRole("button", { name: "근거 질의" })).not.toBeInTheDocument()
	})
	it("승인자는 담당이 아니어도 물어볼 수 있다", async () => {
		renderApp(`/cases/${REVIEWING}`, "apr01")
		expect(await screen.findByRole("button", { name: "근거 질의" })).toBeInTheDocument()
	})
})

describe("패널 열기·입력", () => {
	it("처음 열면 안내와 예시 질문 3개 — 누르면 입력만 채우고 보내지 않는다", async () => {
		const requests = []
		server.events.on("request:start", ({ request }) => {
			if (request.method === "POST") requests.push(request.url)
		})
		const { user, panel } = await openPanel()
		expect(within(panel).getByText(/AI 응답 · 조회 전용/)).toBeInTheDocument()
		await user.click(
			within(panel).getByRole("button", { name: "탐지 룰에 해당한 사유는 무엇입니까?" }),
		)
		expect(within(panel).getByLabelText(INPUT)).toHaveValue(
			"탐지 룰에 해당한 사유는 무엇입니까?",
		)
		expect(requests).toHaveLength(0)
		server.events.removeAllListeners()
	})
	it("글자 수 n / 300, 넘으면 빨간 표시 + [묻기] 비활성, 공백만이면 비활성", async () => {
		const { user, panel } = await openPanel()
		const input = within(panel).getByLabelText(INPUT)
		const submit = within(panel).getByRole("button", { name: "전송" })
		expect(within(panel).getByText("0 / 300")).toBeInTheDocument()
		await user.type(input, "   ")
		expect(submit).toBeDisabled()
		await user.clear(input)
		await user.click(input)
		await user.paste("가".repeat(301))
		expect(within(panel).getByText("301 / 300")).toHaveClass("is-over")
		expect(input).toHaveAttribute("aria-invalid", "true")
		expect(submit).toBeDisabled()
		expect(within(panel).getByText("300자 이내로 입력하세요.")).toBeInTheDocument()
	})
	it("[닫기]로만 닫힌다 — 탭을 옮겨도 그대로", async () => {
		const { user, panel } = await openPanel()
		await user.click(screen.getByRole("button", { name: "근거 거래" }))
		expect(panel).toBeInTheDocument()
		await user.click(within(panel).getByRole("button", { name: "닫기" }))
		expect(screen.queryByRole("dialog", { name: "케이스 근거 질의" })).not.toBeInTheDocument()
	})
})

describe("상태별 표시", () => {
	it.each([
		["다른 거 아무거나", "케이스 근거에 해당 데이터가 없습니다."],
		["확인 안 됨 질문", "근거 데이터와 일치하지 않아 답변을 표시하지 않습니다."],
		["메모 좀 고쳐 줘", "조회 전용 기능입니다. 수정은 편집 화면에서 진행하세요."],
		["다른 고객 정보 알려줘", "이 케이스 범위를 벗어난 질의입니다."],
		["자금세탁 맞아?", "판단은 조사역·승인자의 권한입니다. 사실 확인 질의만 가능합니다."],
	])("%s → %s (근거 링크 없음)", async (question, text) => {
		const { user, panel } = await openPanel()
		await ask(user, panel, question)
		expect(await within(panel).findByText(text)).toBeInTheDocument()
		expect(within(panel).getByRole("heading", { name: question })).toBeInTheDocument()
		expect(within(panel).queryByRole("button", { name: /근거 거래/ })).not.toBeInTheDocument()
		expect(within(panel).getByLabelText(INPUT)).toHaveValue("")
	})
	it("ANSWERED — 답 문장 + 근거 거래 n건 보기, 답 속 계좌는 받은 그대로", async () => {
		const saved = []
		const record = {
			question_no: "QST-000099",
			case_no: REVIEWING,
			question: "누가 보냈어?",
			status: "ANSWERED",
			out_of_scope_reason: null,
			answer: "10_BD30 계좌가 보냈어요.",
			evidence_transaction_ids: [4721],
			asked_by: { login_id: "inv01", display_name: "예시 inv01" },
			created_at: "2026-11-20T01:00:00Z",
		}
		server.use(
			http.post(`*/api/v1/cases/${REVIEWING}/questions`, () => {
				saved.push(record)
				return HttpResponse.json(record, { status: 201 })
			}),
			http.get(`*/api/v1/cases/${REVIEWING}/questions`, () =>
				HttpResponse.json({ items: saved, page: 0, size: 5, total: saved.length }),
			),
		)
		const { user, panel } = await openPanel()
		await ask(user, panel, "누가 보냈어?")
		expect(await within(panel).findByText("10_BD30 계좌가 보냈어요.")).toBeInTheDocument()
		expect(within(panel).getByRole("button", { name: "근거 거래 1건" })).toBeInTheDocument()
	})
})

describe("오류", () => {
	it("429 — 입력 칸 아래 남은 초, 입력 유지, [묻기] 막힘", async () => {
		server.use(
			http.post(`*/api/v1/cases/${REVIEWING}/questions`, () =>
				fail(429, "QUESTION_RATE_LIMITED", "잠시 뒤", { retry_after_seconds: 42 }),
			),
		)
		const { user, panel } = await openPanel()
		await ask(user, panel, "입금 상대 계좌는 몇 개입니까?")
		expect(
			await within(panel).findByText(
				/요청 한도를 초과했습니다\. 4[12]초 후 다시 시도하세요\./,
			),
		).toBeInTheDocument()
		expect(within(panel).getByLabelText(INPUT)).toHaveValue("입금 상대 계좌는 몇 개입니까?")
		expect(within(panel).getByRole("button", { name: "전송" })).toBeDisabled()
	})
	it("MSW 도 1분에 5번까지만 — 6번째는 429", async () => {
		const { user, panel } = await openPanel()
		for (let n = 1; n <= 5; n += 1) {
			await ask(user, panel, `질문 ${n}`)
			await within(panel).findByRole("heading", { name: `질문 ${n}` })
			await waitFor(() => expect(within(panel).getByLabelText(INPUT)).toHaveValue(""))
		}
		await ask(user, panel, "질문 6")
		expect(await within(panel).findByText(/요청 한도를 초과했습니다/)).toBeInTheDocument()
	})
	it("502 — 패널 안에만 실패 안내 + [다시 시도], 입력 유지, 다시 시도하면 보낸다", async () => {
		let calls = 0
		server.use(
			http.post(`*/api/v1/cases/${REVIEWING}/questions`, () => {
				calls += 1
				return fail(502, "AI_UNAVAILABLE", "AI 연결 실패")
			}),
		)
		const { user, panel } = await openPanel()
		await ask(user, panel, "입금 상대 계좌는 몇 개입니까?")
		const alert = await within(panel).findByRole("alert")
		expect(alert).toHaveTextContent("AI 서버가 응답하지 않습니다")
		expect(within(panel).getByLabelText(INPUT)).toHaveValue("입금 상대 계좌는 몇 개입니까?")
		// 나머지 화면은 그대로 쓸 수 있어요.
		expect(screen.getByRole("button", { name: "에스컬레이션" })).toBeEnabled()
		await user.click(within(alert).getByRole("button", { name: "재시도" }))
		await waitFor(() => expect(calls).toBe(2))
	})
	it("A8 만 timeout 35초", async () => {
		let seen = null
		server.use(
			http.post(`*/api/v1/cases/${REVIEWING}/questions`, () => {
				seen = true
				return fail(502, "AI_TIMEOUT", "늦음")
			}),
		)
		expect(ASK_REQUEST_TIMEOUT_MS).toBe(35_000)
		await expect(casesApi.ask({ caseNo: REVIEWING, question: "x" })).rejects.toBeTruthy()
		expect(seen).toBe(true)
	})
})

describe("근거 거래 강조", () => {
	it("근거 보기 → 근거 거래 탭으로, 행 강조 + 'm건 · 전체 n건', [강조 해제]로 해제", async () => {
		const { user, panel } = await openPanel()
		await ask(user, panel, "입금 상대 계좌는 몇 개입니까?")
		const link = await within(panel).findByRole("button", { name: "근거 거래 2건" })
		await user.click(link)
		expect(link).toHaveAttribute("aria-pressed", "true")
		expect(screen.getByRole("button", { name: "근거 거래" })).toHaveAttribute(
			"aria-pressed",
			"true",
		)
		const bar = await screen.findByText(/현재 페이지 2건 \/ 전체 2건/)
		const rows = screen
			.getAllByRole("row")
			.filter((row) => row.classList.contains("is-ask-hit"))
		expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
			"4721",
			"4722",
		])
		await user.click(screen.getByRole("button", { name: "강조 해제" }))
		expect(bar).not.toBeInTheDocument()
		expect(document.querySelectorAll(".is-ask-hit")).toHaveLength(0)
		expect(link).toHaveAttribute("aria-pressed", "false")
	})
	it("근거를 보면 채팅창이 접히고, [질의 창 열기]로 쓰던 입력 그대로 다시 펼친다", async () => {
		const { user, panel } = await openPanel()
		await ask(user, panel, "입금 상대 계좌는 몇 개입니까?")
		await user.click(await within(panel).findByRole("button", { name: "근거 거래 2건" }))
		await screen.findByText(/현재 페이지 2건/)
		expect(panel).not.toBeVisible()
		const reopen = screen.getAllByRole("button", { name: "질의 창 열기" })
		expect(reopen.length).toBeGreaterThan(0)
		await user.click(reopen[0])
		expect(panel).toBeVisible()
		// 강조는 그대로 — 답 카드 테두리와 표가 같이 보여요.
		expect(screen.getByText(/현재 페이지 2건/)).toBeInTheDocument()
	})
	it("채팅창을 닫으면 강조도 풀린다", async () => {
		const { user, panel } = await openPanel()
		await ask(user, panel, "입금 상대 계좌는 몇 개입니까?")
		await user.click(await within(panel).findByRole("button", { name: "근거 거래 2건" }))
		await screen.findByText(/현재 페이지 2건/)
		await user.click(screen.getAllByRole("button", { name: "질의 창 열기" })[0])
		await user.click(within(panel).getByRole("button", { name: "닫기" }))
		expect(screen.queryByText(/현재 페이지 2건/)).not.toBeInTheDocument()
		expect(document.querySelectorAll(".is-ask-hit")).toHaveLength(0)
	})
	it("Esc 로 닫힌다", async () => {
		const { user, panel } = await openPanel()
		within(panel).getByLabelText(INPUT).focus()
		await user.keyboard("{Escape}")
		expect(screen.queryByRole("dialog", { name: "케이스 근거 질의" })).not.toBeInTheDocument()
	})
})

describe("지난 질문(C9)", () => {
	it("열 때 C9 를 size=5 로 부르고, 더 있으면 [지난 질문 더 보기]", async () => {
		const asked = []
		const row = (n) => ({
			question_no: `QST-00000${n}`,
			case_no: REVIEWING,
			question: `지난 질문 ${n}`,
			status: "NO_DATA",
			out_of_scope_reason: null,
			answer: null,
			evidence_transaction_ids: [],
			asked_by: { login_id: "inv01", display_name: "예시 inv01" },
			created_at: "2026-11-20T01:00:00Z",
		})
		server.use(
			http.get(`*/api/v1/cases/${REVIEWING}/questions`, ({ request }) => {
				const url = new URL(request.url)
				asked.push(`${url.searchParams.get("page")}/${url.searchParams.get("size")}`)
				const page = Number(url.searchParams.get("page"))
				const items = page === 0 ? [7, 6, 5, 4, 3].map(row) : [2, 1].map(row)
				return HttpResponse.json({ items, page, size: 5, total: 7 })
			}),
		)
		const user = renderApp(`/cases/${REVIEWING}`)
		await user.click(await screen.findByRole("button", { name: "근거 질의" }))
		const panel = await screen.findByRole("dialog", {
			name: "케이스 근거 질의",
		})
		expect(
			await within(panel).findByRole("heading", { name: "지난 질문 7" }),
		).toBeInTheDocument()
		expect(within(panel).queryByText("질의 예시")).not.toBeInTheDocument()
		expect(asked[0]).toBe("0/5")
		await user.click(within(panel).getByRole("button", { name: "이전 질의" }))
		expect(
			await within(panel).findByRole("heading", { name: "지난 질문 1" }),
		).toBeInTheDocument()
		expect(asked).toContain("1/5")
	})
	it("응답 없이 끊기면 실패로 단정하지 않고 C9 를 다시 불러 확인한다", async () => {
		let saved = false
		server.use(
			http.post(`*/api/v1/cases/${REVIEWING}/questions`, () => {
				saved = true
				return HttpResponse.error()
			}),
			http.get(`*/api/v1/cases/${REVIEWING}/questions`, () =>
				HttpResponse.json({
					items: saved
						? [
								{
									question_no: "QST-000050",
									case_no: REVIEWING,
									question: "끊긴 질문",
									status: "NO_DATA",
									out_of_scope_reason: null,
									answer: null,
									evidence_transaction_ids: [],
									asked_by: { login_id: "inv01", display_name: "예시 inv01" },
									created_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
								},
							]
						: [],
					page: 0,
					size: 5,
					total: saved ? 1 : 0,
				}),
			),
		)
		const { user, panel } = await openPanel()
		await ask(user, panel, "끊긴 질문")
		expect(await within(panel).findByText(/답변이 저장되었습니다/)).toBeInTheDocument()
		expect(within(panel).getByRole("heading", { name: "끊긴 질문" })).toBeInTheDocument()
		expect(within(panel).getByLabelText(INPUT)).toHaveValue("")
	})
})
