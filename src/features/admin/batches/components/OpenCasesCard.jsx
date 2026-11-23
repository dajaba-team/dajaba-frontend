import { getErrorMessage } from "../../../../shared/api/apiClient"
import { batchesApi } from "../api/batchesApi"
import { useBatchStep } from "../hooks/useBatchStep"
import BatchStep from "./BatchStep"
import RunProgress from "./RunProgress"

// [케이스 생성] 자동 처리 현황 단계 — 계약서 B4(202), 관리자만. 점수 산출이 성공하면 서버가 같은 날짜 케이스 생성을 시작해요.
// 점수를 재처리해 성공하면 한 번 더 돌아 새로 HIGH 가 된 경보만 케이스로 만들어요(보충 실행, V014).
// 일반 [실행] 버튼은 없고, 실패(FAILED)했을 때만 [다시 실행](남은 경보만 처리).
// 칸에는 상태만 짧게 — 만든 케이스 수·[케이스 확인·배정]·실패 사유는 아래 실행 결과 표(결과·비고)로(SCRUM-345).
export default function OpenCasesCard({ date }) {
	const { runs, run, mutation: rerun } = useBatchStep(date, "OPEN_CASES", batchesApi.openCases)
	const score = runs.data?.find((r) => r.batchType === "SCORE_REQUEST") ?? null
	const running = rerun.isPending || run?.status === "RUNNING"
	const failed = !running && run?.status === "FAILED"
	return (
		<BatchStep
			id="open-cases-title"
			title="케이스 생성"
			icon="case"
			scope="점수 산출 완료 후 자동 실행"
			info="점수 산출이 끝나면 자동으로 실행돼요. 점수가 HIGH인 경보만 조사 케이스로 만들고, 이미 케이스가 된 경보는 건너뛰어요."
			state={
				running
					? "running"
					: run?.status === "SUCCEEDED"
						? "done"
						: failed
							? "failed"
							: "idle"
			}
		>
			{score?.status === "FAILED" && !run && !running && (
				<p>점수 재처리가 성공하면 이어져요.</p>
			)}
			{running && (
				<RunProgress
					compact
					title="케이스 생성"
					label="케이스 만드는 중"
					startedAt={run?.status === "RUNNING" ? run.startedAt : null}
					onRecheck={() => runs.refetch()}
					rechecking={runs.isFetching}
				/>
			)}
			{failed && (
				<>
					<p role="alert">케이스 생성이 실패했어요. 남은 경보만 다시 처리해요.</p>
					<button
						type="button"
						className="batch-run"
						data-primary="true"
						onClick={() => rerun.mutate()}
					>
						다시 실행
					</button>
				</>
			)}
			{rerun.isError && <p role="alert">{getErrorMessage(rerun.error)}</p>}
		</BatchStep>
	)
}
