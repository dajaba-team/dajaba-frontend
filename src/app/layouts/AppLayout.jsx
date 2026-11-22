import { useEffect, useRef } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router"
import "../styles/app.css"
import { useSession } from "../../features/auth/hooks/useSession"
import AuthPanel from "../../features/auth/components/AuthPanel"
import NotificationBell from "../../features/notifications/components/NotificationBell"
import GuideBar from "../../shared/ui/GuideBar"
import { useToast } from "../../shared/ui/toast/useToast"
import Icon from "../../shared/ui/dashboard/Icon"
import { visibleMenus } from "../navigation/appNavigation"
import brandMark from "../../assets/brand-mark.png"
import { useSidebarCollapsed } from "./useSidebarCollapsed"

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
	// 사이드바 접기·펼치기(SCRUM-327). 넓은 화면에서만 접혀요 — 좁은 화면은 기존처럼 위에 쌓여요.
	// 버튼을 누르면 사라지는 쪽 대신 새로 나타난 버튼으로 초점을 옮겨요.
	const [sidebarCollapsed, toggleSidebar] = useSidebarCollapsed()
	const closeSidebarButton = useRef(null)
	const openSidebarButton = useRef(null)
	const sidebarToggled = useRef(false)
	useEffect(() => {
		if (!sidebarToggled.current) return
		sidebarToggled.current = false
		;(sidebarCollapsed ? openSidebarButton : closeSidebarButton).current?.focus()
	}, [sidebarCollapsed])
	const onToggleSidebar = () => {
		sidebarToggled.current = true
		toggleSidebar()
	}
	// 위 띠의 알림 종·역할 칩·시연 도구 메뉴는 한 번에 하나만 — 바깥을 누르거나 Esc, 화면을 옮기면 닫아요.
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
			<div className={`app-shell${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`}>
				{sidebarCollapsed && (
					// 접은 상태: 왼쪽 위 작은 알약 — 로고는 대시보드로, » 는 사이드바를 다시 펼쳐요.
					<div className="sidebar-pill">
						<Link
							className="sidebar-pill-brand"
							to="/overview"
							aria-label="DAJABA 업무 대시보드"
						>
							<img src={brandMark} alt="" />
							<span aria-hidden="true">DAJABA</span>
						</Link>
						<button
							ref={openSidebarButton}
							type="button"
							className="sidebar-toggle"
							onClick={onToggleSidebar}
							aria-label="사이드바 열기"
							aria-expanded="false"
							aria-controls="app-sidebar"
							title="사이드바 열기 (Ctrl+B)"
						>
							<Icon name="chevronsRight" size={16} />
						</button>
					</div>
				)}
				<aside id="app-sidebar" className="app-sidebar" aria-label="업무 공간">
					<div className="app-brand-row">
						<Link className="app-brand" to="/overview">
							<img className="app-brand-mark" src={brandMark} alt="" />
							<div>
								DAJABA<span>AML 인텔리전스</span>
							</div>
						</Link>
						<button
							ref={closeSidebarButton}
							type="button"
							className="sidebar-toggle"
							onClick={onToggleSidebar}
							aria-label="사이드바 닫기"
							aria-expanded={!sidebarCollapsed}
							aria-controls="app-sidebar"
							title="사이드바 닫기 (Ctrl+B)"
						>
							<Icon name="chevronsLeft" size={16} />
						</button>
					</div>
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
							<span className="app-header-title">
								{current ? current.label : "조사 · 검토 · 보고"}
							</span>
						</div>
						<div className="head-utils" ref={headUtils}>
							{/* 업무 알림 종(SCRUM-334) — 계정이 바뀌면 본 시각·숫자를 처음부터 */}
							{loginId && <NotificationBell key={loginId} loginId={loginId} />}
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
