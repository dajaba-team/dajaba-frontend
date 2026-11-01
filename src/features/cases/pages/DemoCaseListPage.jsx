import { useSearchParams } from "react-router"
import Empty from "../../../shared/ui/dashboard/Empty"
import PageHeading from "../../../shared/ui/dashboard/PageHeading.jsx"
import Badge from "../../../shared/ui/dashboard/Badge.jsx"
import { statusKo } from "../../../shared/demo/labels.js"
import Button from "../../../shared/ui/dashboard/Button.jsx"
import { useDashboardDemo } from "../../../shared/demo/useDashboardDemo.js"
export default function Cases() {
	const { db, role, assignCase: assign, openCase: open } = useDashboardDemo()
	const item = db.cases[0]
	const [params, setParams] = useSearchParams()
	const status = params.get("status") || ""
	const owner = params.get("owner") || ""
	const visible =
		(!status || item.status === status) && (owner !== "mine" || item.assignee_id === "inv01")
	const filter = (key, value) => {
		const next = new URLSearchParams(params)
		if (value) next.set(key, value)
		else next.delete(key)
		setParams(next)
	}
	return (
		<main className="page">
			<PageHeading
				title="조사 케이스"
				description="상태·담당자·케이스 생성일 기준으로 조사 업무를 시작합니다."
			/>
			<section className="panel table-card">
				<div className="toolbar">
					<div className="filter-row">
						<label>
							케이스 상태{" "}
							<select
								value={status}
								onChange={(event) => filter("status", event.target.value)}
							>
								<option value="">전체</option>
								{Object.entries(statusKo)
									.filter(
										([code]) =>
											!["SUCCEEDED", "FAILED", "RUNNING", "IDLE"].includes(
												code,
											),
									)
									.map(([code, label]) => (
										<option key={code} value={code}>
											{label}
										</option>
									))}
							</select>
						</label>
						<label>
							담당자{" "}
							<select
								value={owner}
								onChange={(event) => filter("owner", event.target.value)}
							>
								<option value="">전체</option>
								<option value="mine">조사역 A 담당</option>
							</select>
						</label>
					</div>
				</div>
				{!visible ? (
					<Empty
						title="조건에 맞는 케이스가 없습니다"
						text="필터를 바꿔 다시 확인하세요."
					/>
				) : (
					<div className="table-scroll">
						<table>
							<thead>
								<tr>
									<th>케이스 번호</th>
									<th>상태</th>
									<th>계좌</th>
									<th>법인 정보</th>
									<th>담당 조사역</th>
									<th>최신 모델 점수 / 등급</th>
									<th>케이스 생성일</th>
									<th />
								</tr>
							</thead>
							<tbody>
								<tr className="selected-row">
									<td className="mono link">{item.case_no}</td>
									<td>
										<Badge
											tone={
												item.status === "REJECTED"
													? "amber"
													: item.status === "APPROVED"
														? "green"
														: "blue"
											}
										>
											{statusKo[item.status]}
										</Badge>
									</td>
									<td className="mono">{item.masked_account_no}</td>
									<td>미확인</td>
									<td>{item.assignee_id ?? "미배정"}</td>
									<td>
										{item.latest_score} / {item.score_band}
									</td>
									<td>
										{item.created_at}
										<small>거래 발생일과 구분</small>
									</td>
									<td>
										<div className="row-actions">
											{role === "INVESTIGATOR" && item.status === "OPEN" && (
												<Button onClick={assign}>내게 배정</Button>
											)}
											<Button variant="secondary" onClick={open}>
												상세 보기
											</Button>
										</div>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				)}
			</section>
		</main>
	)
}
