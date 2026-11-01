import { Link, NavLink, Outlet } from "react-router"
import "../styles/app.css"
import { useSession } from "../../features/auth/hooks/useSession"
import AuthPanel from "../../features/auth/components/AuthPanel"

export default function AppLayout() {
	const session = useSession()
	return (
		<>
			<a className="skip-link" href="#main-content">
				본문으로 건너뛰기
			</a>
			<div className="app-shell">
				{/* 앱 공통 탐색만 배치하고 개별 업무 화면은 features에서 관리합니다. */}
				<aside className="app-sidebar" aria-label="업무 공간">
					<Link className="app-brand" to="/cases">
						DAJABA<span>AML 인텔리전스</span>
					</Link>
					<p className="sidebar-label">업무 공간</p>
					<nav className="app-navigation" aria-label="주요 메뉴">
						<NavLink
							to="/cases"
							className={({ isActive }) =>
								`navigation-link${isActive ? " is-active" : ""}`
							}
						>
							조사 케이스
						</NavLink>
						{import.meta.env.DEV && (
							<NavLink to="/demo/overview" className="navigation-link">
								대시보드 시연
							</NavLink>
						)}
						{import.meta.env.DEV && (
							<NavLink to="/dev/connection" className="navigation-link">
								백엔드 연동 확인
							</NavLink>
						)}
					</nav>
					<p className="sidebar-note">
						거래 근거부터 조사 메모까지
						<br />
						AML 조사 워크스페이스
					</p>
				</aside>
				<div className="app-workspace">
					<header className="app-header">
						<span>AML OPERATIONS</span>
						<span>조사 · 검토 · 보고</span>
					</header>
					<main id="main-content" className="app-main" tabIndex={-1}>
						<AuthPanel />
						{import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === "true" && (
							<p className="environment-note" role="note">
								예시 데이터 모드 · 변경 내용은 새로고침하면 초기화됩니다.
							</p>
						)}
						{/* URL를 유지하므로 로그인 후 원래 열었던 케이스로 돌아갑니다.
						  세션 확인 전에는 업무 조회와 이전 계정 화면을 렌더링하지 않습니다. */}
						{session.data && <Outlet key={session.data.loginId} />}
					</main>
				</div>
			</div>
		</>
	)
}
