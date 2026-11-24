export const MAX_BACKOFF_MS = 30_000

// 연속 실패 수에 맞춘 다음 조회 간격 — 실패 0이면 기본, n번이면 기본 × 2ⁿ(최대 maxMs)
export function backoffMs(baseMs, failures, maxMs = MAX_BACKOFF_MS) {
	return failures === 0 ? baseMs : Math.min(baseMs * 2 ** failures, maxMs)
}

// 작업마다(키 = kind:id) 연속 실패 수를 세요. TanStack Query 의 fetchFailureCount 는 retry:false 에서
// 요청을 시작할 때마다 0이 되어 1을 넘지 못해서, 조회 상태(status·errorUpdatedAt)를 보고 따로 세요.
// observe 는 간격 함수에서 같은 상태로 여러 번 불려도 수가 바뀌지 않아요(새 실패마다 +1, 성공하면 0).
export function createFailureCounter() {
	const entries = new Map()
	return {
		observe(key, state) {
			const entry = entries.get(key) ?? { count: 0, lastErrorAt: undefined }
			if (state.status === "success") {
				entry.count = 0
			} else if (state.status === "error" && state.errorUpdatedAt !== entry.lastErrorAt) {
				entry.count += 1
				entry.lastErrorAt = state.errorUpdatedAt
			}
			entries.set(key, entry)
			return entry.count
		},
		forget(key) {
			entries.delete(key)
		},
		// 이 키들만 남기고 나머지는 지워요 — 추적에서 빠진(끝난) 작업
		keep(keys) {
			const retained = new Set(keys)
			for (const key of entries.keys()) {
				if (!retained.has(key)) entries.delete(key)
			}
		},
		clear() {
			entries.clear()
		},
	}
}
