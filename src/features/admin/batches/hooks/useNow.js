import { useEffect, useState } from "react"

// 경과 시간 표시용 지금 시각(ms) — active 동안만 intervalMs 마다 다시 그려요. 렌더 중에 Date.now() 를 부르지 않게(React 순수성).
export function useNow(active, intervalMs = 1000) {
	const [now, setNow] = useState(() => Date.now())
	useEffect(() => {
		if (!active) return undefined
		const timer = setInterval(() => setNow(Date.now()), intervalMs)
		return () => clearInterval(timer)
	}, [active, intervalMs])
	return now
}

/** 시작 시각(ISO)부터 지금까지 — "1분 20초"·"35초". 시작 시각이 없으면 null. */
export function elapsedText(startedAt, now) {
	if (!startedAt) return null
	const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))
	const minutes = Math.floor(seconds / 60)
	return minutes ? `${minutes}분 ${seconds % 60}초` : `${seconds}초`
}
