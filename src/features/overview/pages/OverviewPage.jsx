import { useNavigate } from "react-router"
import { useOverviewCases } from "../hooks/useOverviewCases"
import { useSession } from "../../auth/hooks/useSession"
import { AsyncState } from "../../../shared/ui/AsyncState"
import DashboardView from "../components/DashboardView"
import RoleHero from "../components/RoleHero"
import { homePathFor } from "../../../app/navigation/appNavigation"
export default function OverviewPage() {
	const query = useOverviewCases()
	const { data: session } = useSession()
	const navigate = useNavigate()
	return (
		<>
			<AsyncState query={query} />
			{query.data && !query.isError && (
				<DashboardView
					items={query.data.items}
					total={query.data.total}
					description={`${session?.displayName ?? ""}님, 오늘의 조사 흐름을 한눈에 확인하세요.`}
					onStart={() => navigate(homePathFor(session?.role))}
					hero={<RoleHero role={session?.role} />}
					onRefresh={() => query.refetch()}
					refreshing={query.isFetching}
					updatedAt={query.dataUpdatedAt}
				/>
			)}
		</>
	)
}
