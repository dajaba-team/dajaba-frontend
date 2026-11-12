import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { batchesApi } from "../api/batchesApi"

// 202 로 받은 배치(적재 B1·케이스 생성 B4)의 상태 확인 B5 — 계약서 5.6.
// RUNNING 이면 2초마다 다시 부르고, 최대 10분이 지나면 자동 조회만 멈춰요(실패로 단정하지 않음).
// 멈춘 뒤에는 run.refetch() 로 직접 다시 불러요.
export const POLL_MS = 2000
export const MAX_POLL_MS = 10 * 60 * 1000

export function useBatchRun(runId, maxPollMs = MAX_POLL_MS) {
	const [timedOutId, setTimedOutId] = useState(null)
	const timedOut = runId != null && timedOutId === runId
	const run = useQuery({
		queryKey: ["admin", "batches", runId],
		queryFn: ({ signal }) => batchesApi.run(runId, signal),
		enabled: runId != null,
		refetchInterval: (query) =>
			query.state.data?.status === "RUNNING" && !timedOut ? POLL_MS : false,
	})
	// 실행 하나마다 상한 타이머 — 끝나기 전에 넘으면 자동 조회만 멈춰요
	useEffect(() => {
		if (runId == null) return undefined
		const timer = setTimeout(() => setTimedOutId(runId), maxPollMs)
		return () => clearTimeout(timer)
	}, [runId, maxPollMs])
	return { run, timedOut, stillRunning: run.data?.status === "RUNNING" }
}
