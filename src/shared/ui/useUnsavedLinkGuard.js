import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router"

// 미저장 입력이 있을 때 앱 안 링크 이동을 잠깐 멈추고 확인을 받아요.
// 이 앱의 화면 이동은 전부 <Link>(a 태그)라서 클릭을 먼저 잡아요 — BrowserRouter에서는 useBlocker를 못 써요.
// 새로고침·탭 닫기·바깥 주소는 beforeunload가, 브라우저 뒤로·앞으로 가기는 아직 막지 않아요.
//
// 반환: pending(가려던 경로, 없으면 null) · stay()(머무르기) · leave()(저장하지 않고 이동)
export function useUnsavedLinkGuard(dirty) {
	const [pending, setPending] = useState(null)
	const navigate = useNavigate()
	const location = useLocation()
	const here = location.pathname + location.search

	useEffect(() => {
		if (!dirty) return undefined
		const onClick = (event) => {
			// 새 탭 열기(가운데 버튼·Ctrl·⌘ 등)는 지금 화면이 남으니 막지 않아요.
			if (event.defaultPrevented || event.button !== 0) return
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
			const anchor = event.target.closest?.("a[href]")
			if (!anchor || anchor.hasAttribute("download")) return
			if (anchor.target && anchor.target !== "_self") return
			const url = new URL(anchor.href, window.location.href)
			if (url.origin !== window.location.origin) return
			if (url.pathname + url.search === here) return
			event.preventDefault()
			setPending(url.pathname + url.search + url.hash)
		}
		// 캡처 단계 — Link의 클릭 처리보다 먼저 잡아야 preventDefault가 이동을 멈춰요.
		document.addEventListener("click", onClick, true)
		return () => document.removeEventListener("click", onClick, true)
	}, [dirty, here])

	return {
		pending,
		stay: () => setPending(null),
		leave: () => {
			const to = pending
			setPending(null)
			if (to) navigate(to)
		},
	}
}
