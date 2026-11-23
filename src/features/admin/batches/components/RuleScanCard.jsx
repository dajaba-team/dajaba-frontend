import { batchesApi } from "../api/batchesApi"
import { scanningText } from "../batchText"
import { useBatchStep } from "../hooks/useBatchStep"
import BatchStep from "./BatchStep"
import RunProgress from "./RunProgress"

// [룰 스캔] 자동 처리 현황 단계 — 계약서 B2(202, BE SCRUM-356). 시작은 위 [분석 일괄 실행] 카드(BatchRunCard).
// 칸에는 상태만 짧게 — 실행 중이면 지금 룰·n/켜진 룰 수와 막대, 실패면 한 줄. 경보 수·룰별 건수·실패 사유는
// 아래 실행 결과 표(결과·비고)로(SCRUM-345: 칸 높이가 결과마다 달라지지 않게).
export default function RuleScanCard({ date }) {
	const { runs, run } = useBatchStep(date, "RULE_SCAN", batchesApi.ruleScan)
	const running = run?.status === "RUNNING"
	const failed = run?.status === "FAILED"
	return (
		<BatchStep
			id="rule-scan-title"
			title="룰 스캔"
			icon="search"
			scope="선택한 날짜의 이상거래 탐지"
			info="선택한 날짜에 켜진 룰 전부로 경보를 만들어요. 하나라도 실패하면 그 실행의 경보는 모두 되돌려요. 결과는 아래 실행 결과 표에서 봐요."
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
			{running && (
				<RunProgress
					compact
					title="룰 스캔"
					label={scanningText(run.progress)}
					progress={run.progress}
					startedAt={run.startedAt}
					onRecheck={() => runs.refetch()}
					rechecking={runs.isFetching}
				/>
			)}
			{failed && (
				<p role="alert">룰 스캔이 실패했어요. 사유는 실행 결과 표에서 확인해 주세요.</p>
			)}
		</BatchStep>
	)
}
