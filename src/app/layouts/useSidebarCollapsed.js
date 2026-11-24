import { useCallback, useEffect, useState } from "react"

// 사이드바 접힘 상태(SCRUM-327). 처음엔 펼친 상태이고, 사용자가 접었을 때만 이 브라우저에 기억해요.
// 저장소를 못 쓰는 환경(사생활 보호 창 등)에선 이번 화면에서만 유지해요.
export const SIDEBAR_STORAGE_KEY = "dajaba.sidebar.v1"
// 사이드바가 접히는 넓은 화면 기준 — app.css 의 `@media (min-width: 48rem)` 과 같은 값이에요.
const WIDE_SCREEN_QUERY = "(min-width: 48rem)"

function readCollapsed() {
	try {
		return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed"
	} catch {
		return false
	}
}

function writeCollapsed(collapsed) {
	try {
		if (collapsed) localStorage.setItem(SIDEBAR_STORAGE_KEY, "collapsed")
		else localStorage.removeItem(SIDEBAR_STORAGE_KEY)
	} catch {
		// 저장하지 못해도 화면 상태는 바뀌어요.
	}
}

// 좁은 화면에선 사이드바가 위에 쌓여 접히지 않으니, 단축키로 상태만 바뀌어 저장되지 않게 해요.
// matchMedia 가 없는 환경(일부 테스트 등)은 넓은 화면으로 봐요.
function isWideScreen() {
	return window.matchMedia?.(WIDE_SCREEN_QUERY).matches ?? true
}

function isTyping(target) {
	return Boolean(
		target?.closest?.(
			'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
		),
	)
}

// enabled=false(로그인 전 — 사이드바가 없음)면 단축키를 받지 않아요.
export function useSidebarCollapsed({ enabled = true } = {}) {
	const [collapsed, setCollapsed] = useState(readCollapsed)

	const toggle = useCallback(() => {
		setCollapsed((prev) => {
			writeCollapsed(!prev)
			return !prev
		})
	}, [])

	// Ctrl+B(맥은 Cmd+B)로도 열고 닫아요. 브라우저 기본 동작(북마크 창 등)은 막아요.
	// 글을 쓰는 중(입력칸·본문 편집)이거나 확인창이 열려 있으면 건드리지 않아요 — 굵게 습관 키로 화면이 바뀌지 않게.
	// 좁은 화면(사이드바가 안 접힘)에서도 받지 않아요.
	useEffect(() => {
		if (!enabled) return
		const onKey = (event) => {
			if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
			if (event.key !== "b" && event.key !== "B") return
			if (!isWideScreen()) return
			if (isTyping(event.target) || document.querySelector('[role="dialog"]')) return
			event.preventDefault()
			toggle()
		}
		document.addEventListener("keydown", onKey)
		return () => document.removeEventListener("keydown", onKey)
	}, [enabled, toggle])

	return [collapsed, toggle]
}
