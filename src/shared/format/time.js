// 시각 표기 규칙 [BE 미결 12·27, 10/30 · SCRUM-21]
// - 시스템 시각(created_at·produced_at·occurred_at 등)은 UTC `Z`·초 단위로 와요 → 화면에서 로컬 시각으로 바꿔요.
// - 데이터 시각(ts·transaction_ts·window_*·reference_ts)은 시간대 없는 원천 값이에요 → 시간대를 붙이거나 바꾸지 않아요.

const SYSTEM_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

const formatters = new Map()
function formatterFor(timeZone) {
	const key = timeZone ?? ""
	if (!formatters.has(key)) {
		// sv-SE는 "2026-10-30 14:12:00" 모양이라 데이터 시각과 같은 자리 배치로 보여요.
		formatters.set(
			key,
			new Intl.DateTimeFormat("sv-SE", {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hour12: false,
				...(timeZone && { timeZone }),
			}),
		)
	}
	return formatters.get(key)
}

/** 시스템 시각(UTC `Z`)을 로컬 시각으로. `Z`가 아닌 값은 계약 위반이라 바꾸지 않고 그대로 보여 줘요. */
export function formatSystemTime(value, { timeZone } = {}) {
	if (value == null || value === "") return ""
	const text = String(value)
	if (!SYSTEM_TIME.test(text)) return text
	return formatterFor(timeZone).format(new Date(text))
}

/** 데이터 시각은 받은 그대로. 읽기 쉽게 `T`만 공백으로 바꾸고, Date로 해석하지 않아요(해석하면 브라우저 시간대가 붙어요). */
export function formatDataTime(value) {
	if (value == null || value === "") return ""
	return String(value).replace("T", " ")
}
