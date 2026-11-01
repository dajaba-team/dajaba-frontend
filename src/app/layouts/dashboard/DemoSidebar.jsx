import { Link, useLocation } from "react-router"
import { demoNavigation, demoPath, demoView } from "../../navigation/demoNavigation"
import { useDashboardDemo } from "../../../shared/demo/useDashboardDemo"
import { roleKo } from "../../../shared/demo/labels"
import Icon from "../../../shared/ui/dashboard/Icon"

export default function DemoSidebar() {
	const { role, db } = useDashboardDemo()
	const { pathname } = useLocation()
	const view = demoView(pathname)
	return (
		<aside className="sidebar">
			<Link className="brand" to="/demo/overview">
				<div className="brand-mark" aria-hidden="true">
					<span />
					<span />
					<span />
				</div>
				<div>
					<strong>DAJABA</strong>
					<small>AML 인텔리전스</small>
				</div>
			</Link>
			<nav className="nav" aria-label="대시보드 시연 메뉴">
				<p className="nav-label">업무 공간</p>
				{demoNavigation.map((item) => {
					const denied = item.role && item.role !== role
					const content = (
						<>
							<Icon name={item.icon} />
							<span>{item.label}</span>
							{denied && <em>제한</em>}
						</>
					)
					return denied ? (
						<span
							key={item.id}
							className="nav-item is-disabled"
							aria-disabled="true"
							title={`${roleKo[item.role]} 전용 메뉴`}
						>
							{content}
						</span>
					) : (
						<Link
							key={item.id}
							className={`nav-item ${view === item.id ? "active" : ""}`}
							aria-current={view === item.id ? "page" : undefined}
							to={demoPath(item.id, db.cases[0]?.case_no)}
						>
							{content}
						</Link>
					)
				})}
			</nav>
			<div className="sidebar-footer">
				<strong>합성 데이터 시연</strong>
				<p>실제 업무 API와 분리되어 있습니다.</p>
				<Link to="/cases">기존 조사 화면으로 돌아가기 →</Link>
			</div>
		</aside>
	)
}
