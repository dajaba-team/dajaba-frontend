import { batchesApi } from "../../features/admin/batches/api/batchesApi"
import { listKey } from "../../features/admin/batches/hooks/useBatchRunsForDate"
import { formatCount } from "../../features/admin/batches/formatCount"
import { approvalsApi } from "../../features/approvals/api/approvalsApi"
import { getErrorCode } from "../../shared/api/apiClient"

// 작업 추적기 종류별 설정(SCRUM-365, 설계 7.3). 종류마다 조회 키·조회·간격·판정만 — 새 비동기 작업은 한 줄 더하면 돼요.
// 조회 키·함수는 화면 카드와 같게 둬요(원천 적재 useBatchRun, 분석 useBatchRunsForDate) — 요청이 하나로 합쳐져요.
// 문구에는 작업 이름·날짜·건수만(계좌·금액·오류 원문 없음, NFR-COM-04). 자세한 사유는 [결과 보기] 화면에서.
const STEP = { RULE_SCAN: "룰 스캔", SCORE_REQUEST: "점수 산출", OPEN_CASES: "케이스 생성" }

/** 분석 일괄 실행 — 시작한 실행(id) 이후 그 날짜의 단계들. 케이스 생성이 성공하면 끝, 어느 단계든 실패하면 실패(BE 자동 연쇄). */
export function evaluateAnalysis(job, runs) {
	const since = (runs ?? []).filter((run) => run.batchRunId >= Number(job.id))
	const failed = since.find((run) => run.status === "FAILED")
	if (failed)
		return {
			state: "FAILED",
			tone: "error",
			text: `${job.date} ${STEP[failed.batchType] ?? "분석"}에 실패했어요`,
			finishedAt: failed.finishedAt,
		}
	const open = since.find((run) => run.batchType === "OPEN_CASES" && run.status === "SUCCEEDED")
	if (open)
		return {
			state: "DONE",
			tone: "info",
			text: open.rowsOut
				? `${job.date} 분석이 끝났어요 · 새 케이스 ${formatCount(open.rowsOut)}건`
				: `${job.date} 분석이 끝났어요 · 새로 만든 케이스가 없어요`,
			finishedAt: open.finishedAt,
		}
	return { state: "TRACKING" }
}

export const jobKinds = {
	LOAD_DATASET: {
		intervalMs: 2000,
		queryKey: (job) => ["admin", "batches", Number(job.id)],
		fetch: (job, signal) => batchesApi.run(Number(job.id), signal),
		evaluate: (job, run) => {
			if (run.status === "SUCCEEDED")
				return {
					state: "DONE",
					tone: "info",
					text:
						run.rowsOut == null
							? "원천 적재가 끝났어요"
							: `원천 적재가 끝났어요 · 거래 ${formatCount(run.rowsOut)}건`,
					finishedAt: run.finishedAt,
				}
			if (run.status === "FAILED")
				return {
					state: "FAILED",
					tone: "error",
					text: "원천 적재에 실패했어요",
					finishedAt: run.finishedAt,
				}
			return { state: "TRACKING" }
		},
	},
	ANALYSIS: {
		intervalMs: 2000,
		queryKey: (job) => listKey(job.date),
		fetch: (job, signal) => batchesApi.list({ date: job.date, size: 20 }, signal),
		evaluate: evaluateAnalysis,
	},
	// 확정본 PDF — 상태만 주는 API가 없어 S8(확정본 받기)을 3초마다(BE 설계 그대로). 409면 진행·실패, 200이면 완성.
	REPORT_PDF: {
		intervalMs: 3000,
		queryKey: (job) => ["jobs", "report-pdf", job.id],
		fetch: async (job, signal) => {
			try {
				await approvalsApi.reportPdf({ draftNo: job.id }, signal)
				return { pdfStatus: "READY" }
			} catch (error) {
				if (getErrorCode(error) !== "REPORT_PDF_NOT_READY") throw error
				return { pdfStatus: error.response?.data?.error?.details?.pdf_status ?? "PENDING" }
			}
		},
		evaluate: (job, data) => {
			if (data.pdfStatus === "READY")
				return { state: "DONE", tone: "info", text: "확정본 PDF가 준비됐어요" }
			if (data.pdfStatus === "FAILED")
				return { state: "FAILED", tone: "error", text: "확정본 PDF를 만들지 못했어요" }
			return { state: "TRACKING" }
		},
	},
}
