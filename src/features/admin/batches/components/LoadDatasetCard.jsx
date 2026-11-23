import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import ConfirmDialog from "../../../../shared/ui/ConfirmDialog"
import { getErrorCode, getErrorMessage } from "../../../../shared/api/apiClient"
import { formatSystemTime } from "../../../../shared/format/time"
import { batchesApi } from "../api/batchesApi"
import { useJobs } from "../../../../shared/jobs/useJobs"
import { MAX_POLL_MS, useBatchRun } from "../hooks/useBatchRun"
import { formatCount } from "../formatCount"
import Icon from "../../../../shared/ui/dashboard/Icon"
import BatchStep from "./BatchStep"
import RunProgress from "./RunProgress"

// [원천 적재] 카드 — 계약서 B1·B5, 백엔드 DatasetLoadController(SCRUM-69). 날짜와 상관없이 전체 데이터를 한 번.
// 확인창 → 202(RUNNING) → 상태 확인(useBatchRun). 결과는 이 카드와 페이지 실행 결과 표(onResult)에.
// 이미 적재된 DB면 409 BATCH_ALREADY_DONE — 실패가 아니라 다음 단계(룰 스캔)로 안내해요.
// 화면을 열 때 성공한 적재가 있으면(실행 목록 조회) 처음부터 "완료"예요(SCRUM-344). 목록을 못 읽으면 지금처럼 "대기".
// 실행 중에는 스피너·지금 단계(패턴 → 계좌 → 거래 → 검증)·단계 막대·경과 시간(BE progress, SCRUM-356).
const LOAD_STEPS = {
	PATTERNS: "패턴 파일",
	ACCOUNTS: "계좌 파일",
	TRANSACTIONS: "거래 파일",
	VERIFY: "검증",
}
const loadingText = (progress) =>
	progress?.current
		? `적재 중 · ${LOAD_STEPS[progress.current] ?? progress.current} (${progress.done + 1}/${progress.total}단계)`
		: "적재 중"

// 완료 정보 — 적재 거래 수·완료 시각(분까지). 이 화면에서 적재했든 이미 적재돼 있었든 같은 모양(SCRUM-345)
function LoadedInfo({ run }) {
	const finished = formatSystemTime(run.finishedAt).slice(0, 16)
	return (
		<dl className="batch-facts" role="status" aria-label="원천 적재 결과">
			<div>
				<dt>적재 거래</dt>
				<dd>{formatCount(run.rowsOut)}건</dd>
			</div>
			{finished && (
				<div>
					<dt>완료 시각</dt>
					<dd>{finished}</dd>
				</div>
			)}
		</dl>
	)
}

function Result({ run }) {
	if (run.status === "RUNNING")
		return (
			<RunProgress
				title="원천 적재"
				label={loadingText(run.progress)}
				progress={run.progress}
				startedAt={run.startedAt}
			/>
		)
	if (run.status === "FAILED")
		return (
			<div role="alert">
				<p>적재가 실패했어요. 넣던 데이터는 모두 되돌렸어요.</p>
				{run.errorMessage && <p>{run.errorMessage}</p>}
				<p>원인을 확인한 뒤 다시 실행할 수 있어요.</p>
			</div>
		)
	return <LoadedInfo run={run} />
}

const rowOf = (run) => ({
	status: run.status,
	summary:
		run.status === "SUCCEEDED"
			? `적재 거래 ${formatCount(run.rowsOut)}건`
			: run.status === "FAILED"
				? "실패 — 넣던 데이터는 되돌림"
				: loadingText(run.progress),
	note:
		run.status === "SUCCEEDED"
			? finishedText(run)
			: run.status === "FAILED"
				? (run.errorMessage ?? null)
				: null,
})
// 실행 결과 표 비고 — 완료 시각(분까지)
const finishedText = (run) =>
	run.finishedAt ? `완료 시각 ${formatSystemTime(run.finishedAt).slice(0, 16)}` : null

export default function LoadDatasetCard({ onResult, primary = false, maxPollMs = MAX_POLL_MS }) {
	const [confirming, setConfirming] = useState(false)
	const [runId, setRunId] = useState(null)
	const { track } = useJobs()
	const start = useMutation({
		mutationFn: () => batchesApi.load(),
		onSuccess: (run) => {
			setConfirming(false)
			setRunId(run.batchRunId)
			// 다른 화면에 가도 끝나면 알려요(SCRUM-365)
			track({
				kind: "LOAD_DATASET",
				id: String(run.batchRunId),
				label: "원천 적재",
				to: "/admin/batches",
			})
		},
		onError: (error) => {
			if (getErrorCode(error) !== "BATCH_ALREADY_DONE") return
			setConfirming(false)
			onResult?.({ status: "SUCCEEDED", summary: "이미 적재돼 있음" })
		},
	})
	// 서버의 마지막 적재 — 다른 메뉴에 갔다 오거나 새로고침해도 실제 상태(진행 중·완료·실패)를 이어서 보여 줘요(SCRUM-345).
	// 진행 중이면 그 실행을 이어서 상태 조회(2초)하고, 이 화면에서 새로 실행하면 그 실행을 따라가요.
	const loaded = useQuery({
		queryKey: ["admin", "batches", "list", "LOAD_DATASET", "latest"],
		queryFn: ({ signal }) => batchesApi.list({ type: "LOAD_DATASET" }, signal),
		select: (runs) => runs[0] ?? null,
		retry: false,
	})
	const latest = runId == null ? (loaded.data ?? null) : null
	const trackId = runId ?? (latest?.status === "RUNNING" ? latest.batchRunId : null)
	const { run, timedOut, stillRunning } = useBatchRun(trackId, maxPollMs)
	useEffect(() => {
		if (run.data) onResult?.(rowOf(run.data))
	}, [run.data, onResult])
	const previous = latest?.status === "SUCCEEDED" ? latest : null
	// 마지막 적재가 실패로 끝났으면 그대로 실패로(다시 실행 가능)
	const lastFailed = latest?.status === "FAILED" ? latest : null
	useEffect(() => {
		if (lastFailed) onResult?.(rowOf(lastFailed))
	}, [lastFailed, onResult])
	useEffect(() => {
		if (previous)
			onResult?.({
				status: "SUCCEEDED",
				summary: `적재 거래 ${formatCount(previous.rowsOut)}건`,
				note: finishedText(previous),
			})
	}, [previous, onResult])
	const alreadyLoaded = start.isError && getErrorCode(start.error) === "BATCH_ALREADY_DONE"
	const done = alreadyLoaded || previous != null || run.data?.status === "SUCCEEDED"
	const running = start.isPending || (stillRunning && !timedOut)
	const state = done
		? "done"
		: running || stillRunning
			? "running"
			: run.data?.status === "FAILED" || lastFailed
				? "failed"
				: "idle"
	return (
		<BatchStep
			id="load-dataset-title"
			title="원천 적재"
			scope="IBM 원천 데이터 최초 적재"
			info="날짜와 상관없이 최초 한 번만 해요. IBM 거래·계좌·패턴 파일 전체를 넣고 검증해요. 수 분 걸려요."
			state={state}
			stateLabel={state === "idle" ? "미적재" : undefined}
		>
			{/* 아직 적재 기록이 없을 때 — 빈 칸 대신 안내(SCRUM-345) */}
			{state === "idle" && loaded.isSuccess && !latest && !start.isError && (
				<p className="batch-empty">
					<span className="batch-step-icon" aria-hidden="true">
						<Icon name="database" size={20} />
					</span>
					아직 적재된 원천 데이터가 없습니다.
				</p>
			)}
			{previous && <LoadedInfo run={previous} />}
			{alreadyLoaded && (
				<p role="status">이미 적재된 데이터가 있어요. 분석 일괄 실행으로 넘어가 주세요.</p>
			)}
			{start.isError && !alreadyLoaded && !confirming && (
				<p role="alert">{getErrorMessage(start.error)}</p>
			)}
			{run.isError && <p role="alert">{getErrorMessage(run.error)}</p>}
			{run.data && <Result run={run.data} />}
			{!run.data && lastFailed && <Result run={lastFailed} />}
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
			{/* 결과(적재 거래·완료 시각)는 위, 버튼·안내는 카드 아래 — 옆 분석 일괄 실행 카드와 버튼 높이를 맞춰요 */}
			<button
				type="button"
				className="batch-run"
				data-primary={primary}
				disabled={done || running}
				onClick={() => setConfirming(true)}
			>
				{done ? "완료됨" : running ? "적재 중…" : "원천 적재 시작"}
			</button>
			<p className="batch-step-hint">최초 1회 실행</p>
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
