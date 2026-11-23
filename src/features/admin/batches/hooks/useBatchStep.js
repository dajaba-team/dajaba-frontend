import { useMutation, useQueryClient } from "@tanstack/react-query"
import { latestOf, listKey, useBatchRunsForDate } from "./useBatchRunsForDate"
import { useJobs } from "../../../../shared/jobs/useJobs"

// 날짜를 따르는 단계 카드(룰 스캔·점수·케이스 생성) 공통 — 그 날짜 실행 목록에서 자기 유형의 최신 실행으로 그려요(BE SCRUM-356).
// 네 배치가 모두 202 라 결과는 목록(상태 조회)에서 읽어요. 연쇄로 서버가 시작한 실행도 같은 목록에 보여요.
// start 를 부르면(202) 목록을 다시 읽고, 목록이 아직 그 실행을 모르면 그동안은 받은 접수 상태(RUNNING)를 보여 줘요.
export function useBatchStep(date, type, start) {
	const queryClient = useQueryClient()
	const { track } = useJobs()
	const runs = useBatchRunsForDate(date)
	const latest = latestOf(runs.data, type)
	const mutation = useMutation({
		mutationFn: () => start({ date }),
		onSuccess: (run) => {
			// 그 날짜 연쇄(룰 스캔 → 점수 → 케이스 생성)를 이 실행부터 끝까지 추적 — 다른 화면에 가도 끝나면 알려요(SCRUM-365)
			track({
				kind: "ANALYSIS",
				id: String(run.batchRunId),
				date,
				label: `분석 일괄 실행 · ${date}`,
				to: "/admin/batches",
			})
			return queryClient.invalidateQueries({ queryKey: listKey(date) })
		},
	})
	const accepted =
		mutation.data &&
		mutation.data.batchDate === date &&
		(!latest || latest.batchRunId < mutation.data.batchRunId)
			? mutation.data
			: null
	return { runs, run: accepted ?? latest, mutation }
}
