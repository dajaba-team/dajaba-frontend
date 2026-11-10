import { useEffect, useId, useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import ConfirmDialog from "../../../../shared/ui/ConfirmDialog"
import { getErrorMessage } from "../../../../shared/api/apiClient"
import { formatSystemTime } from "../../../../shared/format/time"
import { batchesApi } from "../api/batchesApi"

// [케이스 생성] 카드 — 계약서 B4·B5, 백엔드 OpenCasesController(SCRUM-105). 관리자만(라우트 RequireRole + 서버 403).
// 실행 전 확인창 → 202(RUNNING) → 상태 확인을 2초마다 다시 불러 끝나면 멈춰요. 결과·실패는 이 카드 안에만 보여 줘요.
// 자동 상태 조회는 최대 10분(계약서 5.6) — 넘으면 멈추고 [상태 다시 확인]으로 직접 불러요. 실패로 단정하지 않아요.
const POLL_MS = 2000
const MAX_POLL_MS = 10 * 60 * 1000
const DATE = /^\d{4}-\d{2}-\d{2}$/

function Result({ run }) {
	if (run.status === "RUNNING")
		return <p role="status">케이스를 만드는 중이에요… (실행 #{run.batchRunId})</p>
	if (run.status === "FAILED")
		return (
			<div role="alert">
				<p>케이스 생성이 실패했어요. 실패한 경보만 남고 나머지는 만들어졌을 수 있어요.</p>
				{run.errorMessage && <p>{run.errorMessage}</p>}
				<p>같은 날짜로 다시 실행하면 남은 경보만 처리해요.</p>
			</div>
		)
	if (!run.rowsOut)
		return (
			<p role="status">
				만들 케이스가 없어요. (점수가 있고 케이스가 없는 경보 {run.rowsIn ?? 0}건 중 HIGH
				없음)
			</p>
		)
	return (
		<div role="status">
			<p>
				조사 케이스 {run.rowsOut}건을 생성했어요. 담당자를 배정해 주세요.
				{run.finishedAt && ` (${formatSystemTime(run.finishedAt)})`}
			</p>
			<Link to="/cases?status=OPEN">케이스 확인·배정</Link>
		</div>
	)
}

export default function OpenCasesCard({ maxPollMs = MAX_POLL_MS }) {
	const dateId = useId()
	const [date, setDate] = useState("")
	const [confirming, setConfirming] = useState(false)
	const [runId, setRunId] = useState(null)
	const [timedOut, setTimedOut] = useState(false)
	const start = useMutation({
		mutationFn: () => batchesApi.openCases({ date }),
		onSuccess: (run) => {
			setConfirming(false)
			setTimedOut(false)
			setRunId(run.batchRunId) // 202 를 받으면 바로 상태를 한 번 확인하고, RUNNING 이면 2초마다
		},
	})
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
		const timer = setTimeout(() => setTimedOut(true), maxPollMs)
		return () => clearTimeout(timer)
	}, [runId, maxPollMs])
	const stillRunning = run.data?.status === "RUNNING"
	const running = start.isPending || (stillRunning && !timedOut)
	return (
		<section className="case-panel" aria-labelledby="open-cases-title">
			<h2 id="open-cases-title">케이스 생성</h2>
			<p>
				그 날짜 경보 중 점수가 HIGH인 것만 조사 케이스로 만들어요. 이미 만든 경보는
				건너뛰어요.
			</p>
			<label htmlFor={dateId}>경보 배치 기준일</label>{" "}
			<input
				id={dateId}
				type="date"
				value={date}
				disabled={running}
				onChange={(event) => {
					setDate(event.target.value)
					start.reset()
				}}
			/>{" "}
			<button
				type="button"
				disabled={!DATE.test(date) || running}
				onClick={() => setConfirming(true)}
			>
				케이스 생성
			</button>
			{start.isError && !confirming && <p role="alert">{getErrorMessage(start.error)}</p>}
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
					title="케이스 생성"
					body={`${date} 경보 중 HIGH만 케이스로 만들어요. 이 날짜가 한 번 성공하면 다시 실행할 수 없어요.`}
					confirmLabel="생성"
					confirming={start.isPending}
					error={start.isError ? getErrorMessage(start.error) : null}
					onConfirm={() => start.mutate()}
					onCancel={() => {
						setConfirming(false)
						start.reset()
					}}
				/>
			)}
		</section>
	)
}
