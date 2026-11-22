import { Link } from "react-router"
import { formatDataTime } from "../../../shared/format/time"
import { formatScore } from "../../../shared/format/score"
import { SCORE_STATUS_LABELS, labelOf } from "../labels"

// "이전 경보" — 상세 prior_alerts (계약서 C2, BE SCRUM-239 FindAlertsByEntity).
// 같은 법인에서 이 경보보다 앞선 경보, 최근 것부터 서버가 최대 PRIOR_ALERTS_LIMIT 건만 줘요(BE GetCaseDetail 과 같은 값).
// 더 앞선 경보는 AI 요청의 앞선 경보 수(prior_alert_count)에만 들어가서, 제목에 상한을 적어 헷갈리지 않게 해요(#172 리뷰).
// 법인을 모르는 케이스는 서버가 [] 를 줘요 — 계좌로 이어 붙이지 않아요. 계좌는 서버가 가린 값 그대로.
export const PRIOR_ALERTS_LIMIT = 20

function scoreText(alert) {
	if (alert.score != null) return formatScore(alert.score)
	return labelOf(SCORE_STATUS_LABELS, alert.scoreStatus)
}

export default function CasePriorAlerts({ priorAlerts }) {
	const items = priorAlerts ?? []
	return (
		<section className="case-panel case-summary" aria-labelledby="prior-alerts-title">
			<h2 id="prior-alerts-title">이전 경보 · 최근 {PRIOR_ALERTS_LIMIT}건</h2>
			<p className="case-action-note">
				같은 법인에서 이 경보보다 먼저 난 경보예요. 최근 {PRIOR_ALERTS_LIMIT}건까지만
				보여요.
			</p>
			{items.length ? (
				<div className="case-table-scroll" tabIndex={0} aria-label="이전 경보 표">
					<table className="case-table prior-alerts-table">
						<thead>
							<tr>
								<th scope="col">경보 · 탐지 규칙</th>
								<th scope="col">기준 시각</th>
								<th scope="col">계좌</th>
								<th scope="col">점수</th>
								<th scope="col">케이스</th>
							</tr>
						</thead>
						<tbody>
							{items.map((alert) => (
								<tr key={alert.alertNo}>
									<td>
										{alert.alertNo}
										<small className="prior-alert-rule">{alert.ruleId}</small>
									</td>
									<td>{formatDataTime(alert.referenceTs)}</td>
									<td>{alert.accountNo}</td>
									<td>{scoreText(alert)}</td>
									<td>
										{alert.caseNo ? (
											<Link to={`/cases/${encodeURIComponent(alert.caseNo)}`}>
												{alert.caseNo}
											</Link>
										) : (
											"없음"
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<p>같은 법인의 이전 경보가 없습니다.</p>
			)}
		</section>
	)
}
