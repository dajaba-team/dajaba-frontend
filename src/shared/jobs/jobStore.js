// 작업 추적기의 저장·상태 규칙(SCRUM-365, 「비동기 작업 알림 설계 문서」 7.2·8.2). 화면 없이 테스트할 수 있게 순수 함수로 둬요.
export const MAX_TRACKING = 10
export const MAX_FINISHED = 5
export const STALE_MS = 10 * 60 * 1000
export const QUIET_AFTER_MS = 60 * 1000 // 복구했는데 끝난 지 1분이 넘은 결과는 토스트 없이 목록에만(7.6)
export const FINISHED = ["DONE", "FAILED", "LOST"]
const ACTIVE = ["TRACKING", "STALE"]

export const storageKey = (loginId) => `aml.jobs.${loginId}`
export const sameJob = (a, b) => a.kind === b.kind && a.id === b.id

/** sessionStorage(탭별, 로그인 아이디별). 못 쓰는 환경이면 빈 목록 — 메모리로만 돌아요(9 #24). */
export function readJobs(loginId) {
	try {
		const jobs = JSON.parse(sessionStorage.getItem(storageKey(loginId)) ?? "[]")
		return Array.isArray(jobs) ? jobs.map((job) => ({ ...job, restored: true })) : []
	} catch {
		return []
	}
}

export function writeJobs(loginId, jobs) {
	try {
		sessionStorage.setItem(
			storageKey(loginId),
			// eslint-disable-next-line no-unused-vars
			JSON.stringify(jobs.map(({ restored, ...job }) => job)),
		)
	} catch {
		// 저장하지 못해도 이 화면에서는 계속 추적해요
	}
}

export function clearJobs(loginId) {
	try {
		sessionStorage.removeItem(storageKey(loginId))
	} catch {
		// 지울 수 없으면 그대로 — 키에 로그인 아이디가 있어 남에게 보이지 않아요
	}
}

/** 끝난 작업은 최근 MAX_FINISHED개만(7.2). 목록은 최신 등록 순. */
export function trim(jobs) {
	let finished = 0
	return jobs.filter((job) => !FINISHED.includes(job.state) || ++finished <= MAX_FINISHED)
}

/**
 * 등록 — 같은 종류·번호가 진행 중이면 무시(9 #18), 끝난 것이면 새로 갈아 끼워요(PDF 다시 만들기).
 * 진행 중이 MAX_TRACKING개면 받지 않아요(9 #19).
 */
export function addJob(jobs, input, now) {
	const existing = jobs.find((job) => sameJob(job, input))
	if (existing && ACTIVE.includes(existing.state))
		return { jobs, added: false, reason: "DUPLICATE" }
	if (jobs.filter((job) => ACTIVE.includes(job.state)).length >= MAX_TRACKING)
		return { jobs, added: false, reason: "TOO_MANY" }
	const job = {
		...input,
		state: "TRACKING",
		trackedAt: new Date(now).toISOString(),
		finishedAt: null,
		text: null,
		tone: null,
		seen: true,
	}
	return { jobs: trim([job, ...jobs.filter((other) => !sameJob(other, input))]), added: true }
}

export const updateJob = (jobs, target, patch) =>
	trim(jobs.map((job) => (sameJob(job, target) ? { ...job, ...patch } : job)))

/** 10분이 지나도 진행 중이면 확인 필요(STALE) — 실패로 단정하지 않아요(8.2). */
export const isStale = (job, now) => now - Date.parse(job.trackedAt) > STALE_MS

export const runningCount = (jobs) => jobs.filter((job) => ACTIVE.includes(job.state)).length
export const unseenCount = (jobs) =>
	jobs.filter((job) => FINISHED.includes(job.state) && !job.seen).length
