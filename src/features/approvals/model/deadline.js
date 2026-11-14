// 보고 마감 배지 (SCRUM-111, FR-APR-07). 〔미결 — 서식 안건 1: 3영업일 마감 규칙은 서식 회의에서 확정〕
// 지금 규칙: 승인한 날(한국 날짜) **다음 영업일을 1일째**로 세어 **3영업일째 23:59(한국 시각)**가 마감.
// 영업일 = 월~금. **공휴일은 반영하지 않아요** — 화면에도 "공휴일 미반영"을 같이 써요.
// 서버가 마감을 주게 되면(str_reports, BE 05_flyway 미배정) 이 파일 대신 그 값을 써요.

export const BUSINESS_ZONE = "Asia/Seoul"
export const DEADLINE_BUSINESS_DAYS = 3

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: BUSINESS_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
})

/** 시각(Date·ISO 문자열) → 한국 날짜 "YYYY-MM-DD". */
export function businessDate(value) {
	return dayFormatter.format(new Date(value))
}

// 날짜 문자열끼리만 계산해요(시각대 섞임 없이). 내부 값은 UTC 자정.
const toDay = (date) =>
	Date.UTC(...date.split("-").map((part, i) => Number(part) - (i === 1 ? 1 : 0)))
const fromDay = (ms) => new Date(ms).toISOString().slice(0, 10)
const DAY_MS = 86_400_000
const isBusinessDay = (ms) => ![0, 6].includes(new Date(ms).getUTCDay())

/** 승인 시각 → 마감 날짜 "YYYY-MM-DD"(그날 23:59 한국 시각까지). */
export function deadlineDate(approvedAt) {
	let ms = toDay(businessDate(approvedAt))
	let counted = 0
	while (counted < DEADLINE_BUSINESS_DAYS) {
		ms += DAY_MS
		if (isBusinessDay(ms)) counted += 1
	}
	return fromDay(ms)
}

/**
 * 배지 상태. now 는 테스트용(기본 지금).
 * @returns {{ deadline: string, remaining: number, state: "OPEN"|"TODAY"|"OVERDUE" }}
 *   remaining — 오늘 다음 날부터 마감일까지 영업일 수(오늘 마감이면 0)
 */
export function deadlineStatus(approvedAt, now = new Date()) {
	const deadline = deadlineDate(approvedAt)
	const today = toDay(businessDate(now))
	const end = toDay(deadline)
	if (today > end) return { deadline, remaining: 0, state: "OVERDUE" }
	if (today === end) return { deadline, remaining: 0, state: "TODAY" }
	let remaining = 0
	for (let ms = today + DAY_MS; ms <= end; ms += DAY_MS) if (isBusinessDay(ms)) remaining += 1
	return { deadline, remaining, state: "OPEN" }
}

/** 배지 글자. 예: "마감까지 3영업일 · 11/18 23:59 · 공휴일 미반영" */
export function deadlineText(status) {
	const [, month, day] = status.deadline.split("-").map(Number)
	const when = `${month}/${day} 23:59`
	if (status.state === "OVERDUE") return `마감 지남 · ${when} · 공휴일 미반영`
	if (status.state === "TODAY") return `오늘 마감 · ${when} · 공휴일 미반영`
	return `마감까지 ${status.remaining}영업일 · ${when} · 공휴일 미반영`
}
