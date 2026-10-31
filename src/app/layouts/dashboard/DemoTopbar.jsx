import Badge from "../../../shared/ui/dashboard/Badge"
import Icon from "../../../shared/ui/dashboard/Icon"
import { useDashboardDemo } from "../../../shared/demo/useDashboardDemo"

export default function DemoTopbar() {
	const { role, changeRole, dark, setDark, user, busy } = useDashboardDemo()
	return (
		<header className="topbar">
			<div className="demo-role">
				<Badge tone="purple">데모 전용</Badge>
				<label htmlFor="demo-role">역할 전환</label>
				<select
					id="demo-role"
					value={role}
					disabled={busy}
					onChange={(event) => changeRole(event.target.value)}
				>
					<option value="ADMIN">admin01 · 운영 관리자</option>
					<option value="INVESTIGATOR">inv01 · 조사역 A</option>
					<option value="APPROVER">apr01 · 승인 책임자</option>
				</select>
			</div>
			<div className="top-actions">
				<span className="review-date">분석 예시: 2022. 9. 1.–9. 10.</span>
				<button
					className="icon-button"
					onClick={() => setDark(!dark)}
					aria-label="화면 모드 전환"
					aria-pressed={dark}
				>
					<Icon name={dark ? "sun" : "moon"} />
				</button>
				<div className="user-chip">
					<span>{user.user_id}</span>
					<strong>{user.name}</strong>
				</div>
			</div>
		</header>
	)
}
