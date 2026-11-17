import { lazy, Suspense } from "react"
import { Link, Navigate, Route, Routes } from "react-router"
import AppLayout from "./layouts/AppLayout"
import RequireRole from "./routes/RequireRole"
import CaseListPage from "../features/cases/pages/CaseListPage"
import CaseDetailPage from "../features/cases/pages/CaseDetailPage"
import StrPage from "../features/str/pages/StrPage"
import AdminAccountsPage from "../features/admin/users/pages/AdminAccountsPage"
import AdminAuditPage from "../features/audit/pages/AdminAuditPage"
import AdminBatchesPage from "../features/admin/batches/pages/AdminBatchesPage"
import ApprovalListPage from "../features/approvals/pages/ApprovalListPage"
import ApprovalDonePage from "../features/approvals/pages/ApprovalDonePage"
import { useSession } from "../features/auth/hooks/useSession"
const OverviewPage = lazy(() => import("../features/overview/pages/OverviewPage"))

// 전체 시연 묶음은 개발 모드에서만 불러옵니다. 운영 빌드에는 fixture를 포함하지 않습니다.
const DashboardDemoRouter = import.meta.env.DEV
	? lazy(() => import("./routes/DashboardDemoRouter"))
	: null
// 백엔드 연동 확인도 개발 모드 전용입니다. 로그인 전에도 열 수 있게 AppLayout 밖에 둡니다.
const ConnectionCheckPage = import.meta.env.DEV
	? lazy(() => import("../features/connection/pages/ConnectionCheckPage"))
	: null
// The dashboard keeps the current URL through login. Role-specific work starts inside it.
function HomeRedirect() {
	const session = useSession()
	if (session.isPending) return <p role="status">로그인 상태 확인 중…</p>
	return <Navigate to="/overview" replace />
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
				<Route
					path="overview"
					element={
						<Suspense fallback={<p role="status">대시보드를 불러오는 중…</p>}>
							<OverviewPage />
						</Suspense>
					}
				/>
				<Route path="cases" element={<CaseListPage />} />
				<Route path="cases/:caseNo" element={<CaseDetailPage />} />
				<Route path="cases/:caseNo/str" element={<StrPage />} />
				<Route element={<RequireRole roles={["ADMIN"]} />}>
					<Route path="admin/accounts" element={<AdminAccountsPage />} />
					<Route path="admin/audit" element={<AdminAuditPage />} />
					{/* 데이터·배치 운영(ADM-01) — 화면 틀 SCRUM-220, 케이스 생성 카드 SCRUM-180 */}
					<Route path="admin/batches" element={<AdminBatchesPage />} />
					<Route path="admin/*" element={<NotYetPage />} />
				</Route>
				<Route element={<RequireRole roles={["APPROVER", "ADMIN"]} />}>
					{/* 승인함(APR-01) — 목록·승인·반려 SCRUM-241. 승인 완료·모의 제출 화면 SCRUM-111 */}
					<Route path="approvals" element={<ApprovalListPage />} />
					<Route path="approvals/:draftNo" element={<ApprovalDonePage />} />
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
