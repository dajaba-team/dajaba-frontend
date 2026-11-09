import { lazy, Suspense } from "react"
import { Link, Navigate, Route, Routes } from "react-router"
import AppLayout from "./layouts/AppLayout"
import RequireRole from "./routes/RequireRole"
import CaseListPage from "../features/cases/pages/CaseListPage"
import CaseDetailPage from "../features/cases/pages/CaseDetailPage"
import StrPage from "../features/str/pages/StrPage"
import { useSession } from "../features/auth/hooks/useSession"
import { homePathFor } from "./navigation/appNavigation"

// 전체 시연 묶음은 개발 모드에서만 불러옵니다. 운영 빌드에는 fixture를 포함하지 않습니다.
const DashboardDemoRouter = import.meta.env.DEV
	? lazy(() => import("./routes/DashboardDemoRouter"))
	: null
// 백엔드 연동 확인도 개발 모드 전용입니다. 로그인 전에도 열 수 있게 AppLayout 밖에 둡니다.
const ConnectionCheckPage = import.meta.env.DEV
	? lazy(() => import("../features/connection/pages/ConnectionCheckPage"))
	: null
// 로그인 안 된 상태에서 /로 들어오면 develop 동작을 그대로 — DEV는 연동 확인, 운영은 /cases.
const UNAUTH_HOME = import.meta.env.DEV ? "/dev/connection" : "/cases"

// 로그인 뒤 /는 COM-01 역할별 첫 진입. 아직 ready:false인 메뉴면 그 역할의 첫 ready 메뉴로.
// 세션 확인 전에는 리디렉션하지 않고 안내만 보여 줍니다(로그인/비로그인 선택을 세션 결과로 미룸).
function HomeRedirect() {
	const session = useSession()
	if (session.isPending) return <p role="status">로그인 상태 확인 중…</p>
	if (session.data) return <Navigate to={homePathFor(session.data.role)} replace />
	return <Navigate to={UNAUTH_HOME} replace />
}

// 404 자리(아직 화면 없음) — RequireRole로 감싼 경로에서 admin/approver가 열면 보입니다.
function NotYetPage() {
	return (
		<section className="page">
			<h1>페이지를 찾을 수 없습니다.</h1>
			<Link to="/cases">목록으로 이동</Link>
		</section>
	)
}

export default function AppRouter() {
	return (
		<Routes>
			<Route index element={<HomeRedirect />} />
			{ConnectionCheckPage && (
				<Route
					path="dev/connection"
					element={
						<Suspense fallback={<p role="status">연동 확인 화면을 불러오는 중…</p>}>
							<ConnectionCheckPage />
						</Suspense>
					}
				/>
			)}
			{DashboardDemoRouter && (
				<Route
					path="demo/*"
					element={
						<Suspense fallback={<p role="status">대시보드를 불러오는 중…</p>}>
							<DashboardDemoRouter />
						</Suspense>
					}
				/>
			)}
			<Route element={<AppLayout />}>
				<Route path="cases" element={<CaseListPage />} />
				<Route path="cases/:caseNo" element={<CaseDetailPage />} />
				<Route path="cases/:caseNo/str" element={<StrPage />} />
				<Route element={<RequireRole roles={["ADMIN"]} />}>
					<Route path="admin/*" element={<NotYetPage />} />
				</Route>
				<Route element={<RequireRole roles={["APPROVER", "ADMIN"]} />}>
					<Route path="approvals/*" element={<NotYetPage />} />
				</Route>
				<Route
					path="*"
					element={
						<>
							<h1>페이지를 찾을 수 없습니다.</h1>
							<Link to="/cases">목록으로 이동</Link>
						</>
					}
				/>
			</Route>
		</Routes>
	)
}
