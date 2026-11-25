import { useContext, useEffect, useState } from "react"
import { UNSAFE_DataRouterContext, useBlocker, useLocation, useNavigate } from "react-router"

// 미저장 입력이 있을 때 앱 안 화면 이동을 잠깐 멈추고 확인을 받아요.
//
// 앱(main.jsx)은 data router(createBrowserRouter)라서 useBlocker로 모든 앱 안 이동을 막아요 —
// 링크·메뉴 클릭, navigate() 호출(알림의 [열기] 등), 브라우저 뒤로·앞으로 가기까지(EX-15).
// data router가 없는 곳(MemoryRouter로 띄우는 테스트 등)에서는 예전처럼 링크 클릭만 잡아요.
// 새로고침·탭 닫기·바깥 주소는 각 화면의 beforeunload가 맡아요.
//
// 쓰는 법: const guard = useUnsavedLinkGuard(dirty) → guard.pending 이면 확인창,
//          guard.stay()(머무르기) · guard.leave()(저장하지 않고 이동)
export function useUnsavedLinkGuard(dirty) {
	// 라우터 종류는 앱이 떠 있는 동안 바뀌지 않아서, 어느 쪽 훅을 부를지도 처음부터 끝까지 같아요.
	const hasDataRouter = Boolean(useContext(UNSAFE_DataRouterContext))
	// eslint-disable-next-line react-hooks/rules-of-hooks -- 위 주석: 렌더마다 같은 쪽만 불려요.
	return hasDataRouter ? useBlockerGuard(dirty) : useLinkClickGuard(dirty)
}

const pathOf = (location) => location.pathname + location.search

function useBlockerGuard(dirty) {
	const blocker = useBlocker(
		({ currentLocation, nextLocation }) =>
			dirty && pathOf(currentLocation) !== pathOf(nextLocation),
	)
	const blocked = blocker.state === "blocked"
	return {
		pending: blocked ? { to: pathOf(blocker.location) } : null,
		stay: () => blocked && blocker.reset(),
		leave: () => blocked && blocker.proceed(),
	}
}

// data router가 없을 때의 대신 — 이 앱의 화면 이동은 <Link>(a 태그)라서 클릭을 먼저 잡아요.
// 이 모드에서는 브라우저 뒤로·앞으로 가기를 막지 못해요.
function useLinkClickGuard(dirty) {
	const [pending, setPending] = useState(null)
	const navigate = useNavigate()
	const location = useLocation()
	const here = pathOf(location)

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
			setPending({ to: url.pathname + url.search + url.hash })
		}
		// 캡처 단계 — Link의 클릭 처리보다 먼저 잡아야 preventDefault가 이동을 멈춰요.
		document.addEventListener("click", onClick, true)
		return () => document.removeEventListener("click", onClick, true)
	}, [dirty, here])

	return {
		pending,
		stay: () => setPending(null),
		leave: () => {
			const target = pending
			setPending(null)
			if (target) navigate(target.to)
		},
	}
}
