// 데이터·배치 운영에서 마지막으로 고른 분석 날짜(sessionStorage, 사용자별, SCRUM-345).
// 저장소를 못 쓰는 환경(사생활 보호 창 등)에선 빈 값 → 그 화면에서만 유지.
const DATE = /^\d{4}-\d{2}-\d{2}$/
const DATE_KEY = "dajaba.batches.date.v1"

export const isBatchDate = (value) => DATE.test(value ?? "")
export const batchDateKey = (loginId) => `${DATE_KEY}.${loginId ?? "_"}`

export function readBatchDate(key) {
	try {
		const value = sessionStorage.getItem(key)
		return isBatchDate(value) ? value : ""
	} catch {
		return ""
	}
}

export function writeBatchDate(key, value) {
	try {
		if (isBatchDate(value)) sessionStorage.setItem(key, value)
		else sessionStorage.removeItem(key)
	} catch {
		// 저장하지 못해도 화면 상태는 바뀌어요
	}
}
