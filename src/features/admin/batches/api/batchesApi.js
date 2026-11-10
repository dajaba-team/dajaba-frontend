import { apiClient } from "../../../../shared/api/apiClient"

// 배치 — 계약서 B4 `POST /admin/batches/open-cases?date=` → 202, B5 `GET /admin/batches/{batch_run_id}`.
// 서버는 snake_case, 화면은 camelCase. 시각은 시스템 시각(UTC Z).
const toRun = (data) => ({
	batchRunId: data.batch_run_id,
	batchType: data.batch_type,
	batchDate: data.batch_date,
	status: data.status,
	startedAt: data.started_at ?? null,
	finishedAt: data.finished_at ?? null,
	rowsIn: data.rows_in ?? null,
	rowsOut: data.rows_out ?? null,
	errorMessage: data.error_message ?? null,
})

export const batchesApi = {
	/** 케이스 생성(B4). date 는 경보 배치 기준일 YYYY-MM-DD. 202 로 RUNNING 을 돌려줘요. */
	openCases: async ({ date }) =>
		toRun(
			(await apiClient.post("/api/v1/admin/batches/open-cases", null, { params: { date } }))
				.data,
		),
	/** 실행 상태(B5). */
	run: async (batchRunId, signal) =>
		toRun(
			(
				await apiClient.get(`/api/v1/admin/batches/${encodeURIComponent(batchRunId)}`, {
					signal,
				})
			).data,
		),
}
