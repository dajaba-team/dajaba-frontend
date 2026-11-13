import { apiClient } from "../../../../shared/api/apiClient"

// 배치 — 계약서 B1 load(202) · B2 rule-scan(200) · B3 score(200) · B4 open-cases(202) · B5 `GET /admin/batches/{batch_run_id}`.
// 서버는 snake_case, 화면은 camelCase. 시각은 시스템 시각(UTC Z).
// 룰 스캔은 동기라 9/1(111만 건)도 기다릴 수 있게 이 요청만 120초(기본 15초).
const SYNC_BATCH_TIMEOUT_MS = 120_000
// 점수는 묶음(500건)마다 AI 최대 90초 — 경보가 많으면 몇 분이라 10분까지 기다려요.
const SCORE_TIMEOUT_MS = 10 * 60 * 1000
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
const toRuleScan = (data) => ({
	...toRun(data),
	alertsByRule: (data.alerts_by_rule ?? []).map((rule) => ({
		ruleId: rule.rule_id,
		ruleVersion: rule.rule_version,
		alertCount: rule.alert_count,
	})),
})
const toScore = (data) => ({
	...toRun(data),
	requested: data.requested ?? 0,
	scored: data.scored ?? 0,
	failed: data.failed ?? 0,
	retryable: data.retryable ?? 0,
	chunks: { total: data.chunks?.total ?? 0, failed: data.chunks?.failed ?? 0 },
	modelVersions: data.model_versions ?? [],
})

export const batchesApi = {
	/** 원천 적재(B1). 날짜 없음 — 전체 데이터 1회. 202 로 RUNNING 을 돌려줘요. */
	load: async () => toRun((await apiClient.post("/api/v1/admin/batches/load")).data),
	/** 룰 스캔(B2). 동기 200 — 룰별 경보 수까지. */
	ruleScan: async ({ date }) =>
		toRuleScan(
			(
				await apiClient.post("/api/v1/admin/batches/rule-scan", null, {
					params: { date },
					timeout: SYNC_BATCH_TIMEOUT_MS,
				})
			).data,
		),
	/** 점수(B3). 동기 200 — status FAILED 여도 200(다시 보낼 실패가 남음). 다시 부르면 남은 대상만. */
	score: async ({ date }) =>
		toScore(
			(
				await apiClient.post("/api/v1/admin/batches/score", null, {
					params: { date },
					timeout: SCORE_TIMEOUT_MS,
				})
			).data,
		),
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
