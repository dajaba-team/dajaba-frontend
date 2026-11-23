import { useNavigate } from "react-router"
import { useOverviewCases } from "../hooks/useOverviewCases"
import { useAlertStats } from "../hooks/useAlertStats"
import { useSession } from "../../auth/hooks/useSession"
import { AsyncState } from "../../../shared/ui/AsyncState"
import DashboardView from "../components/DashboardView"
import RoleHero from "../components/RoleHero"
import { homePathFor } from "../../../app/navigation/appNavigation"

// 역할별 대시보드(SCRUM-345) — 케이스는 HIGH 경보로만 만들어져 케이스 기준 "고위험 케이스"는 전체 케이스와 늘 같아서,
// 관리자는 경보 기준(BE SCRUM-360 통계, 전체 기간 누적 — 케이스 카드와 같은 누적 기준),
// 조사역·승인자는 케이스 기준(내 담당·진행 중)으로 봐요.
export default function OverviewPage() {
	const query = useOverviewCases()
	const { data: session } = useSession()
	const navigate = useNavigate()
	const admin = session?.role === "ADMIN"
	const stats = useAlertStats(admin)
	const ready = query.data && !query.isError && (!admin || (stats.data && !stats.isError))
	return (
		<>
			<AsyncState query={query} />
			{admin && query.data && <AsyncState query={stats} />}
			{ready && (
				<DashboardView
					items={query.data.items}
					total={query.data.total}
					description={`${session?.displayName ?? ""}님, 오늘의 조사 흐름을 한눈에 확인하세요.`}
					onStart={() => navigate(homePathFor(session?.role))}
					hero={<RoleHero role={session?.role} />}
					role={session?.role}
					me={session?.loginId}
					alertStats={admin ? stats.data : null}
					onRefresh={() => Promise.all([query.refetch(), admin ? stats.refetch() : null])}
					refreshing={query.isFetching || (admin && stats.isFetching)}
					updatedAt={query.dataUpdatedAt}
				/>
			)}
		</>
	)
}
