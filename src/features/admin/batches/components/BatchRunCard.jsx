import { useId, useState } from "react"
import ConfirmDialog from "../../../../shared/ui/ConfirmDialog"
import { getErrorMessage } from "../../../../shared/api/apiClient"
import { batchesApi } from "../api/batchesApi"
import { useBatchStep } from "../hooks/useBatchStep"
import BatchStep from "./BatchStep"

// [분석 일괄 실행] 카드 — 사용자가 직접 누르는 두 번째 작업(SCRUM-345). 날짜를 고르고 [일괄 실행 시작] 한 번이면
// 룰 스캔(B2, 202) → 점수 산출 → 케이스 생성이 서버에서 자동으로 이어져요(배치 자동 연쇄, BE SCRUM-356).
// 진행·결과는 아래 "자동 처리 현황"의 ②~④ 단계가 보여 줘요. 이 카드는 날짜·시작·시작 전 거절(409)만.
// 확인창은 누르면 바로 닫혀요(실행은 뒤에서). 시작 전 거절(409 — 데이터 기간 밖·이미 분석한 날짜·실행 중)은
// 이 카드 안에 보여 줘요. 원천 적재가 끝나기 전에는 누를 수 없어요(ready).
const DATE = /^\d{4}-\d{2}-\d{2}$/

export default function BatchRunCard({ date, onDateChange, primary = false, ready = true }) {
	const dateId = useId()
	const [confirming, setConfirming] = useState(false)
	const { run, mutation: scan } = useBatchStep(date, "RULE_SCAN", batchesApi.ruleScan)
	const running = scan.isPending || run?.status === "RUNNING"
	const done = run?.status === "SUCCEEDED"
	return (
		<BatchStep
			id="batch-run-title"
			title="분석 일괄 실행"
			scope="탐지부터 케이스 생성까지 자동 처리"
			info="선택한 날짜에 켜진 룰 전부로 경보를 만들고, 끝나면 점수 산출 → 케이스 생성이 자동으로 이어져요. 성공한 날짜는 다시 스캔할 수 없어요."
			state={
				running ? "running" : done ? "done" : run?.status === "FAILED" ? "failed" : "idle"
			}
		>
			<label htmlFor={dateId}>분석 날짜</label>
			<input
				id={dateId}
				type="date"
				value={date}
				disabled={scan.isPending}
				onChange={(event) => {
					scan.reset()
					setConfirming(false)
					onDateChange?.(event.target.value)
				}}
			/>
			<button
				type="button"
				className="batch-run"
				data-primary={primary}
				disabled={!ready || !DATE.test(date) || running || done}
				onClick={() => setConfirming(true)}
			>
				{done ? "완료됨" : running ? "실행 중…" : "일괄 실행 시작"}
			</button>
			{scan.isError && <p role="alert">{getErrorMessage(scan.error)}</p>}
			<p className="batch-step-hint">
				{!ready
					? "원천 적재 완료 후 실행 가능"
					: done
						? "이 날짜는 이미 분석했어요"
						: "결과는 아래 자동 처리 현황에서 확인"}
			</p>
			{confirming && (
				<ConfirmDialog
					title="분석 일괄 실행"
					body={
						<>
							<p>
								룰 스캔 → 점수 산출 → 케이스 생성이 순서대로 자동 진행됩니다. 중간에
								실패하면 재처리가 필요할 수 있습니다.
							</p>
							<p className="batch-dialog-note">
								※ 룰 스캔에 성공한 날짜는 다시 스캔할 수 없습니다.
							</p>
						</>
					}
					confirmLabel="시작"
					onConfirm={() => {
						setConfirming(false) // 바로 닫아요 — 시작 전 거절(409)은 카드 안에
						scan.mutate()
					}}
					onCancel={() => setConfirming(false)}
				/>
			)}
		</BatchStep>
	)
}
