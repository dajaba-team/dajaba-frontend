import { Link } from "react-router"
import Icon from "../../../shared/ui/dashboard/Icon"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemTime } from "../../../shared/format/time"
import { useApprovals } from "../../approvals/hooks/useApprovals"

// 승인자 대시보드의 우선 목록 (SCRUM-336). 점수 높은 케이스 대신 승인함 P1을 그대로 보여 줘요.
// 정렬은 서버가 요청 오래된 순으로 고정해서 화면에서 다시 정렬하지 않아요. 승인함 첫 페이지와 같은 캐시를 써요.
const SHOWN = 3

export default function PendingApprovalsPanel() {
	const query = useApprovals(1)
	const data = query.data
	return (
		<section className="analytics-panel focus-panel" aria-labelledby="pending-approvals-title">
			<div className="analytics-head">
				<div>
					<h2 id="pending-approvals-title">검토를 기다리는 보고서</h2>
					<p>요청이 오래된 보고서부터 보여 줘요. 초안을 열어 승인하거나 반려해 주세요.</p>
				</div>
				<Link className="text-link" to="/approvals">
					승인함 전체{data ? ` ${data.total}건` : ""} <Icon name="arrow" size={14} />
				</Link>
			</div>
			<AsyncState query={query} />
			{data &&
				(data.items.length ? (
					data.items.slice(0, SHOWN).map((item) => (
						<div className="focus-case" data-band="NONE" key={item.draftNo}>
							<div className="case-symbol">
								<Icon name="approval" size={22} />
							</div>
							<div className="case-identity">
								<Link to={`/cases/${encodeURIComponent(item.caseNo)}/str`}>
									{item.draftNo}
								</Link>
								<span>
									{item.caseNo} · {item.assignee?.displayName ?? "담당 없음"}
								</span>
							</div>
							<div className="case-score">
								{item.lastRejection && <em className="band-badge">재요청</em>}
								<div className="case-score-main">
									<strong>{formatSystemTime(item.submittedAt) || "-"}</strong>
									<span>승인 요청</span>
								</div>
							</div>
							<Link
								className="case-open"
								to={`/cases/${encodeURIComponent(item.caseNo)}/str`}
								aria-label={`${item.draftNo} 초안 검토하기`}
							>
								초안 검토하기 <Icon name="arrow" size={14} />
							</Link>
						</div>
					))
				) : (
					<p className="dashboard-empty">검토를 기다리는 보고서가 없습니다.</p>
				))}
		</section>
	)
}
