import { afterEach, describe, expect, it } from "vitest"
import {
	addJob,
	isStale,
	MAX_TRACKING,
	readJobs,
	runningCount,
	STALE_MS,
	storageKey,
	unseenCount,
	updateJob,
	writeJobs,
} from "../shared/jobs/jobStore"

// 작업 추적기 저장·상태 규칙(SCRUM-365, 설계 7.2·8.2·9).
const NOW = Date.parse("2026-11-23T03:00:00Z")
const job = (id, extra = {}) => ({
	kind: "ANALYSIS",
	id: String(id),
	label: "분석",
	to: "/x",
	...extra,
})

afterEach(() => sessionStorage.clear())

describe("작업 추적기 저장·상태", () => {
	it("같은 작업이 진행 중이면 두 번 등록하지 않고, 끝난 같은 작업은 새로 갈아 끼운다", () => {
		const first = addJob([], job(1), NOW)
		expect(first.added).toBe(true)
		expect(first.jobs[0]).toMatchObject({ state: "TRACKING", seen: true })
		expect(addJob(first.jobs, job(1), NOW)).toMatchObject({ added: false, reason: "DUPLICATE" })

		const done = updateJob(first.jobs, job(1), { state: "FAILED", seen: false })
		const again = addJob(done, job(1), NOW + 1000)
		expect(again.added).toBe(true)
		expect(again.jobs).toHaveLength(1)
		expect(again.jobs[0].state).toBe("TRACKING")
	})

	it("진행 중이 10개면 더 받지 않고, 끝난 것은 최근 5개만 남긴다", () => {
		let jobs = []
		for (let i = 0; i < MAX_TRACKING; i += 1) jobs = addJob(jobs, job(i), NOW).jobs
		expect(addJob(jobs, job(99), NOW)).toMatchObject({ added: false, reason: "TOO_MANY" })
		expect(runningCount(jobs)).toBe(MAX_TRACKING)

		for (let i = 0; i < MAX_TRACKING; i += 1)
			jobs = updateJob(jobs, job(i), { state: "DONE", seen: false })
		expect(jobs).toHaveLength(5)
		expect(unseenCount(jobs)).toBe(5)
	})

	it("로그인 아이디별로 저장·복구하고, 복구한 작업에는 restored 표시가 붙는다", () => {
		writeJobs("admin", addJob([], job(7), NOW).jobs)
		expect(readJobs("admin")).toEqual([expect.objectContaining({ id: "7", restored: true })])
		expect(readJobs("other")).toEqual([])
		expect(JSON.parse(sessionStorage.getItem(storageKey("admin")))[0]).not.toHaveProperty(
			"restored",
		)
		sessionStorage.setItem(storageKey("broken"), "{")
		expect(readJobs("broken")).toEqual([])
	})

	it("등록한 지 10분이 넘으면 확인 필요(STALE) 대상이다", () => {
		const tracked = addJob([], job(1), NOW).jobs[0]
		expect(isStale(tracked, NOW + STALE_MS)).toBe(false)
		expect(isStale(tracked, NOW + STALE_MS + 1)).toBe(true)
	})
})
