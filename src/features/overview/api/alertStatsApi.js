import { apiClient } from "../../../shared/api/apiClient"

// 관리자 대시보드 경보 통계 — `GET /api/v1/admin/alerts/stats?date=` (BE SCRUM-360, ADMIN 만).
// 기준일(없으면 전체 기간)의 경보를 케이스 생성과 같은 운영 경계값으로 HIGH·MEDIUM·LOW 로 나눠 줘요.
// bands·policy_version 은 경계값이 아직 없으면 null — 그땐 등급 없이 건수만 보여 줘요.
const toStats = (data) => ({
	date: data.date ?? null,
	total: data.total ?? 0,
	scored: data.scored ?? 0,
	bands: data.bands
		? { high: data.bands.high ?? 0, medium: data.bands.medium ?? 0, low: data.bands.low ?? 0 }
		: null,
	unscored: data.unscored ?? 0,
	failed: data.failed ?? 0,
	caseOpened: data.case_opened ?? 0,
	policyVersion: data.policy_version ?? null,
})

export const alertStatsApi = {
	stats: async (date, signal) =>
		toStats(
			(
				await apiClient.get("/api/v1/admin/alerts/stats", {
					params: date ? { date } : undefined,
					signal,
				})
			).data,
		),
}
