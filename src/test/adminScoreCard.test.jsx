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

// [점수 산출] 카드 (SCRUM-221) — 계약서 B3, 화면 설계서 ADM-01-E. 테스트 11-1·11-2·12-7 의 화면 항목.
const ADMIN = { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" }

function renderPage() {
	resetCases(ADMIN)
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

async function pickDate(user, date = "2022-09-02") {
	await user.type(await screen.findByLabelText("분석 날짜"), date)
}

// MSW 기본 흐름: 적재 → 룰 스캔이 성공해야 점수(409 RULE_SCAN_NOT_DONE 아님)
async function loadAndScan(user) {
	const load = await screen.findByRole("region", { name: "원천 적재" })
	await user.click(within(load).getByRole("button", { name: "실행" }))
	await user.click(
		within(await screen.findByRole("dialog", { name: "원천 적재" })).getByRole("button", {
			name: "적재",
		}),
	)
	await within(load).findByText(/적재했어요/)
	await pickDate(user)
	await user.click(
		within(screen.getByRole("region", { name: "룰 스캔" })).getByRole("button", {
			name: "실행",
		}),
	)
	await user.click(
		within(await screen.findByRole("dialog", { name: "룰 스캔" })).getByRole("button", {
			name: "실행",
		}),
	)
	await screen.findByText(/경보 3건을 만들었어요/)
}

const scoreResponse = (fields) => ({
	batch_run_id: 9,
	batch_type: "SCORE_REQUEST",
	batch_date: "2022-09-02",
	status: "SUCCEEDED",
	requested: 0,
	scored: 0,
	failed: 0,
	retryable: 0,
	chunks: { total: 0, failed: 0 },
	model_versions: [],
	started_at: "2026-11-12T03:00:00Z",
	finished_at: "2026-11-12T03:00:04Z",
	...fields,
})

describe("데이터·배치 운영 — 점수 산출 (SCRUM-221)", () => {
	it("일부 실패면 200 이어도 실패 건수·저위험 아님을 알리고 [점수 재처리]로 남은 것만 다시 보낸다", async () => {
		const user = renderPage()
		await loadAndScan(user)

		await user.click(within(scoreCard()).getByRole("button", { name: "실행" }))
		expect(
			await within(scoreCard()).findByText(
				"점수 2건 성공, 1건 실패. 실패가 저위험을 뜻하지 않습니다.",
			),
		).toBeInTheDocument()
		expect(within(scoreCard()).getByText("일부 실패")).toBeInTheDocument() // 상태 배지
		expect(within(scoreCard()).getByText(/다시 보낼 실패 1건/)).toBeInTheDocument()
		const results = screen.getByRole("region", { name: "실행 결과" })
		expect(results).toHaveTextContent("점수 산출일부 실패2022-09-02 성공 2 / 실패 1실패 재처리")

		await user.click(within(scoreCard()).getByRole("button", { name: "점수 재처리" }))
		expect(await within(scoreCard()).findByText("점수 1건을 산출했어요.")).toBeInTheDocument()
		expect(within(scoreCard()).getByRole("button", { name: "실행" })).toBeEnabled()
		expect(within(scoreCard()).getByText("완료")).toBeInTheDocument()
		expect(results).toHaveTextContent("점수 산출완료2022-09-02 성공 1 / 실패 0케이스 생성")
	})

	it("날짜 전엔 못 누르고, 대상 0건과 다시 보내도 안 바뀌는 실패를 따로 보여 준다", async () => {
		let body = scoreResponse({})
		server.use(http.post("*/api/v1/admin/batches/score", () => HttpResponse.json(body)))
		const user = renderPage()
		await screen.findByRole("region", { name: "점수 산출" })
		expect(within(scoreCard()).getByRole("button", { name: "실행" })).toBeDisabled()

		await pickDate(user)
		await user.click(within(scoreCard()).getByRole("button", { name: "실행" }))
		expect(await within(scoreCard()).findByText(/점수를 낼 경보가 없어요/)).toBeInTheDocument()

		body = scoreResponse({
			status: "FAILED",
			requested: 600,
			scored: 598,
			failed: 2,
			retryable: 1,
			chunks: { total: 2, failed: 1 },
			model_versions: ["model-v2"],
		})
		await user.click(within(scoreCard()).getByRole("button", { name: "실행" }))
		expect(await within(scoreCard()).findByText(/598건 성공, 2건 실패/)).toBeInTheDocument()
		expect(within(scoreCard()).getByText(/다시 보낼 실패 1건/)).toBeInTheDocument()
		expect(
			within(scoreCard()).getByText(/다시 보내도 결과가 바뀌지 않는 실패 1건/),
		).toBeInTheDocument()
		expect(
			within(scoreCard()).getByText("묶음 2개 중 호출 실패 1개 · 모델 model-v2"),
		).toBeInTheDocument()
		expect(within(scoreCard()).getByText("일부 실패")).toBeInTheDocument()

		// AI 가 꺼져 하나도 성공 못 하면(테스트 11-2) 배지는 "일부 실패"가 아니라 "실패", 다음 행동은 재처리
		body = scoreResponse({
			status: "FAILED",
			requested: 1850,
			failed: 1850,
			retryable: 1850,
			chunks: { total: 4, failed: 4 },
		})
		await user.click(within(scoreCard()).getByRole("button", { name: "점수 재처리" }))
		expect(await within(scoreCard()).findByText(/0건 성공, 1,850건 실패/)).toBeInTheDocument()
		expect(within(scoreCard()).getByText("실패")).toBeInTheDocument()
		expect(within(scoreCard()).queryByText("일부 실패")).not.toBeInTheDocument()
		expect(screen.getByRole("region", { name: "실행 결과" })).toHaveTextContent(
			"점수 산출실패2022-09-02 성공 0 / 실패 1,850실패 재처리",
		)
	})

	it("룰 스캔 전이면(409 RULE_SCAN_NOT_DONE) 카드에 알리고 날짜를 남긴다", async () => {
		const user = renderPage()
		await pickDate(user, "2022-09-05")
		await user.click(within(scoreCard()).getByRole("button", { name: "실행" }))
		expect(await within(scoreCard()).findByRole("alert")).toHaveTextContent(
			"2022-09-05 룰 스캔이 아직 성공하지 않았습니다",
		)
		expect(within(scoreCard()).getByText("대기")).toBeInTheDocument()
		expect(screen.getByLabelText("분석 날짜")).toHaveValue("2022-09-05")
	})
})
