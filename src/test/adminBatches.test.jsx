import { describe, expect, it } from "vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"
import LoadDatasetCard from "../features/admin/batches/components/LoadDatasetCard"

// 데이터·배치 운영 틀 + 원천 적재·분석 일괄 실행 (SCRUM-220·345) — 계약서 B1·B2·B5, 화면 설계서 ADM-01.
// 위: 직접 실행하는 ① 원천 적재·분석 일괄 실행. 아래: 자동 처리 현황 ② 룰 스캔 → ③ 점수 산출 → ④ 케이스 생성.
// 네 배치 모두 202 → 상태 조회·목록(summary·progress)으로 그려요(BE SCRUM-356). 연쇄 한 바퀴는 adminBatchChain.test.
const ADMIN = { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" }
const INVESTIGATOR = { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" }
const SLOW = { timeout: 9000 }
const conflict = (code, message) =>
	HttpResponse.json({ error: { code, message, details: {} } }, { status: 409 })

function renderPage(user = ADMIN) {
	resetCases(user)
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

const region = (name) => screen.getByRole("region", { name })

async function load(user) {
	const card = await screen.findByRole("region", { name: "원천 적재" })
	expect(within(card).getByText("미적재")).toBeInTheDocument() // 적재 전 배지
	expect(await within(card).findByText("아직 적재된 원천 데이터가 없습니다.")).toBeInTheDocument()
	await user.click(within(card).getByRole("button", { name: "원천 적재 시작" }))
	const dialog = await screen.findByRole("dialog", { name: "원천 적재" })
	expect(dialog).toHaveTextContent("최초 한 번만")
	await user.click(within(dialog).getByRole("button", { name: "적재" }))
	return card
}

// [분석 일괄 실행]에서 날짜 → 시작. 진행·결과는 자동 처리 현황의 ② 룰 스캔이 보여 줘요(돌려주는 값)
async function startScan(user, date = "2022-09-02") {
	await user.type(await screen.findByLabelText("분석 날짜"), date)
	await user.click(
		within(region("분석 일괄 실행")).getByRole("button", { name: "일괄 실행 시작" }),
	)
	const dialog = await screen.findByRole("dialog", { name: "분석 일괄 실행" })
	expect(dialog).toHaveTextContent(
		"룰 스캔 → 점수 산출 → 케이스 생성이 순서대로 자동 진행됩니다. 중간에 실패하면 재처리가 필요할 수 있습니다.",
	)
	await user.click(within(dialog).getByRole("button", { name: "시작" }))
	return region("룰 스캔")
}

describe("데이터·배치 운영 — 원천 적재·분석 일괄 실행 (SCRUM-220·345)", () => {
	it("위는 원천 적재·분석 일괄 실행, 아래 자동 처리 현황은 룰 스캔 → 점수 산출 → 케이스 생성이고 일반 실행 버튼이 없다", async () => {
		renderPage()
		await screen.findByRole("region", { name: "원천 적재" })
		expect(region("원천 적재")).toHaveTextContent("IBM 원천 데이터 최초 적재")
		expect(region("원천 적재")).not.toHaveTextContent("날짜와 무관한") // 규칙은 ⓘ 로
		expect(
			within(region("원천 적재")).getByRole("button", { name: "원천 적재 설명" }),
		).toHaveAccessibleDescription(/최초 한 번만/)
		const runCard = region("분석 일괄 실행")
		expect(runCard).toHaveTextContent("탐지부터 케이스 생성까지 자동 처리")
		expect(within(runCard).getByRole("button", { name: "일괄 실행 시작" })).toBeDisabled()
		expect(runCard).toHaveTextContent("원천 적재 완료 후 실행 가능")

		const flow = region("자동 처리 현황")
		const steps = within(flow).getAllByRole("listitem")
		expect(steps).toHaveLength(3)
		// 단계마다 아이콘 · 이름 · 상태 배지만(한 줄 설명 없음). 번호는 어디에도 없어요 — 위 [분석 일괄 실행]을 누르는 구조라
		const scopes = [
			"선택한 날짜의 이상거래 탐지",
			"룰 스캔 완료 후 자동 실행",
			"점수 산출 완료 후 자동 실행",
		]
		;["룰 스캔", "점수 산출", "케이스 생성"].forEach((title, i) => {
			expect(within(steps[i]).getByRole("heading", { name: title })).toBeInTheDocument()
			expect(steps[i].querySelector(".batch-step-icon")).not.toBeNull()
			expect(steps[i].querySelector(".batch-step-scope")).toHaveTextContent(scopes[i])
			expect(within(steps[i]).getByText("대기")).toBeInTheDocument()
		})
		expect(document.querySelector(".batch-step-no")).toBeNull()
		for (const step of steps) {
			expect(
				within(step).queryByRole("button", { name: /^(실행|일괄 실행 시작|케이스 생성)$/ }),
			).toBeNull()
		}
		expect(region("점수 산출")).not.toHaveTextContent("날짜를 골라") // 날짜 안내는 빼요
	})

	it("적재 202 → 완료 정보, 날짜를 골라 [일괄 실행 시작] → 확인창이 바로 닫히고 룰 스캔에 지금 룰·진행 막대 → 룰별 경보 수", async () => {
		const user = renderPage()
		const loadCard = await load(user)
		expect(
			await within(loadCard).findByRole("status", { name: "원천 적재 결과" }),
		).toHaveTextContent(/^적재 거래1건완료 시각\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
		expect(within(loadCard).getByRole("button", { name: "완료됨" })).toBeDisabled()

		const scanCard = await startScan(user)
		const runCard = region("분석 일괄 실행")
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "분석 일괄 실행" }),
			).not.toBeInTheDocument(),
		) // 202 를 받으면 닫혀요 — 실행은 뒤에서
		expect(within(runCard).getByLabelText("분석 날짜")).toHaveValue("2022-09-02")
		expect(await within(scanCard).findByText("R03 환전 중계 실행 중 (3/6)")).toBeInTheDocument()
		expect(within(scanCard).getByRole("progressbar", { name: "룰 스캔 진행" })).toHaveAttribute(
			"aria-valuenow",
			"50",
		)
		expect(within(scanCard).getByText("실행 중")).toBeInTheDocument()
		expect(within(runCard).getByRole("button", { name: "실행 중…" })).toBeDisabled()
		const table = () => within(region("실행 결과")).getByRole("table")
		expect(await within(table()).findByText("생성 경보 3건", {}, SLOW)).toBeInTheDocument()
		expect(table()).toHaveTextContent("분석 거래 1,200건")
		expect(table()).not.toHaveTextContent("R02 집중 입금") // 룰별 건수는 접혀 있다가
		await user.click(within(table()).getByRole("button", { name: "룰별 결과 보기" }))
		expect(within(table()).getByText("R02 집중 입금 · 3건")).toHaveAttribute(
			"title",
			"R02_FAN_IN 버전 1",
		)
		expect(within(table()).getByRole("button", { name: "룰별 결과 접기" })).toHaveAttribute(
			"aria-expanded",
			"true",
		)
		expect(scanCard).not.toHaveTextContent("만들었어요") // 칸에는 결과 설명 없음
		expect(within(runCard).getByRole("button", { name: "완료됨" })).toBeDisabled()
		expect(within(region("자동 처리 현황")).getAllByText("기준일 2022-09-02")).toHaveLength(1) // 제목 옆 한 번만
		const rows = table()
		expect(rows).toHaveTextContent("원천 적재완료적재 거래 1건완료 시각")
		expect(rows).toHaveTextContent("룰 스캔완료생성 경보 3건분석 거래 1,200건")
	}, 20000)

	it("시작 전 거절(409 이미 스캔한 날짜)은 확인창을 닫고 분석 일괄 실행 카드 안에 알리며 날짜를 남긴다", async () => {
		server.use(
			http.post("*/api/v1/admin/batches/rule-scan", () =>
				conflict("BATCH_ALREADY_DONE", "RULE_SCAN 2022-09-02 는 이미 성공한 배치입니다"),
			),
		)
		const user = renderPage()
		await load(user)
		await startScan(user)
		const card = region("분석 일괄 실행")
		expect(screen.queryByRole("dialog", { name: "분석 일괄 실행" })).not.toBeInTheDocument() // 바로 닫힘
		expect(await within(card).findByRole("alert")).toHaveTextContent("이미 성공한 배치입니다")
		expect(within(card).getByLabelText("분석 날짜")).toHaveValue("2022-09-02")
	})

	it("데이터 기간 밖 날짜(409 DATE_OUT_OF_RANGE)도 카드 안에 알린다", async () => {
		const user = renderPage()
		await load(user)
		await startScan(user, "2026-11-11")
		expect(await within(region("분석 일괄 실행")).findByRole("alert")).toHaveTextContent(
			"거래가 있는 날짜가 아닙니다",
		)
	})

	it("이미 스캔한 날짜를 고르면 서버 결과로 처음부터 완료이고, 룰 스캔이 실패했으면 실패로 보인다", async () => {
		server.use(
			http.get("*/api/v1/admin/batches", ({ request }) => {
				const date = new URL(request.url).searchParams.get("date")
				const items =
					date === "2022-09-05"
						? [
								{
									batch_run_id: 9,
									batch_type: "RULE_SCAN",
									batch_date: date,
									status: "SUCCEEDED",
									rows_in: 50,
									rows_out: 0,
									summary: {
										alerts_by_rule: [
											{
												rule_id: "R02_FAN_IN",
												rule_version: 1,
												alert_count: 0,
											},
										],
									},
									started_at: "2026-11-12T03:00:00Z",
									finished_at: "2026-11-12T03:00:02Z",
								},
							]
						: date === "2022-09-06"
							? [
									{
										batch_run_id: 10,
										batch_type: "RULE_SCAN",
										batch_date: date,
										status: "FAILED",
										error_message: "INVALID_RULE_PARAMS: R02 기준값 오류",
										started_at: "2026-11-12T03:00:00Z",
										finished_at: "2026-11-12T03:00:02Z",
									},
								]
							: []
				return HttpResponse.json({ items, page: 0, size: 20, total: items.length })
			}),
		)
		const user = renderPage()
		const card = await screen.findByRole("region", { name: "룰 스캔" })
		const runCard = region("분석 일괄 실행")
		await user.type(within(runCard).getByLabelText("분석 날짜"), "2022-09-05")
		expect(await within(card).findByText("완료")).toBeInTheDocument()
		expect(region("실행 결과")).toHaveTextContent("룰 스캔완료생성 경보 0건") // 결과는 표에
		expect(within(runCard).getByRole("button", { name: "완료됨" })).toBeDisabled()

		await user.clear(within(runCard).getByLabelText("분석 날짜"))
		await user.type(within(runCard).getByLabelText("분석 날짜"), "2022-09-06")
		expect(
			await within(card).findByText(
				"룰 스캔이 실패했어요. 사유는 실행 결과 표에서 확인해 주세요.",
			),
		).toBeInTheDocument()
		expect(region("실행 결과")).toHaveTextContent("INVALID_RULE_PARAMS: R02 기준값 오류") // 사유는 표의 비고
		expect(within(card).getByText("실패")).toBeInTheDocument()
		expect(
			within(region("점수 산출")).getByText("룰 스캔이 실패해 시작하지 않았어요."),
		).toBeInTheDocument()
	})

	it("이미 적재된 DB면 화면을 열 때부터 원천 적재가 완료(적재 거래·완료 시각)이고 일괄 실행 버튼이 진하다 (SCRUM-344)", async () => {
		server.use(
			http.get("*/api/v1/admin/batches", ({ request }) => {
				const url = new URL(request.url)
				if (url.searchParams.get("type") !== "LOAD_DATASET")
					return HttpResponse.json({ items: [], page: 0, size: 20, total: 0 })
				return HttpResponse.json({
					items: [
						{
							batch_run_id: 1,
							batch_type: "LOAD_DATASET",
							batch_date: "2026-11-12",
							status: "SUCCEEDED",
							rows_in: 5078345,
							rows_out: 5078345,
							started_at: "2026-11-12T03:00:00Z",
							finished_at: "2026-11-12T03:05:00Z",
						},
					],
					page: 0,
					size: 1,
					total: 1,
				})
			}),
		)
		const user = renderPage()
		const loadCard = await screen.findByRole("region", { name: "원천 적재" })
		expect(
			await within(loadCard).findByRole("status", { name: "원천 적재 결과" }),
		).toHaveTextContent(/^적재 거래5,078,345건완료 시각2026-11-12 \d{2}:05$/)
		expect(within(loadCard).getByRole("button", { name: "완료됨" })).toBeDisabled()
		expect(region("실행 결과")).toHaveTextContent(
			"원천 적재완료적재 거래 5,078,345건완료 시각 2026-11-12",
		)
		await user.type(screen.getByLabelText("분석 날짜"), "2022-09-02")
		const start = within(region("분석 일괄 실행")).getByRole("button", {
			name: "일괄 실행 시작",
		})
		expect(start).toBeEnabled()
		expect(start).toHaveAttribute("data-primary", "true")
	})

	it("적재 중에는 스피너·지금 단계·단계 막대·경과 시간을 보이고, 실행 결과 표에도 같은 단계가 남는다", async () => {
		let polls = 0
		server.use(
			http.get("*/api/v1/admin/batches/:id", ({ params }) => {
				polls += 1
				const done = polls > 1
				return HttpResponse.json({
					batch_run_id: Number(params.id),
					batch_type: "LOAD_DATASET",
					batch_date: "2026-11-12",
					status: done ? "SUCCEEDED" : "RUNNING",
					started_at: "2026-11-12T03:00:00Z",
					finished_at: done ? "2026-11-12T03:02:20Z" : null,
					rows_in: done ? 5078345 : null,
					rows_out: done ? 5078345 : null,
					progress: done ? null : { done: 2, total: 4, current: "TRANSACTIONS" },
				})
			}),
		)
		const user = renderPage()
		const card = await load(user)
		expect(
			await within(card).findByText(/적재 중 · 거래 파일 \(3\/4단계\)$/),
		).toBeInTheDocument()
		expect(within(card).getByRole("progressbar", { name: "원천 적재 진행" })).toHaveAttribute(
			"aria-valuenow",
			"75",
		)
		expect(within(card).getByText(/^경과 /)).toBeInTheDocument()
		expect(region("실행 결과")).toHaveTextContent(
			"원천 적재실행 중적재 중 · 거래 파일 (3/4단계)",
		)
		expect(await within(card).findByText("5,078,345건", {}, SLOW)).toBeInTheDocument()
		expect(within(card).queryByRole("progressbar")).not.toBeInTheDocument()
	}, 15000)

	it("적재 상태 자동 조회는 상한을 넘으면 멈추고 [상태 다시 확인]으로 직접 부른다", async () => {
		let done = false
		server.use(
			http.get("*/api/v1/admin/batches/:id", ({ params }) =>
				HttpResponse.json({
					batch_run_id: Number(params.id),
					batch_type: "LOAD_DATASET",
					batch_date: "2026-11-12",
					status: done ? "SUCCEEDED" : "RUNNING",
					rows_in: done ? 5078345 : null,
					rows_out: done ? 5078345 : null,
				}),
			),
		)
		resetCases(ADMIN)
		render(
			<QueryClientProvider client={createQueryClient()}>
				<LoadDatasetCard maxPollMs={50} />
			</QueryClientProvider>,
		)
		const user = userEvent.setup()
		const card = await load(user)
		expect(
			await within(card).findByText(/10분이 지나도 끝나지 않아 자동 확인을 멈췄어요/),
		).toBeInTheDocument()
		done = true
		await user.click(within(card).getByRole("button", { name: "상태 다시 확인" }))
		expect(await within(card).findByText("5,078,345건")).toBeInTheDocument()
	})

	it("화면을 다시 열었을 때 적재가 진행 중이면 그 실행을 이어서 조회하고, 마지막 적재가 실패였으면 실패로 보인다", async () => {
		let latest = "RUNNING"
		server.use(
			http.get("*/api/v1/admin/batches", ({ request }) => {
				const url = new URL(request.url)
				if (url.searchParams.get("type") !== "LOAD_DATASET")
					return HttpResponse.json({ items: [], page: 0, size: 20, total: 0 })
				const item = {
					batch_run_id: 5,
					batch_type: "LOAD_DATASET",
					batch_date: "2026-11-12",
					status: latest,
					started_at: "2026-11-12T03:00:00Z",
					finished_at: latest === "RUNNING" ? null : "2026-11-12T03:01:00Z",
					error_message: latest === "FAILED" ? "검증값 불일치 — 거래 수" : null,
				}
				return HttpResponse.json({ items: [item], page: 0, size: 1, total: 1 })
			}),
			http.get("*/api/v1/admin/batches/5", () =>
				HttpResponse.json({
					batch_run_id: 5,
					batch_type: "LOAD_DATASET",
					batch_date: "2026-11-12",
					status: "RUNNING",
					started_at: "2026-11-12T03:00:00Z",
					progress: { done: 2, total: 4, current: "TRANSACTIONS" },
				}),
			),
		)
		renderPage()
		const card = await screen.findByRole("region", { name: "원천 적재" })
		expect(
			await within(card).findByText(/적재 중 · 거래 파일 \(3\/4단계\)/),
		).toBeInTheDocument()
		expect(within(card).getByText("실행 중")).toBeInTheDocument()
		cleanup()

		latest = "FAILED"
		renderPage()
		const again = await screen.findByRole("region", { name: "원천 적재" })
		expect(
			await within(again).findByText("적재가 실패했어요. 넣던 데이터는 모두 되돌렸어요."),
		).toBeInTheDocument()
		expect(within(again).getByText("검증값 불일치 — 거래 수")).toBeInTheDocument()
		expect(within(again).getByRole("button", { name: "원천 적재 시작" })).toBeEnabled() // 다시 실행 가능
	})

	it("관리자가 아니면 화면을 볼 수 없다", async () => {
		renderPage(INVESTIGATOR)
		expect(await screen.findByRole("heading", { name: "권한이 없어요" })).toBeInTheDocument()
		expect(screen.queryByRole("region", { name: "케이스 생성" })).not.toBeInTheDocument()
	})
})
