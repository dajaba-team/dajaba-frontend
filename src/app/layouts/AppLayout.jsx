import { useEffect, useRef, useState } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router"
import TutorialDialog from "../../shared/ui/tutorial/TutorialDialog"
import "../styles/app.css"
import { useSession } from "../../features/auth/hooks/useSession"
import AuthPanel from "../../features/auth/components/AuthPanel"
import NotificationBell from "../../features/notifications/components/NotificationBell"
import GuideBar from "../../shared/ui/GuideBar"
import { useToast } from "../../shared/ui/toast/useToast"
import Icon from "../../shared/ui/dashboard/Icon"
import { visibleMenus } from "../navigation/appNavigation"
import brandMark from "../../assets/brand-mark.png"
import JobsProvider from "../../shared/jobs/JobsProvider"
import { jobKinds } from "../jobs/jobKinds"

export default function AppLayout() {
	const session = useSession()
	const { pathname } = useLocation()
	const isOverview = pathname === "/overview"
	// 로그인 전(세션 확인 중 포함)에는 사이드바·위 띠 없이 로그인 카드만 보여요(SCRUM-387).
	const signedIn = Boolean(session.data)
	const menus = session.data ? visibleMenus(session.data.role) : []
	// 로그아웃·계정 전환·401 어느 길이든 loginId 가 바뀌면 이전 사람의 알림을 비워요.
	const loginId = session.data?.loginId
	const { dismiss } = useToast()
	useEffect(() => {
		dismiss()
	}, [loginId, dismiss])
	// 사용 안내(SCRUM-428) — 위 띠 [사용 안내]로 여는 단계별 안내 창. 운영(빌드)에서도 보여요.
	const [guideOpen, setGuideOpen] = useState(false)
	// 위 띠의 알림 종·역할 칩 메뉴는 한 번에 하나만 — 바깥을 누르거나 Esc, 화면을 옮기면 닫아요.
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
	// 좁은 화면(모바일) 메뉴 — 사이드바를 왼쪽에서 밀려 나오는 서랍으로 열고 닫아요(SCRUM-410).
	// 화면을 옮기면(메뉴를 누르면) 닫히고, Esc·바깥 누르기로도 닫혀요. 열려 있는 동안 뒤 화면은 스크롤되지 않아요.
	const [menuOpen, setMenuOpen] = useState(false)
	const menuButton = useRef(null)
	const [menuPath, setMenuPath] = useState(pathname)
	if (menuPath !== pathname) {
		setMenuPath(pathname)
		setMenuOpen(false)
	}
	useEffect(() => {
		if (!menuOpen) return
		const onKey = (event) => {
			if (event.key !== "Escape") return
			setMenuOpen(false)
			menuButton.current?.focus()
		}
		document.addEventListener("keydown", onKey)
		document.body.classList.add("is-menu-open")
		return () => {
			document.removeEventListener("keydown", onKey)
			document.body.classList.remove("is-menu-open")
		}
	}, [menuOpen])
	// 작업 추적기(SCRUM-365) — 화면을 옮겨도 내가 시작한 작업을 지켜봐요. 알림 종도 여기서 읽어요.
	return (
		<JobsProvider loginId={loginId} kinds={jobKinds}>
			<a className="skip-link" href="#main-content">
				본문으로 건너뛰기
			</a>
			<div className={`app-shell${!signedIn ? " is-signed-out" : ""}`}>
				{signedIn && (
					<header className="app-header">
						{/* 로고 — 위 띠 왼쪽, 사이드바와 같은 폭의 칸(SCRUM-408). 사이드바는 늘 펼쳐 둬요. */}
						<div className="app-header-brand">
							{/* 햄버거 — 좁은 화면에서만 보여요. 넓은 화면은 사이드바가 늘 펼쳐져 있어요. */}
							<button
								ref={menuButton}
								type="button"
								className="app-menu-toggle"
								aria-label="메뉴 열기"
								aria-expanded={menuOpen}
								aria-controls="app-sidebar"
								onClick={() => setMenuOpen(true)}
							>
								<Icon name="menu" size={22} />
							</button>
							<Link
								className="app-brand"
								to="/overview"
								aria-label="DAJAVA 업무 대시보드"
							>
								<img className="app-brand-mark" src={brandMark} alt="" />
								<div aria-hidden="true">DAJAVA</div>
							</Link>
						</div>
						{/* 지금 메뉴 이름은 사이드바 선택 칸으로 보여서 위 띠에는 쓰지 않아요(SCRUM-410). 빈 칸은 오른쪽 도구를 밀어 두는 자리예요. */}
						<div className="app-header-context" />
						<div className="head-utils" ref={headUtils}>
							{/* 업무 알림 종(SCRUM-334) — 계정이 바뀌면 본 시각·숫자를 처음부터 */}
							{loginId && <NotificationBell key={loginId} loginId={loginId} />}
							<AuthPanel placement="header" />
							{/* 예전 "시연 도구" 자리(SCRUM-428). 시연 화면·연동 확인은 주소(/demo/overview, /dev/connection)로 열어요. */}
							<button
								type="button"
								className="guide-open"
								aria-label="사용 안내"
								onClick={() => setGuideOpen(true)}
							>
								<Icon name="help" size={16} />
								<span className="guide-open-label">사용 안내</span>
							</button>
						</div>
					</header>
				)}
				{signedIn && guideOpen && <TutorialDialog onClose={() => setGuideOpen(false)} />}
				{signedIn && (
					<aside
						id="app-sidebar"
						className={`app-sidebar${menuOpen ? " is-open" : ""}`}
						aria-label="업무 공간"
					>
						{/* 서랍 머리 — 좁은 화면에서만: 로고 + 닫기 */}
						<div className="sidebar-drawer-head">
							<span className="app-brand" aria-hidden="true">
								<img className="app-brand-mark" src={brandMark} alt="" />
								<div>DAJAVA</div>
							</span>
							<button
								type="button"
								className="app-menu-toggle"
								aria-label="메뉴 닫기"
								onClick={() => {
									setMenuOpen(false)
									menuButton.current?.focus()
								}}
							>
								<Icon name="close" size={20} />
							</button>
						</div>
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
						<p className="sidebar-note">
							<strong>AML 조사 워크스페이스</strong>
							거래 근거부터 조사 메모까지
						</p>
					</aside>
				)}
				{signedIn && menuOpen && (
					<div
						className="app-menu-backdrop"
						aria-hidden="true"
						onClick={() => setMenuOpen(false)}
					/>
				)}
				<div className="app-workspace">
					<main
						id="main-content"
						className={`app-main${signedIn ? "" : " is-signed-out"}`}
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
		</JobsProvider>
	)
}
