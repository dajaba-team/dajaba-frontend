import "../styles/dashboard-demo.css"
import { useState } from "react"
import PageHeading from "../../../shared/ui/dashboard/PageHeading.jsx"
import Icon from "../../../shared/ui/dashboard/Icon.jsx"
import Empty from "../../../shared/ui/dashboard/Empty.jsx"
import { useDashboardDemo } from "../../../shared/demo/useDashboardDemo.js"
import { formatSystemTime } from "../../../shared/format/time"
export default function Audit() {
	const { db } = useDashboardDemo()
	const [tab, setTab] = useState("CASE")
	const tabs = [
		["CASE", "케이스 상태 이력"],
		["NOTE", "조사 메모 변경 이력"],
		["STR", "STR 본문 수정 이력"],
		["DECISION", "승인·반려 기록"],
		["ACCESS", "열람 로그"],
	]
	const items = db.histories.filter((item) => item.category === tab)
	return (
		<main className="page">
			<PageHeading
				title="감사 기록"
				description="업무 변경 이력과 열람 로그를 분리한 읽기 전용 데모 화면입니다."
			/>
			<div className="callout warning">
				<Icon name="warning" />
				<span>
					<strong>Mock 화면</strong>통합 감사 조회 API 경로가 제공되지 않아 가상의 운영
					API를 만들지 않았습니다.
				</span>
			</div>
			<section className="panel audit-panel">
				<div className="tabs">
					{tabs.map(([id, label]) => (
						<button
							className={tab === id ? "active" : ""}
							onClick={() => setTab(id)}
							key={id}
						>
							{label}
						</button>
					))}
				</div>
				{items.length ? (
					<div className="audit-list">
						{items.map((item) => (
							<div key={item.id}>
								<span className="audit-icon">
									<Icon
										name={item.category === "DECISION" ? "approval" : "audit"}
									/>
								</span>
								<p>
									<strong>{item.title}</strong>
									<span>{item.detail}</span>
									<small>
										{item.actor} · {formatSystemTime(item.occurred_at)}
									</small>
								</p>
							</div>
						))}
					</div>
				) : (
					<Empty
						title="표시할 기록 없음"
						text={
							tab === "ACCESS"
								? "열람 로그는 별도 mock 데이터 계약이 필요합니다."
								: "해당 업무를 실행하면 이력이 연결됩니다."
						}
					/>
				)}
			</section>
		</main>
	)
}
