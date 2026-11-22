import { useNavigate } from "react-router"
import { useOverviewCases } from "../hooks/useOverviewCases"
import { useSession } from "../../auth/hooks/useSession"
import { AsyncState } from "../../../shared/ui/AsyncState"
import DashboardView from "../components/DashboardView"
import RoleHero from "../components/RoleHero"
import PendingApprovalsPanel from "../components/PendingApprovalsPanel"
import { homePathFor } from "../../../app/navigation/appNavigation"
export default function OverviewPage() {
	const { data: session } = useSession()
	// 조사역은 내 담당만 집계해요(SCRUM-337). 역할을 알기 전에는 부르지 않아요 — 전체를 한 번 셌다가 바뀌지 않게.
	const mine = session?.role === "INVESTIGATOR"
	const query = useOverviewCases({ mine, enabled: Boolean(session) })
	const navigate = useNavigate()
	return (
		<>
			<AsyncState query={query} />
			{query.data && !query.isError && (
				<DashboardView
					items={query.data.items}
					total={query.data.total}
					mine={mine}
					focusPanel={session?.role === "APPROVER" ? <PendingApprovalsPanel /> : null}
					description={`${session?.displayName ?? ""}님, 오늘의 조사 흐름을 한눈에 확인하세요.`}
					onStart={() => navigate(homePathFor(session?.role))}
					hero={<RoleHero role={session?.role} loginId={session?.loginId} />}
				/>
			)}
		</>
	)
}
