import { apiClient } from "../../../../shared/api/apiClient"

// 배치 — 계약서 B1 load · B2 rule-scan · B3 score · B4 open-cases(모두 202) · B5 `GET /admin/batches/{batch_run_id}`.
// 네 배치 모두 202 로 RUNNING 을 돌려주고 뒤에서 돌아요(BE SCRUM-356). 결과는 상태 조회·목록으로 읽어요:
// - summary: 룰 스캔 룰별 경보 수(alerts_by_rule), 점수 건수(requested·scored·failed·retryable·chunks·model_versions). 그 밖은 null
// - progress: 실행 중 진행 단계 {done, total, current} — 적재(파일 단계 4개)·룰 스캔(룰 단위)만, 끝나면 null
// 룰 스캔이 끝나면 점수 → 케이스 생성이 서버에서 자동으로 이어져요(배치 자동 연쇄, 항상 켜짐).
// 서버는 snake_case, 화면은 camelCase. 시각은 시스템 시각(UTC Z).
const toSummary = (summary) => {
	if (!summary) return null
	return {
		alertsByRule: (summary.alerts_by_rule ?? []).map((rule) => ({
			ruleId: rule.rule_id,
			ruleVersion: rule.rule_version,
			alertCount: rule.alert_count,
		})),
		requested: summary.requested ?? 0,
		scored: summary.scored ?? 0,
		failed: summary.failed ?? 0,
		retryable: summary.retryable ?? 0,
		chunks: { total: summary.chunks?.total ?? 0, failed: summary.chunks?.failed ?? 0 },
		modelVersions: summary.model_versions ?? [],
	}
}
const toProgress = (progress) =>
	progress
		? {
				done: progress.done ?? 0,
				total: progress.total ?? 0,
				current: progress.current ?? null,
			}
		: null
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
	summary: toSummary(data.summary),
	progress: toProgress(data.progress),
})
const post = async (path, params) =>
	toRun((await apiClient.post(`/api/v1/admin/batches/${path}`, null, { params })).data)

export const batchesApi = {
	/** 원천 적재(B1). 날짜 없음 — 전체 데이터 1회. */
	load: () => post("load"),
	/** 룰 스캔(B2). 끝나면 점수 → 케이스 생성이 자동으로 이어져요. */
	ruleScan: ({ date }) => post("rule-scan", { date }),
	/** 점수(B3) — 화면에선 [점수 재처리]만. 다시 보낼 실패·남은 대상만 보내고, 성공하면 케이스 생성이 이어져요. */
	score: ({ date }) => post("score", { date }),
	/** 케이스 생성(B4) — 화면에선 실패했을 때 [다시 실행]만. 남은 경보만 처리해요. */
	openCases: ({ date }) => post("open-cases", { date }),
	/** 실행 목록 — type·status·date 로 거르고 최신 순(서버 기본 started_at,desc). */
	list: async ({ type, status, date, size = 1 } = {}, signal) =>
		(
			(
				await apiClient.get("/api/v1/admin/batches", {
					params: { type, status, date, size },
					signal,
				})
			).data.items ?? []
		).map(toRun),
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
