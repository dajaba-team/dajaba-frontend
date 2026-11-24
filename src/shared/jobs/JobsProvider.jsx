import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueries } from "@tanstack/react-query"
import { useLocation } from "react-router"
import { useToast } from "../ui/toast/useToast"
import { backoffMs, createFailureCounter } from "./failureBackoff"
import { JobsContext } from "./JobsContext"
import {
	addJob,
	clearJobs,
	FINISHED,
	isStale,
	QUIET_AFTER_MS,
	readJobs,
	runningCount,
	unseenCount,
	updateJob,
	writeJobs,
} from "./jobStore"

// 작업 추적기(SCRUM-365, 「비동기 작업 알림 설계 문서」 7.2·8.2·9). 내가 시작한 비동기 작업을 화면을 옮겨도 지켜보다가 끝나면 토스트로.
// 종류별 조회·판정은 kinds(app/jobs/jobKinds)가 정해요 — shared 는 기능을 몰라요. 같은 조회 키를 화면 카드도 쓰면 요청이 합쳐져요(4-3).
// 끝남: 그 작업 화면에 있거나, 복구한 지난 결과(끝난 지 1분 넘음)면 토스트 없이 목록에만(7.6). 404·403은 확인 불가(LOST), 401은 전부 멈춤.
export default function JobsProvider({ loginId, kinds, children }) {
	const [jobs, setJobs] = useState(() => (loginId ? readJobs(loginId) : []))
	const jobsRef = useRef(jobs)
	const [stopped, setStopped] = useState(false)
	const announced = useRef(new Set())
	const counter = useRef(null)
	if (counter.current === null) counter.current = createFailureCounter()
	const { show } = useToast()
	const { pathname } = useLocation()
	const pathRef = useRef(pathname)
	// 판정 effect 보다 먼저 — 지금 목록·화면 주소를 콜백에서 읽게
	useEffect(() => {
		jobsRef.current = jobs
		pathRef.current = pathname
	}, [jobs, pathname])

	// 계정이 바뀌면 그 사람 것만 다시 읽고, 로그아웃(→ 없음)이면 이전 사람 것을 지워요(9 #5·#6).
	const previousLogin = useRef(loginId)
	useEffect(() => {
		const before = previousLogin.current
		if (before === loginId) return
		previousLogin.current = loginId
		if (before && !loginId) clearJobs(before)
		announced.current = new Set()
		counter.current.clear()
		setStopped(false)
		setJobs(loginId ? readJobs(loginId) : [])
	}, [loginId])

	useEffect(() => {
		if (loginId) writeJobs(loginId, jobs)
	}, [loginId, jobs])

	const tracking = useMemo(
		() => jobs.filter((job) => job.state === "TRACKING" && kinds[job.kind]),
		[jobs, kinds],
	)
	useEffect(() => {
		counter.current.keep(tracking.map((job) => `${job.kind}:${job.id}`))
	}, [tracking])
	const results = useQueries({
		queries: tracking.map((job) => {
			const kind = kinds[job.kind]
			return {
				queryKey: kind.queryKey(job),
				queryFn: ({ signal }) => kind.fetch(job, signal),
				enabled: !stopped,
				retry: false,
				// 네트워크·5xx 가 이어지면 간격을 늘려 가며(최대 30초) 계속(9 #10) — 작업마다 실패 수를 따로 세요.
				refetchInterval: (query) =>
					backoffMs(
						kind.intervalMs,
						counter.current.observe(`${job.kind}:${job.id}`, query.state),
					),
				refetchIntervalInBackground: false,
			}
		}),
	})

	const finish = useCallback(
		(job, verdict, announce) => {
			const key = `${job.kind}:${job.id}`
			if (announced.current.has(key)) return
			announced.current.add(key)
			setJobs((all) =>
				updateJob(all, job, {
					state: verdict.state,
					text: verdict.text,
					tone: verdict.tone,
					finishedAt: verdict.finishedAt ?? new Date().toISOString(),
					seen: false,
					restored: false,
				}),
			)
			if (announce)
				show({
					tone: verdict.tone,
					text: verdict.text,
					sticky: verdict.state === "FAILED",
					action: { label: "결과 보기", to: job.to },
				})
		},
		[show],
	)

	const signature = results.map((r) => `${r.dataUpdatedAt}:${r.errorUpdatedAt}`).join("|")
	useEffect(() => {
		const now = Date.now()
		tracking.forEach((job, index) => {
			const result = results[index]
			if (!result) return
			// 등록(또는 [다시 확인]) 전에 받은 결과는 쓰지 않아요 — 같은 번호로 다시 등록하면
			// 캐시에 남은 예전 결과(예: PDF FAILED)로 바로 끝나 버려서(#96 리뷰)
			const since = Date.parse(job.trackedAt)
			if (result.isError) {
				if (result.errorUpdatedAt < since) return
				const status = result.error?.response?.status
				if (status === 401) setStopped(true)
				else if (status === 403 || status === 404)
					finish(
						job,
						{ state: "LOST", tone: "info", text: `${job.label} · 확인할 수 없어요` },
						false,
					)
				else if (isStale(job, now))
					setJobs((all) => updateJob(all, job, { state: "STALE" }))
				return
			}
			if (!result.data || result.dataUpdatedAt < since) return
			const verdict = kinds[job.kind].evaluate(job, result.data)
			if (verdict.state === "TRACKING") {
				if (isStale(job, now)) setJobs((all) => updateJob(all, job, { state: "STALE" }))
				return
			}
			const late =
				job.restored &&
				verdict.finishedAt &&
				now - Date.parse(verdict.finishedAt) > QUIET_AFTER_MS
			finish(job, verdict, pathRef.current !== job.to && !late)
		})
		// results 는 매 렌더 새 배열이라 signature(받은 시각)와 jobs 로만 다시 봐요
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [signature, jobs, finish, kinds])

	const track = useCallback(
		(input) => {
			if (!loginId || !kinds[input.kind]) return false
			const result = addJob(jobsRef.current, input, Date.now())
			if (result.reason === "TOO_MANY")
				show({
					tone: "error",
					text: "진행 중인 작업이 너무 많아요. 끝난 뒤 다시 시도해 주세요.",
				})
			if (!result.added) return false
			announced.current.delete(`${input.kind}:${input.id}`)
			jobsRef.current = result.jobs
			setJobs(result.jobs)
			return true
		},
		[loginId, kinds, show],
	)

	// [다시 확인] — 한 번 더 조회하고, 아직 진행 중이면 10분을 다시 세요(7.5)
	const recheck = useCallback(
		(job) =>
			setJobs((all) =>
				updateJob(all, job, { state: "TRACKING", trackedAt: new Date().toISOString() }),
			),
		[],
	)

	const markSeen = useCallback(
		() =>
			setJobs((all) =>
				all.some((job) => FINISHED.includes(job.state) && !job.seen)
					? all.map((job) =>
							FINISHED.includes(job.state) ? { ...job, seen: true } : job,
						)
					: all,
			),
		[],
	)

	const value = useMemo(
		() => ({
			jobs,
			track,
			recheck,
			markSeen,
			running: runningCount(jobs),
			unseen: unseenCount(jobs),
		}),
		[jobs, track, recheck, markSeen],
	)
	return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>
}
