import { describe, expect, it } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { resetCases } from "../mocks/handlers"
import { server } from "../mocks/server"

// 데이터·배치 운영 — 일괄 실행(BE SCRUM-356: 202 + 배치 자동 연쇄 항상 켜짐). 그 날짜 실행 목록으로 카드·표를 그려요.
// MSW: 목록을 읽을 때마다 한 걸음 — 룰 스캔 RUNNING → SUCCEEDED + 점수 RUNNING → SUCCEEDED + 케이스 생성 RUNNING → SUCCEEDED.
// ③ 점수·④ 케이스 생성은 자동 실행이라 일반 버튼이 없고, 실패했을 때만 재처리 버튼이 나와요.
const ADMIN = { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" }
const SLOW = { timeout: 9000 }
const DAY = "2022-09-02"

function renderPage(options) {
	resetCases(ADMIN, options)
	sessionStorage.clear() // 기억한 분석 날짜는 테스트마다 비워요
	return renderApp()
}

// 목업 상태(실행 기록)는 그대로 두고 화면만 다시 그려요 — 다른 메뉴에 갔다 오거나 새로고침한 것과 같아요
function renderApp() {
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

async function loadAndStart(user) {
	const load = await screen.findByRole("region", { name: "원천 적재" })
	await user.click(within(load).getByRole("button", { name: "원천 적재 시작" }))
	await user.click(
		within(await screen.findByRole("dialog", { name: "원천 적재" })).getByRole("button", {
			name: "적재",
		}),
	)
	await within(load).findByText("적재 거래")
	await user.type(screen.getByLabelText("분석 날짜"), DAY)
	await user.click(
		within(region("분석 일괄 실행")).getByRole("button", { name: "일괄 실행 시작" }),
	)
	await user.click(
		within(await screen.findByRole("dialog", { name: "분석 일괄 실행" })).getByRole("button", {
			name: "시작",
		}),
	)
}

const listOf = (items) => HttpResponse.json({ items, page: 0, size: 20, total: items.length })
const run = (fields) => ({
	batch_date: DAY,
	started_at: "2026-11-21T03:00:00Z",
	finished_at: "2026-11-21T03:00:30Z",
	rows_in: null,
	rows_out: null,
	error_message: null,
	summary: null,
	progress: null,
	...fields,
})

describe("데이터·배치 운영 — 일괄 실행·자동 연쇄 (SCRUM-345)", () => {
	it("경계_다른 메뉴에 갔다 오거나 새로고침해도 마지막 분석 날짜와 그 날짜 서버 상태(진행 중이면 폴링 재개)로 다시 그린다", async () => {
		const user = renderPage()
		await loadAndStart(user)
		// 룰 스캔이 막 시작된 상태에서 화면을 떠났다가
		expect(
			await within(region("룰 스캔")).findByText("R03 환전 중계 실행 중 (3/6)"),
		).toBeInTheDocument()
		cleanup()

		renderApp() // 돌아오면
		expect(await screen.findByLabelText("분석 날짜")).toHaveValue(DAY) // 날짜가 남아 있고
		expect(within(region("자동 처리 현황")).getByText(`기준일 ${DAY}`)).toBeInTheDocument()
		expect(
			await within(region("원천 적재")).findByRole("status", { name: "원천 적재 결과" }),
		).toBeInTheDocument() // 원천 적재도 서버 상태로 완료
		const table = () => within(region("실행 결과")).getByRole("table")
		// 진행 중이던 일괄 실행은 폴링을 이어 가 끝까지 보여요
		expect(await within(table()).findByText("생성 1건", {}, SLOW)).toBeInTheDocument()
		expect(within(region("룰 스캔")).getByText("완료")).toBeInTheDocument()
		expect(within(region("점수 산출")).getByText("완료")).toBeInTheDocument()
		expect(within(region("케이스 생성")).getByText("완료")).toBeInTheDocument()
		expect(
			within(region("분석 일괄 실행")).getByRole("button", { name: "완료됨" }),
		).toBeDisabled()
	}, 40000)

	it("정상_[일괄 실행 시작]만 누르면 룰 스캔 → 점수 산출 → 케이스 생성이 차례로 실행 중·완료로 바뀌고 결과는 표에 남는다", async () => {
		const user = renderPage()
		await loadAndStart(user)

		const score = region("점수 산출")
		expect(within(score).getByText("룰 스캔 완료 후 자동 실행")).toBeInTheDocument()
		expect(await within(score).findByText("AI 점수 기다리는 중", {}, SLOW)).toBeInTheDocument()
		expect(within(score).getByText("실행 중")).toBeInTheDocument()
		expect(within(score).queryByRole("button", { name: /실행|재처리/ })).toBeNull() // 일반 실행 버튼 없음(ⓘ 만)

		const open = region("케이스 생성")
		const table = () => within(region("실행 결과")).getByRole("table")
		expect(await within(table()).findByText("생성 1건", {}, SLOW)).toBeInTheDocument()
		expect(within(score).getByText("완료")).toBeInTheDocument()
		expect(within(open).getByText("완료")).toBeInTheDocument()
		expect(within(open).queryByRole("button", { name: /실행/ })).toBeNull()
		// 칸에는 결과 설명이 없고(SCRUM-345) 표의 결과·비고에 남아요
		expect(score).not.toHaveTextContent("산출했어요")
		expect(table()).toHaveTextContent("점수 산출완료성공 3 · 실패 0모델 stub-1")
		expect(table()).toHaveTextContent("룰 스캔완료생성 경보 3건분석 거래 1,200건")
		expect(within(table()).getByRole("link", { name: "케이스 확인·배정" })).toHaveAttribute(
			"href",
			"/cases?status=OPEN",
		)
	}, 40000)

	it("실패_다시 보낼 실패가 남으면 점수가 멈추고 [점수 재처리]만 나오며, 재처리가 성공하면 케이스 생성이 이어진다", async () => {
		const user = renderPage({ scoreFails: true })
		await loadAndStart(user)

		const score = region("점수 산출")
		expect(
			await within(score).findByText("다시 보낼 실패 1건이 남았어요.", {}, SLOW),
		).toBeInTheDocument()
		expect(within(score).getByText("일부 실패")).toBeInTheDocument()
		const open = region("케이스 생성")
		expect(within(open).getByText("점수 재처리가 성공하면 이어져요.")).toBeInTheDocument()
		const table = () => within(region("실행 결과")).getByRole("table")
		expect(table()).toHaveTextContent("점수 산출일부 실패다시 보낼 실패 1건")

		await user.click(within(score).getByRole("button", { name: "점수 재처리" }))
		expect(await within(table()).findByText("성공 1 · 실패 0", {}, SLOW)).toBeInTheDocument()
		expect(within(score).queryByRole("button", { name: "점수 재처리" })).toBeNull()
		expect(await within(table()).findByText("생성 1건", {}, SLOW)).toBeInTheDocument()
	}, 40000)

	it("경계_화면을 다시 열어도 그 날짜 룰 스캔·점수·케이스 생성이 서버 목록으로 그대로 보인다", async () => {
		server.use(
			http.get("*/api/v1/admin/batches", ({ request }) => {
				const url = new URL(request.url)
				if (url.searchParams.get("date") !== DAY) return listOf([])
				return listOf([
					run({
						batch_run_id: 13,
						batch_type: "OPEN_CASES",
						status: "SUCCEEDED",
						rows_in: 3,
						rows_out: 1,
					}),
					run({
						batch_run_id: 12,
						batch_type: "SCORE_REQUEST",
						status: "SUCCEEDED",
						rows_in: 3,
						rows_out: 3,
						summary: {
							requested: 3,
							scored: 3,
							failed: 0,
							retryable: 0,
							chunks: { total: 1, failed: 0 },
							model_versions: ["xgb-rc2"],
						},
					}),
					run({
						batch_run_id: 11,
						batch_type: "RULE_SCAN",
						status: "SUCCEEDED",
						rows_in: 1200,
						rows_out: 3,
						summary: {
							alerts_by_rule: [
								{ rule_id: "R02_FAN_IN", rule_version: 1, alert_count: 3 },
							],
						},
					}),
				])
			}),
		)
		const user = renderPage()
		await user.type(await screen.findByLabelText("분석 날짜"), DAY)
		expect(await within(region("룰 스캔")).findByText("완료")).toBeInTheDocument()
		expect(
			within(region("분석 일괄 실행")).getByRole("button", { name: "완료됨" }),
		).toBeDisabled()
		expect(within(region("점수 산출")).getByText("완료")).toBeInTheDocument()
		expect(within(region("케이스 생성")).getByText("완료")).toBeInTheDocument()
		const table = within(region("실행 결과")).getByRole("table")
		expect(table).toHaveTextContent("모델 xgb-rc2")
		expect(table).toHaveTextContent("생성 1건")
		expect(within(table).getAllByRole("row")).toHaveLength(4) // 머리 + 룰 스캔·점수·케이스 생성 (이 화면에서 적재 안 함)
	})

	it("실패_케이스 생성이 실패했으면 그때만 [다시 실행]이 나오고 누르면 202로 다시 접수한다", async () => {
		let posted = 0
		server.use(
			http.get("*/api/v1/admin/batches", ({ request }) => {
				const url = new URL(request.url)
				if (url.searchParams.get("date") !== DAY) return listOf([])
				return listOf([
					run({
						batch_run_id: posted ? 14 : 13,
						batch_type: "OPEN_CASES",
						status: posted ? "SUCCEEDED" : "FAILED",
						rows_in: posted ? 1 : null,
						rows_out: posted ? 1 : null,
						error_message: posted ? null : "대상 3 · 생성 2 · 실패 1",
					}),
				])
			}),
			http.post("*/api/v1/admin/batches/open-cases", () => {
				posted += 1
				return HttpResponse.json(
					run({
						batch_run_id: 14,
						batch_type: "OPEN_CASES",
						status: "RUNNING",
						finished_at: null,
					}),
					{ status: 202 },
				)
			}),
		)
		const user = renderPage()
		await user.type(await screen.findByLabelText("분석 날짜"), DAY)
		const open = region("케이스 생성")
		expect(await within(open).findByText(/케이스 생성이 실패했어요/)).toBeInTheDocument()
		expect(region("실행 결과")).toHaveTextContent("대상 3 · 생성 2 · 실패 1") // 사유는 표의 비고
		await user.click(within(open).getByRole("button", { name: "다시 실행" }))
		expect(posted).toBe(1)
		expect(await within(open).findByText("완료", {}, SLOW)).toBeInTheDocument()
		expect(within(open).queryByRole("button", { name: "다시 실행" })).toBeNull()
		expect(region("실행 결과")).toHaveTextContent("생성 1건")
	}, 15000)

	it("경계_시작한 지 10분이 넘도록 실행 중이면 자동 확인을 멈추고 [상태 다시 확인]으로 직접 부른다", async () => {
		let reads = 0
		server.use(
			http.get("*/api/v1/admin/batches", ({ request }) => {
				const url = new URL(request.url)
				if (url.searchParams.get("date") !== DAY) return listOf([])
				reads += 1
				return listOf([
					run({
						batch_run_id: 12,
						batch_type: "SCORE_REQUEST",
						status: "RUNNING",
						started_at: "2026-01-01T00:00:00Z", // 오래전
						finished_at: null,
					}),
				])
			}),
		)
		const user = renderPage()
		await user.type(await screen.findByLabelText("분석 날짜"), DAY)
		const score = region("점수 산출")
		expect(
			await within(score).findByText(/10분이 지나도 끝나지 않아 자동 확인을 멈췄어요/),
		).toBeInTheDocument()
		const readsAtStop = reads
		await new Promise((resolve) => setTimeout(resolve, 2500))
		expect(reads).toBe(readsAtStop) // 상한 뒤에는 저절로 다시 부르지 않아요
		await user.click(within(score).getByRole("button", { name: "상태 다시 확인" }))
		await new Promise((resolve) => setTimeout(resolve, 200))
		expect(reads).toBeGreaterThan(readsAtStop)
	}, 10000)
})
