import { useQuery } from "@tanstack/react-query"
import { alertStatsApi } from "../api/alertStatsApi"

// 관리자만 불러요(enabled) — 조사역·승인자 대시보드는 케이스만 봐요.
// 날짜 없이 전체 기간 누적으로 — 케이스 카드(미배정·승인 대기·조사 진행 현황)와 같은 기준(SCRUM-345).
export function useAlertStats(enabled) {
	return useQuery({
		queryKey: ["alerts", "stats", "all"],
		queryFn: ({ signal }) => alertStatsApi.stats(null, signal),
		enabled,
	})
}
