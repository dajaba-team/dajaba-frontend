import { Link, Outlet } from "react-router"
import { useSession } from "../../features/auth/hooks/useSession"

// 라우트 가드. 역할이 맞지 않으면 리디렉션하지 않고 "권한이 없어요"를 그 자리에 보여 줘요.
// 로그인 전 상태는 AppLayout이 outlet을 안 그리기 때문에 여기까지 오지 않습니다.
export default function RequireRole({ roles }) {
	const session = useSession()
	if (!session.data || !roles.includes(session.data.role)) {
		return (
			<section className="page">
				<h1>권한이 없어요</h1>
				<p>이 화면은 접근 권한이 있는 역할만 볼 수 있어요.</p>
				<Link to="/cases">조사 케이스로 이동</Link>
			</section>
		)
	}
	return <Outlet />
}
