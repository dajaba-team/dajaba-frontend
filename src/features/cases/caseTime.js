import { formatDataTime, formatSystemTime } from "../../shared/format/time"

// 케이스 상세는 분까지만 보여 줘요. 거래 데이터(IBM HI-Small)는 분 단위라 초가 늘 00 이고,
// 처리 시각도 조사 판단에 초까지 필요하지 않아요 — 줄마다 붙던 ":00" 이 숫자 노이즈였어요.
// 값이 시각 꼴이 아니면(— 등) 그대로 둬요.
const dropSeconds = (text) =>
	typeof text === "string" ? text.replace(/(\d{2}:\d{2}):\d{2}$/, "$1") : text

export const formatDataMinute = (value) => dropSeconds(formatDataTime(value))
export const formatSystemMinute = (value, options) => dropSeconds(formatSystemTime(value, options))
