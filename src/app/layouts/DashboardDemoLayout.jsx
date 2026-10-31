import "../styles/dashboard-demo.css"
import { Outlet } from "react-router"
import { useDashboardDemo } from "../../shared/demo/useDashboardDemo"
import Sidebar from "./dashboard/DemoSidebar"
import Topbar from "./dashboard/DemoTopbar"
import DemoPanel from "../../mocks/dashboard/components/DemoPanel"
import Icon from "../../shared/ui/dashboard/Icon"
import "../../shared/styles/dashboard-demo.css"

export default function DashboardDemoLayout() {
	const { dark, role, busy, toast, onScenario, scenarioVersion } = useDashboardDemo()
	return (
		<div className={`dashboard-demo ${dark ? "dark" : ""}`}>
			<a className="demo-skip-link" href="#demo-content">
				본문으로 건너뛰기
			</a>
			<Sidebar />
			<div className="main-shell">
				<Topbar />
				<div className="demo-environment-note">
					화면 시연 · 합성 데이터 · 역할 전환은 실제 로그인·권한을 변경하지 않습니다.
				</div>
				<div id="demo-content" tabIndex={-1} aria-busy={busy}>
					{/* 역할을 바꾸면 입력 컴포넌트를 재생성해 이전 역할의 임시 입력을 비웁니다. */}
					<fieldset
						className="demo-workspace"
						disabled={busy}
						key={`${role}:${scenarioVersion}`}
					>
						<Outlet />
					</fieldset>
				</div>
			</div>
			<DemoPanel onScenario={onScenario} busy={busy} />
			{busy && (
				<div className="demo-progress" role="status">
					<span className="spinner" />
					시연 데이터를 처리하고 있습니다…
				</div>
			)}
			{toast && (
				<div
					className={`toast ${toast.tone}`}
					role={toast.tone === "error" ? "alert" : "status"}
				>
					<Icon name={toast.tone === "success" ? "check" : "warning"} />
					{toast.text}
				</div>
			)}
		</div>
	)
}
