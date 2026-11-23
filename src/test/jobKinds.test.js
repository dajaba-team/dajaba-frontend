import { describe, expect, it } from "vitest"
import { evaluateAnalysis, jobKinds } from "../app/jobs/jobKinds"

// 작업 추적기 종류별 판정(SCRUM-365, 설계 7.3). 문구에는 이름·날짜·건수만.
const job = { kind: "ANALYSIS", id: "10", date: "2022-09-08" }
const run = (batchRunId, batchType, status, extra = {}) => ({
	batchRunId,
	batchType,
	status,
	finishedAt: "2026-11-23T03:00:00Z",
	...extra,
})

describe("작업 종류별 판정", () => {
	it("분석: 시작 전 실행의 실패는 무시하고, 케이스 생성이 성공하면 끝 — 새 케이스 수 또는 없음", () => {
		const older = run(9, "RULE_SCAN", "FAILED")
		expect(evaluateAnalysis(job, [run(11, "SCORE_REQUEST", "RUNNING"), older])).toEqual({
			state: "TRACKING",
		})
		expect(
			evaluateAnalysis(job, [
				run(12, "OPEN_CASES", "SUCCEEDED", { rowsOut: 1234 }),
				run(11, "SCORE_REQUEST", "SUCCEEDED"),
				run(10, "RULE_SCAN", "SUCCEEDED"),
				older,
			]),
		).toMatchObject({ state: "DONE", text: "2022-09-08 분석이 끝났어요 · 새 케이스 1,234건" })
		expect(
			evaluateAnalysis(job, [run(12, "OPEN_CASES", "SUCCEEDED", { rowsOut: 0 })]).text,
		).toBe("2022-09-08 분석이 끝났어요 · 새로 만든 케이스가 없어요")
	})

	it("분석: 중간 단계가 실패하면 그 단계 이름으로 실패", () => {
		expect(
			evaluateAnalysis(job, [
				run(11, "SCORE_REQUEST", "FAILED"),
				run(10, "RULE_SCAN", "SUCCEEDED"),
			]),
		).toMatchObject({
			state: "FAILED",
			tone: "error",
			text: "2022-09-08 점수 산출에 실패했어요",
		})
	})

	it("원천 적재: 성공은 거래 건수, 실패는 이름만(오류 원문 없음)", () => {
		const { evaluate } = jobKinds.LOAD_DATASET
		expect(evaluate({}, run(1, "LOAD_DATASET", "SUCCEEDED", { rowsOut: 5078345 })).text).toBe(
			"원천 적재가 끝났어요 · 거래 5,078,345건",
		)
		expect(
			evaluate({}, run(1, "LOAD_DATASET", "FAILED", { errorMessage: "내부 오류 원문" })),
		).toMatchObject({ state: "FAILED", text: "원천 적재에 실패했어요" })
		expect(evaluate({}, run(1, "LOAD_DATASET", "RUNNING"))).toEqual({ state: "TRACKING" })
	})

	it("확정본 PDF: PENDING은 진행, READY는 완성, FAILED는 실패", () => {
		const { evaluate } = jobKinds.REPORT_PDF
		expect(evaluate({}, { pdfStatus: "PENDING" })).toEqual({ state: "TRACKING" })
		expect(evaluate({}, { pdfStatus: "READY" })).toMatchObject({
			state: "DONE",
			text: "확정본 PDF가 준비됐어요",
		})
		expect(evaluate({}, { pdfStatus: "FAILED" })).toMatchObject({
			state: "FAILED",
			tone: "error",
		})
	})
})
