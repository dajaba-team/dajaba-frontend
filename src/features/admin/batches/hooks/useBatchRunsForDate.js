import { useQuery } from "@tanstack/react-query"
import { batchesApi } from "../api/batchesApi"

// 그 날짜의 실행 목록(룰 스캔·점수·케이스 생성) — 카드·실행 결과 표가 단계별 최신 실행으로 그려요(BE SCRUM-356: 모두 202).
// 실행 중인 단계가 있거나 막 끝났으면(다음 단계가 서버에서 자동으로 시작될 틈) 2초마다 다시 읽어 지금 단계·진행을 보여 줘요.
// 시작한 지 10분이 넘은 RUNNING 은 더 기다리지 않아요(계약서 5.6 상한) — 카드의 [상태 다시 확인]으로 직접 불러요.
export const POLL_MS = 2000
const GRACE_MS = 15_000
const MAX_POLL_MS = 10 * 60 * 1000
const DATE = /^\d{4}-\d{2}-\d{2}$/

export const listKey = (date) => ["admin", "batches", "list", "date", date]

const within = (iso, ms, now) => iso != null && now - Date.parse(iso) < ms

export function useBatchRunsForDate(date) {
	return useQuery({
		queryKey: listKey(date),
		queryFn: ({ signal }) => batchesApi.list({ date, size: 20 }, signal),
		enabled: DATE.test(date ?? ""),
		refetchInterval: (query) => {
			const runs = query.state.data ?? []
			const now = Date.now()
			const running = runs.some(
				(r) =>
					r.status === "RUNNING" &&
					(r.startedAt == null || within(r.startedAt, MAX_POLL_MS, now)),
			)
			const justFinished = runs.some((r) => within(r.finishedAt, GRACE_MS, now))
			return running || justFinished ? POLL_MS : false
		},
	})
}

/** 유형별 최신 실행 — 목록은 최신 순(started_at desc)이라 처음 만난 것. */
export const latestOf = (runs, type) => (runs ?? []).find((r) => r.batchType === type) ?? null
