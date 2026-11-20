import { useCallback, useEffect, useState } from "react"

// 사이드바 접힘 상태(SCRUM-327). 처음엔 펼친 상태이고, 사용자가 접었을 때만 이 브라우저에 기억해요.
// 저장소를 못 쓰는 환경(사생활 보호 창 등)에선 이번 화면에서만 유지해요.
export const SIDEBAR_STORAGE_KEY = "dajaba.sidebar.v1"

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

function isTyping(target) {
	return Boolean(
		target?.closest?.(
			'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
		),
	)
}

export function useSidebarCollapsed() {
	const [collapsed, setCollapsed] = useState(readCollapsed)

	const toggle = useCallback(() => {
		setCollapsed((prev) => {
			writeCollapsed(!prev)
			return !prev
		})
	}, [])

	// Ctrl+B(맥은 Cmd+B)로도 열고 닫아요. 브라우저 기본 동작(북마크 창 등)은 막아요.
	// 글을 쓰는 중(입력칸·본문 편집)이거나 확인창이 열려 있으면 건드리지 않아요 — 굵게 습관 키로 화면이 바뀌지 않게.
	useEffect(() => {
		const onKey = (event) => {
			if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
			if (event.key !== "b" && event.key !== "B") return
			if (isTyping(event.target) || document.querySelector('[role="dialog"]')) return
			event.preventDefault()
			toggle()
		}
		document.addEventListener("keydown", onKey)
		return () => document.removeEventListener("keydown", onKey)
	}, [toggle])

	return [collapsed, toggle]
}
