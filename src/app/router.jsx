import { lazy, Suspense } from "react"
import { Link, Navigate, Route, Routes } from "react-router"
import AppLayout from "./layouts/AppLayout"
import CaseListPage from "../features/cases/pages/CaseListPage"
import CaseDetailPage from "../features/cases/pages/CaseDetailPage"
import StrPage from "../features/str/pages/StrPage"

// 전체 시연 묶음은 개발 모드에서만 불러옵니다. 운영 빌드에는 fixture를 포함하지 않습니다.
const DashboardDemoRouter = import.meta.env.DEV
	? lazy(() => import("./routes/DashboardDemoRouter"))
	: null

export default function AppRouter() {
	return (
		<Routes>
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
				<Route index element={<Navigate to="/cases" replace />} />
				<Route path="cases" element={<CaseListPage />} />
				<Route path="cases/:caseId" element={<CaseDetailPage />} />
				<Route path="cases/:caseId/str" element={<StrPage />} />
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
