import { getErrorMessage } from "../../../../shared/api/apiClient"
import { batchesApi } from "../api/batchesApi"
import { formatCount } from "../formatCount"
import { useBatchStep } from "../hooks/useBatchStep"
import BatchStep from "./BatchStep"
import RunProgress from "./RunProgress"

// [점수 산출] 자동 처리 현황 단계 — 계약서 B3(202, BE SCRUM-356). 룰 스캔이 성공하면 서버가 같은 날짜 점수를 시작해요.
// 일반 [실행] 버튼은 없고, 다시 보낼 실패(AI 오류·타임아웃)가 남아 FAILED 로 멈췄을 때만 [점수 재처리](남은 것만 보냄).
// 재처리가 성공하면 케이스 생성이 자동으로 이어져요. 실패를 0점·저위험으로 보이지 않아요.
// 칸에는 상태만 짧게 — 건수·모델·다시 보내도 같은 실패는 아래 실행 결과 표(결과·비고)로(SCRUM-345).
export default function ScoreCard({ date }) {
	const { runs, run, mutation: retry } = useBatchStep(date, "SCORE_REQUEST", batchesApi.score)
	const scanFailed = runs.data?.find((r) => r.batchType === "RULE_SCAN")?.status === "FAILED"
	const running = retry.isPending || run?.status === "RUNNING"
	const failed = !running && run?.status === "FAILED"
	const state = running
		? "running"
		: run?.status === "SUCCEEDED"
			? "done"
			: failed
				? run.summary?.scored > 0
					? "partial"
					: "failed"
				: "idle"
	return (
		<BatchStep
			id="score-step-title"
			title="점수 산출"
			icon="sparkle"
			scope="룰 스캔 완료 후 자동 실행"
			info="룰 스캔이 끝나면 자동으로 실행돼요. 아직 점수가 없는 경보와 다시 보낼 수 있는 실패만 AI에 보내고, 성공한 점수는 그대로 둬요. 실패가 저위험을 뜻하지 않습니다."
			state={state}
		>
			{scanFailed && !run && !running && <p>룰 스캔이 실패해 시작하지 않았어요.</p>}
			{running && (
				<RunProgress
					compact
					title="점수 산출"
					label="AI 점수 기다리는 중"
					startedAt={run?.status === "RUNNING" ? run.startedAt : null}
					onRecheck={() => runs.refetch()}
					rechecking={runs.isFetching}
				/>
			)}
			{failed && (
				<>
					<p role="alert">
						{run.summary?.retryable > 0
							? `다시 보낼 실패 ${formatCount(run.summary.retryable)}건이 남았어요.`
							: "점수 산출이 실패했어요."}
					</p>
					<button
						type="button"
						className="batch-run"
						data-primary="true"
						onClick={() => retry.mutate()}
					>
						점수 재처리
					</button>
				</>
			)}
			{retry.isError && <p role="alert">{getErrorMessage(retry.error)}</p>}
		</BatchStep>
	)
}
