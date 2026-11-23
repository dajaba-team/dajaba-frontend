import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"

// [점수 산출] 단계 (SCRUM-221·345) — 계약서 B3, 화면 설계서 ADM-01-E. 테스트 11-1·11-2·12-7 의 화면 항목.
// 자동 실행 단계라 그 날짜 실행 목록의 summary 로 그려요(BE SCRUM-356). 칸에는 상태만, 건수·모델·실패 설명은 실행 결과 표(결과·비고).
// 일부 실패·재처리 한 바퀴는 adminBatchChain.test.
const ADMIN = { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" }
const DAY = "2022-09-02"

function renderPage() {
	resetCases(ADMIN)
	sessionStorage.clear() // 기억한 분석 날짜는 테스트마다 비워요
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={["/admin/batches"]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return userEvent.setup()
}

const scoreCard = () => screen.getByRole("region", { name: "점수 산출" })
const resultTable = () =>
	within(screen.getByRole("region", { name: "실행 결과" })).getByRole("table")
const listOf = (items) => HttpResponse.json({ items, page: 0, size: 20, total: items.length })
const scoreRun = (fields) => ({
	batch_run_id: 12,
	batch_type: "SCORE_REQUEST",
	batch_date: DAY,
	started_at: "2026-11-21T03:00:00Z",
	finished_at: "2026-11-21T03:00:30Z",
	rows_in: null,
	rows_out: null,
	error_message: null,
	progress: null,
	...fields,
})
const summary = (fields) => ({
	requested: 3,
	scored: 3,
	failed: 0,
	retryable: 0,
	chunks: { total: 1, failed: 0 },
	model_versions: ["stub-1"],
	...fields,
})
const serveScore = (run) =>
	server.use(
		http.get("*/api/v1/admin/batches", ({ request }) =>
			new URL(request.url).searchParams.get("date") === DAY ? listOf([run]) : listOf([]),
		),
	)

async function pickDate(user, date = DAY) {
	await user.type(await screen.findByLabelText("분석 날짜"), date)
}

describe("데이터·배치 운영 — 점수 산출 (SCRUM-221·345)", () => {
	it("설명은 늘 '룰 스캔 완료 후 자동 실행', 기준일은 단계가 아니라 자동 처리 현황 제목 옆에 한 번", async () => {
		const user = renderPage()
		await screen.findByRole("region", { name: "점수 산출" })
		expect(within(scoreCard()).getByText("룰 스캔 완료 후 자동 실행")).toBeInTheDocument()
		expect(screen.queryByText(/^기준일/)).toBeNull()
		await pickDate(user)
		expect(
			within(screen.getByRole("region", { name: "자동 처리 현황" })).getByText(
				`기준일 ${DAY}`,
			),
		).toBeInTheDocument()
		expect(within(scoreCard()).queryByText(/기준일/)).toBeNull()
		expect(within(scoreCard()).getByText("대기")).toBeInTheDocument()
	})

	it("성공했어도 다시 보내도 같은 실패는 비고에 따로 적고, 칸엔 재처리 버튼이 없다", async () => {
		serveScore(
			scoreRun({
				status: "SUCCEEDED",
				rows_in: 3,
				rows_out: 2,
				summary: summary({ scored: 2, failed: 1, retryable: 0 }),
			}),
		)
		const user = renderPage()
		await pickDate(user)
		const card = scoreCard()
		expect(await within(card).findByText("완료")).toBeInTheDocument()
		expect(within(card).queryByRole("button", { name: "점수 재처리" })).toBeNull()
		expect(resultTable()).toHaveTextContent("점수 산출완료성공 2 · 실패 1")
		expect(resultTable()).toHaveTextContent(
			"다시 보내도 같은 실패 1건(경보 점검에서 원인 확인)",
		)
		expect(resultTable()).toHaveTextContent("모델 stub-1")
	})

	it("대상이 0건이어도 완료이고 표에 0건으로 남는다", async () => {
		serveScore(
			scoreRun({
				status: "SUCCEEDED",
				rows_in: 0,
				rows_out: 0,
				summary: summary({
					requested: 0,
					scored: 0,
					chunks: { total: 0, failed: 0 },
					model_versions: [],
				}),
			}),
		)
		const user = renderPage()
		await pickDate(user)
		expect(await within(scoreCard()).findByText("완료")).toBeInTheDocument()
		expect(resultTable()).toHaveTextContent("성공 0 · 실패 0")
	})

	it("하나도 성공 못 하고 실패했으면 '실패' 배지와 [점수 재처리], 재처리 거절(409)은 칸 안에 알린다", async () => {
		serveScore(
			scoreRun({
				status: "FAILED",
				error_message: "대상 3 · 점수 0 · 실패 3(다시 보낼 것 3)",
				summary: summary({
					scored: 0,
					failed: 3,
					retryable: 3,
					chunks: { total: 1, failed: 1 },
				}),
			}),
		)
		server.use(
			http.post("*/api/v1/admin/batches/score", () =>
				HttpResponse.json(
					{
						error: {
							code: "BATCH_RUNNING",
							message: "같은 날짜의 점수 배치가 실행 중입니다",
							details: {},
						},
					},
					{ status: 409 },
				),
			),
		)
		const user = renderPage()
		await pickDate(user)
		const card = scoreCard()
		expect(await within(card).findByText("다시 보낼 실패 3건이 남았어요.")).toBeInTheDocument()
		expect(within(card).getByText("실패")).toBeInTheDocument()
		expect(resultTable()).toHaveTextContent(
			"성공 0 · 실패 3 — [점수 재처리]로 남은 것만 다시 보내요",
		)
		await user.click(within(card).getByRole("button", { name: "점수 재처리" }))
		expect(await within(card).findByText(/실행 중/)).toBeInTheDocument()
	})
})
