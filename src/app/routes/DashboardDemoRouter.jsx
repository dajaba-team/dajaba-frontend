import { Link, Navigate, Outlet, Route, Routes, useParams } from "react-router"
import DashboardDemoProvider from "../providers/DashboardDemoProvider"
import DashboardDemoLayout from "../layouts/DashboardDemoLayout"
import { useDashboardDemo } from "../../shared/demo/useDashboardDemo"
import Overview from "../../features/overview/pages/DemoOverviewPage"
import Batches from "../../features/admin/batches/pages/DemoBatchesPage"
import Alerts from "../../features/alerts/pages/DemoAlertsPage"
import Rules from "../../features/rules/pages/DemoRulesPage"
import Cases from "../../features/cases/pages/DemoCaseListPage"
import CaseDetail from "../../features/cases/pages/DemoCaseDetailPage"
import StrEditor from "../../features/str/pages/DemoStrPage"
import Approvals from "../../features/approvals/pages/DemoApprovalsPage"
import Evaluation from "../../features/evaluation/pages/DemoEvaluationPage"
import Audit from "../../features/audit/pages/DemoAuditPage"

function RoleBoundary({ role: requiredRole }) {
	const { role } = useDashboardDemo()
	if (role !== requiredRole)
		return (
			<section className="page">
				<h1>접근 권한이 없습니다.</h1>
				<p>이 시연 메뉴는 {requiredRole} 역할에서 사용할 수 있습니다.</p>
				<Link to="/demo/overview">업무 개요로 이동</Link>
			</section>
		)
	return <Outlet />
}
function CaseBoundary() {
	const { caseId } = useParams()
	const { db } = useDashboardDemo()
	if (!db.cases.some((item) => item.case_no === caseId))
		return (
			<section className="page">
				<h1>케이스를 찾을 수 없습니다.</h1>
				<Link to="/demo/cases">케이스 목록으로 이동</Link>
			</section>
		)
	return <Outlet key={caseId} />
}
function CurrentStrRedirect() {
	const { db } = useDashboardDemo()
	return <Navigate to={`/demo/cases/${encodeURIComponent(db.cases[0].case_no)}/str`} replace />
}
export default function DashboardDemoRouter() {
	return (
		<DashboardDemoProvider>
			<Routes>
				<Route element={<DashboardDemoLayout />}>
					<Route index element={<Navigate to="/demo/overview" replace />} />
					<Route path="overview" element={<Overview />} />
					<Route element={<RoleBoundary role="ADMIN" />}>
						<Route path="admin/batches" element={<Batches />} />
						<Route path="admin/alerts" element={<Alerts />} />
						<Route path="admin/rules" element={<Rules />} />
					</Route>
					<Route path="cases" element={<Cases />} />
					<Route path="cases/:caseId" element={<CaseBoundary />}>
						<Route index element={<CaseDetail />} />
						<Route path="str" element={<StrEditor />} />
					</Route>
					<Route path="str" element={<CurrentStrRedirect />} />
					<Route element={<RoleBoundary role="APPROVER" />}>
						<Route path="approvals" element={<Approvals />} />
					</Route>
					<Route path="evaluation" element={<Evaluation />} />
					<Route path="audit" element={<Audit />} />
					<Route
						path="*"
						element={
							<section className="page">
								<h1>페이지를 찾을 수 없습니다.</h1>
								<Link to="/demo/overview">업무 개요로 이동</Link>
							</section>
						}
					/>
				</Route>
			</Routes>
		</DashboardDemoProvider>
	)
}
