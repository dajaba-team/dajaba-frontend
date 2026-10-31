import { useSearchParams } from "react-router"
import "../styles/dashboard-demo.css"
import { useState } from "react"
import PageHeading from "../../../shared/ui/dashboard/PageHeading.jsx"
import Icon from "../../../shared/ui/dashboard/Icon.jsx"
import Badge from "../../../shared/ui/dashboard/Badge.jsx"
import Button from "../../../shared/ui/dashboard/Button.jsx"
import Modal from "../../../shared/ui/dashboard/Modal.jsx"
import { useDashboardDemo } from "../../../shared/demo/useDashboardDemo.js"
export default function Alerts() {
	const { db } = useDashboardDemo()
	const [params, setParams] = useSearchParams()
	const search = params.get("q") || ""
	const scoreStatus = params.get("score_status") || ""
	const filter = (key, value) => {
		const next = new URLSearchParams(params)
		if (value) next.set(key, value)
		else next.delete(key)
		setParams(next)
	}
	const filtered = db.alerts.filter(
		(item) =>
			(!scoreStatus || item.score_status === scoreStatus) &&
			[item.alert_no, item.account_key, item.rule_name].some((value) =>
				value.toLowerCase().includes(search.toLowerCase()),
			),
	)
	const [selected, setSelected] = useState(null)
	const alert = db.alerts.find((item) => item.alert_no === selected)
	return (
		<main className="page">
			<PageHeading
				eyebrow="ADMIN"
				title="경보 점검"
				description="목록 응답과 상세 점수 근거를 구분해 운영 경보를 확인합니다."
			/>
			<section className="panel table-card">
				<div className="toolbar">
					<div className="search-box">
						<Icon name="search" />
						<input
							aria-label="경보 검색"
							placeholder="경보 번호·계좌·룰 검색"
							value={search}
							onChange={(event) => filter("q", event.target.value)}
						/>
					</div>
					<div className="filter-row">
						<label>
							점수 상태{" "}
							<select
								value={scoreStatus}
								onChange={(event) => filter("score_status", event.target.value)}
							>
								<option value="">전체</option>
								{["SCORED", "FAILED", "PENDING"].map((value) => (
									<option key={value}>{value}</option>
								))}
							</select>
						</label>
						<span>{filtered.length}건</span>
					</div>
				</div>
				<div className="table-scroll">
					<table>
						<thead>
							<tr>
								<th>경보 번호</th>
								<th>계좌</th>
								<th>탐지 룰 / 버전</th>
								<th>유형 힌트</th>
								<th>근거 수</th>
								<th>점수 상태</th>
								<th>환산 모델 점수</th>
								<th>등급</th>
								<th>케이스</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{!filtered.length && (
								<tr>
									<td colSpan={10}>조건에 맞는 경보가 없습니다.</td>
								</tr>
							)}
							{filtered.map((item) => (
								<tr key={item.alert_no}>
									<td className="mono link">{item.alert_no}</td>
									<td>
										<strong className="mono">{item.account_key}</strong>
										<small>{item.masked_account_no}</small>
									</td>
									<td>
										{item.rule_name}
										<small>
											{item.rule_id} · v{item.rule_version}
										</small>
									</td>
									<td>{item.typology_hint}</td>
									<td>{item.evidence_transaction_count}</td>
									<td>
										<Badge
											tone={item.score_status === "FAILED" ? "red" : "green"}
										>
											{item.score_status}
										</Badge>
									</td>
									<td>
										{item.score == null
											? "산출 실패"
											: `${Math.round(item.score * 100)} / 100`}
									</td>
									<td>{item.score_band ?? "미산정"}</td>
									<td>{item.case_opened ? "생성됨" : "미생성"}</td>
									<td>
										<Button
											variant="secondary"
											onClick={() => setSelected(item.alert_no)}
										>
											상세 보기
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
			{alert && (
				<Modal title={`경보 상세 · ${alert.alert_no}`} onClose={() => setSelected(null)}>
					<div className="drawer-grid">
						<div className="info-list">
							<div>
								<span>탐지 시간 창</span>
								<strong>2022-09-02 08:00:00 ~ 2022-09-03 08:00:00</strong>
							</div>
							<div>
								<span>reference_ts</span>
								<strong className="mono">2022-09-03 08:00:00</strong>
							</div>
							<div>
								<span>모델 / 피처</span>
								<strong>
									{alert.model_version} / {alert.feature_version}
								</strong>
							</div>
							<div>
								<span>prediction_id</span>
								<strong className="mono">{alert.prediction_id ?? "없음"}</strong>
							</div>
						</div>
						<h3>rule_facts</h3>
						<pre>
							{JSON.stringify(
								{
									inbound_accounts: 31,
									inbound_total: {
										amount: 320482,
										currency: "USD",
									},
									outflow_ratio_2h: 0.965,
								},
								null,
								2,
							)}
						</pre>
						<h3>SHAP reasons · 상세 응답</h3>
						{alert.score_status === "FAILED" ? (
							<div className="callout danger">
								<Icon name="warning" />
								점수 서비스 실패로 reasons가 없습니다. 저위험으로 해석하지 마세요.
							</div>
						) : (
							alert.reasons.map((reason) => (
								<div className="reason-row" key={reason.feature}>
									<code>{reason.feature}</code>
									<span>{reason.value}</span>
									<strong>
										{reason.contribution > 0 ? "+" : ""}
										{reason.contribution}
									</strong>
								</div>
							))
						)}
					</div>
				</Modal>
			)}
		</main>
	)
}
