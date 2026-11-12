import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import ConfirmDialog from "../../../../shared/ui/ConfirmDialog"
import { getErrorCode, getErrorMessage } from "../../../../shared/api/apiClient"
import { formatSystemTime } from "../../../../shared/format/time"
import { batchesApi } from "../api/batchesApi"
import { MAX_POLL_MS, useBatchRun } from "../hooks/useBatchRun"
import { formatCount } from "../formatCount"
import BatchStep from "./BatchStep"

// [원천 적재] 카드 — 계약서 B1·B5, 백엔드 DatasetLoadController(SCRUM-69). 날짜와 상관없이 전체 데이터를 한 번.
// 확인창 → 202(RUNNING) → 상태 확인(useBatchRun). 결과는 이 카드와 페이지 실행 결과 표(onResult)에.
// 이미 적재된 DB면 409 BATCH_ALREADY_DONE — 실패가 아니라 다음 단계(룰 스캔)로 안내해요.
function Result({ run }) {
	if (run.status === "RUNNING")
		return (
			<p role="status">
				원천 데이터를 적재하는 중이에요. 수 분 걸려요… (실행 #{run.batchRunId})
			</p>
		)
	if (run.status === "FAILED")
		return (
			<div role="alert">
				<p>적재가 실패했어요. 넣던 데이터는 모두 되돌렸어요.</p>
				{run.errorMessage && <p>{run.errorMessage}</p>}
				<p>원인을 확인한 뒤 다시 실행할 수 있어요.</p>
			</div>
		)
	return (
		<p role="status">
			거래 {formatCount(run.rowsOut)}건을 적재했어요. (파일 {formatCount(run.rowsIn)}행
			{run.finishedAt && ` · ${formatSystemTime(run.finishedAt)}`})
		</p>
	)
}

const rowOf = (run) => ({
	status: run.status,
	summary:
		run.status === "SUCCEEDED"
			? `거래 ${formatCount(run.rowsOut)}건`
			: run.status === "FAILED"
				? "실패 — 넣던 데이터는 되돌림"
				: `실행 #${run.batchRunId}`,
})

export default function LoadDatasetCard({ onResult, primary = false, maxPollMs = MAX_POLL_MS }) {
	const [confirming, setConfirming] = useState(false)
	const [runId, setRunId] = useState(null)
	const start = useMutation({
		mutationFn: () => batchesApi.load(),
		onSuccess: (run) => {
			setConfirming(false)
			setRunId(run.batchRunId)
		},
		onError: (error) => {
			if (getErrorCode(error) !== "BATCH_ALREADY_DONE") return
			setConfirming(false)
			onResult?.({ status: "SUCCEEDED", summary: "이미 적재돼 있음" })
		},
	})
	const { run, timedOut, stillRunning } = useBatchRun(runId, maxPollMs)
	useEffect(() => {
		if (run.data) onResult?.(rowOf(run.data))
	}, [run.data, onResult])
	const alreadyLoaded = start.isError && getErrorCode(start.error) === "BATCH_ALREADY_DONE"
	const done = alreadyLoaded || run.data?.status === "SUCCEEDED"
	const running = start.isPending || (stillRunning && !timedOut)
	const state = done
		? "done"
		: running || stillRunning
			? "running"
			: run.data?.status === "FAILED"
				? "failed"
				: "idle"
	return (
		<BatchStep
			id="load-dataset-title"
			no={1}
			title="원천 적재"
			scope="날짜와 무관한 최초 1회 · IBM 거래·계좌·패턴 파일 전체"
			state={state}
		>
			<button
				type="button"
				className="batch-run"
				data-primary={primary}
				disabled={done || running}
				onClick={() => setConfirming(true)}
			>
				{done ? "완료됨" : "실행"}
			</button>
			{alreadyLoaded && (
				<p role="status">이미 적재된 데이터가 있어요. 룰 스캔으로 넘어가 주세요.</p>
			)}
			{start.isError && !alreadyLoaded && !confirming && (
				<p role="alert">{getErrorMessage(start.error)}</p>
			)}
			{run.isError && <p role="alert">{getErrorMessage(run.error)}</p>}
			{run.data && <Result run={run.data} />}
			{stillRunning && timedOut && (
				<div role="alert">
					<p>
						10분이 지나도 끝나지 않아 자동 확인을 멈췄어요. 아직 처리 중일 수 있어요 —
						실패로 보지 말고 상태를 다시 확인해 주세요.
					</p>
					<button type="button" onClick={() => run.refetch()} disabled={run.isFetching}>
						상태 다시 확인
					</button>
				</div>
			)}
			{confirming && (
				<ConfirmDialog
					title="원천 적재"
					body="원천 데이터 적재는 최초 한 번만 가능합니다. 적재에는 수 분이 걸려요."
					confirmLabel="적재"
					confirming={start.isPending}
					error={start.isError ? getErrorMessage(start.error) : null}
					onConfirm={() => start.mutate()}
					onCancel={() => {
						setConfirming(false)
						start.reset()
					}}
				/>
			)}
		</BatchStep>
	)
}
