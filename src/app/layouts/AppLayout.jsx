import { useEffect, useRef } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router"
import "../styles/app.css"
import { useSession } from "../../features/auth/hooks/useSession"
import AuthPanel from "../../features/auth/components/AuthPanel"
import GuideBar from "../../shared/ui/GuideBar"
import { useToast } from "../../shared/ui/toast/useToast"
import Icon from "../../shared/ui/dashboard/Icon"
import { visibleMenus } from "../navigation/appNavigation"
import brandMark from "../../assets/brand-mark.png"

// 위 띠 왼쪽에 지금 열린 메뉴 이름을 보여 줘요. 상세 화면(/cases/:caseNo)은 가장 긴 경로가 같은 메뉴로.
function currentMenu(menus, pathname) {
	return menus
		.filter((m) => pathname === m.path || pathname.startsWith(`${m.path}/`))
		.sort((a, b) => b.path.length - a.path.length)[0]
}

export default function AppLayout() {
	const session = useSession()
	const { pathname } = useLocation()
	const isOverview = pathname === "/overview"
	const menus = session.data ? visibleMenus(session.data.role) : []
	const current = currentMenu(menus, pathname)
	// 로그아웃·계정 전환·401 어느 길이든 loginId 가 바뀌면 이전 사람의 알림을 비워요.
	const loginId = session.data?.loginId
	const { dismiss } = useToast()
	useEffect(() => {
		dismiss()
	}, [loginId, dismiss])
	// 위 띠의 역할 칩·시연 도구 메뉴는 한 번에 하나만 — 바깥을 누르거나 Esc, 화면을 옮기면 닫아요.
	const headUtils = useRef(null)
	useEffect(() => {
		const closeAll = (except) =>
			headUtils.current?.querySelectorAll("details[open]").forEach((d) => {
				if (d !== except) d.open = false
			})
		const onClick = (event) => {
			const inside = event.target.closest?.(".head-utils details")
			closeAll(inside && headUtils.current?.contains(inside) ? inside : null)
		}
		const onKey = (event) => event.key === "Escape" && closeAll(null)
		document.addEventListener("click", onClick)
		document.addEventListener("keydown", onKey)
		closeAll(null)
		return () => {
			document.removeEventListener("click", onClick)
			document.removeEventListener("keydown", onKey)
		}
	}, [pathname])
	return (
		<>
			<a className="skip-link" href="#main-content">
				본문으로 건너뛰기
			</a>
			<div className="app-shell">
				<aside className="app-sidebar" aria-label="업무 공간">
					<Link className="app-brand" to="/overview">
						<img className="app-brand-mark" src={brandMark} alt="" />
						<div>
							DAJAVA<span>AML 인텔리전스</span>
						</div>
					</Link>
					{session.data && (
						<div className="sidebar-group">
							<p className="sidebar-label">업무 공간</p>
							<nav className="app-navigation" aria-label="주요 메뉴">
								{menus.map((m) => (
									<NavLink
										key={m.id}
										to={m.path}
										className={({ isActive }) =>
											`navigation-link${isActive ? " is-active" : ""}`
										}
									>
										<Icon name={m.icon ?? "case"} size={18} />
										<span>{m.label}</span>
									</NavLink>
								))}
							</nav>
						</div>
					)}
					<p className="sidebar-note">
						<strong>AML 조사 워크스페이스</strong>
						거래 근거부터 조사 메모까지
					</p>
				</aside>
				<div className="app-workspace">
					<header className="app-header">
						<div className="app-header-context">
							<span className="app-header-kicker">AML OPERATIONS</span>
							<span className="app-header-title">
								{current ? current.label : "조사 · 검토 · 보고"}
							</span>
						</div>
						<div className="head-utils" ref={headUtils}>
							<AuthPanel placement="header" />
							{import.meta.env.DEV && (
								// 시안의 "시연 도구" — 개발 모드에서만. 시연 화면·연동 확인으로 가는 길을 여기 모아요.
								<details className="demo-tools">
									<summary>
										<Icon name="help" size={16} /> 시연 도구
									</summary>
									<nav aria-label="개발 메뉴">
										<span>
											{import.meta.env.VITE_USE_MOCKS === "true"
												? "예시 데이터 모드 · 새로고침하면 초기화"
												: "개발 모드 · 팀 검토용"}
										</span>
										<NavLink to="/demo/overview">대시보드 시연</NavLink>
										<NavLink to="/dev/connection">백엔드 연동 확인</NavLink>
									</nav>
								</details>
							)}
						</div>
					</header>
					<main
						id="main-content"
						className={`app-main${session.data ? "" : " is-signed-out"}`}
						tabIndex={-1}
					>
						<AuthPanel />
						{!session.data &&
							import.meta.env.DEV &&
							import.meta.env.VITE_USE_MOCKS === "true" && (
								<p className="environment-note" role="note">
									예시 데이터 모드 · 변경 내용은 새로고침하면 초기화됩니다.
								</p>
							)}
						{/* URL을 유지하므로 로그인 후 원래 열었던 케이스로 돌아갑니다.
						  세션 확인 전에는 업무 조회와 이전 계정 화면을 렌더링하지 않습니다. */}
						{session.data &&
							(isOverview ? (
								<Outlet key={session.data.loginId} />
							) : (
								<GuideBar role={session.data.role}>
									<Outlet key={session.data.loginId} />
								</GuideBar>
							))}
					</main>
				</div>
			</div>
		</>
	)
}
