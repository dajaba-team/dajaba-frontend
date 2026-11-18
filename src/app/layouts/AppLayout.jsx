import { useEffect } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router"
import "../styles/app.css"
import { useSession } from "../../features/auth/hooks/useSession"
import AuthPanel from "../../features/auth/components/AuthPanel"
import GuideBar from "../../shared/ui/GuideBar"
import { useToast } from "../../shared/ui/toast/useToast"
import Icon from "../../shared/ui/dashboard/Icon"
import { visibleMenus } from "../navigation/appNavigation"

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
	return (
		<>
			<a className="skip-link" href="#main-content">
				본문으로 건너뛰기
			</a>
			<div className="app-shell">
				<aside className="app-sidebar" aria-label="업무 공간">
					<Link className="app-brand" to="/overview">
						<i className="app-brand-mark">
							<Icon name="chart" size={21} />
						</i>
						<div>
							DAJABA<span>AML 인텔리전스</span>
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
					{import.meta.env.DEV && (
						<div className="sidebar-group is-dev">
							<p className="sidebar-label">개발 도구</p>
							<nav className="app-navigation" aria-label="개발 메뉴">
								<NavLink to="/demo/overview" className="navigation-link">
									<Icon name="sparkle" size={18} />
									<span>대시보드 시연</span>
								</NavLink>
								<NavLink to="/dev/connection" className="navigation-link">
									<Icon name="refresh" size={18} />
									<span>백엔드 연동 확인</span>
								</NavLink>
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
						<AuthPanel placement="header" />
					</header>
					<main
						id="main-content"
						className={`app-main${session.data ? "" : " is-signed-out"}`}
						tabIndex={-1}
					>
						<AuthPanel />
						{import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === "true" && (
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
