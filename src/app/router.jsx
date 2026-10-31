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
// 백엔드 연동 확인도 개발 모드 전용입니다. 로그인 전에도 열 수 있게 AppLayout 밖에 둡니다.
const ConnectionCheckPage = import.meta.env.DEV
	? lazy(() => import("../features/connection/pages/ConnectionCheckPage"))
	: null
// 개발 중 첫 화면은 연동 확인입니다. AppLayout은 로그인 전에 하위 화면을 그리지 않으므로 이동은 밖에서 합니다.
const HOME_PATH = import.meta.env.DEV ? "/dev/connection" : "/cases"

export default function AppRouter() {
	return (
		<Routes>
			<Route index element={<Navigate to={HOME_PATH} replace />} />
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
