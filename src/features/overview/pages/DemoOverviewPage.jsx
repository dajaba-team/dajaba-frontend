import "../styles/dashboard-demo.css"
import DashboardView from "../components/DashboardView"
import Badge from "../../../shared/ui/dashboard/Badge.jsx"
import { statusKo } from "../../../shared/demo/labels.js"
import Icon from "../../../shared/ui/dashboard/Icon.jsx"
import { useDashboardDemo } from "../../../shared/demo/useDashboardDemo.js"
export default function Overview() {
	const { db, go, dark } = useDashboardDemo()
	const item = db.cases[0]
	const items = db.cases.map((c) => ({
		caseNo: c.case_no,
		status: c.status,
		accountNo: c.masked_account_no ?? null,
		assignee: c.assignee_id ? { displayName: c.assignee_id } : null,
		score: c.latest_score ?? null,
		scoreBand: c.score_band ?? null,
	}))

	return (
		<main className="page">
			<DashboardView
				items={items}
				total={items.length}
				description="거래 탐지부터 조사, STR 보고까지. 하나로 연결되는 AML 워크스페이스."
				onStart={() => go("cases")}
				demo
				dark={dark}
				listPath="/demo/cases"
				casePath={(n) => `/demo/cases/${encodeURIComponent(n)}`}
			/>
			<section className="panel pipeline-card">
				<div className="section-head">
					<div>
						<h2>업무 파이프라인</h2>
						<p>현재 케이스 상태와 역할별 다음 작업</p>
					</div>
					<Badge tone="blue">{statusKo[item.status]}</Badge>
				</div>
				<div className="pipeline">
					{[
						["SOURCE", "원천 적재", "batches"],
						["DETECTION", "룰·AI 점수", "alerts"],
						["CASES", statusKo[item.status], "cases"],
						["STR", item.current_draft_id ? "초안 있음" : "초안 전", "str"],
						[
							"APPROVAL",
							item.status === "APPROVED" ? "승인 완료" : "결정 전",
							"approvals",
						],
					].map(([code, label, target], index) => (
						<div className="pipeline-step" key={code}>
							<span>{index + 1}</span>
							<div>
								<code>{code}</code>
								<strong>{label}</strong>
							</div>
							<button onClick={() => go(target)} aria-label={`${label} 화면 이동`}>
								<Icon name="arrow" size={15} />
							</button>
						</div>
					))}
				</div>
			</section>
			<div className="two-col">
				<section className="panel">
					<div className="section-head">
						<div>
							<h2>데이터 범위</h2>
							<p>IBM AML HI-Small 기반 합성 거래 데이터</p>
						</div>
						<Badge tone="purple">합성 데이터</Badge>
					</div>
					<div className="info-list">
						<div>
							<span>전체 원천 데이터 기간</span>
							<strong>2022-09-01 ~ 2022-09-18</strong>
						</div>
						<div>
							<span>MVP 분석 대상</span>
							<strong>2022-09-01 ~ 2022-09-10</strong>
						</div>
						<div>
							<span>날짜 기준 분할</span>
							<strong>
								9/1~6 · 9/7~8 · 9/9~10 <Badge tone="amber">실험 설정 예시</Badge>
							</strong>
						</div>
						<div>
							<span>KYC 보강</span>
							<strong>
								직업·업종·위험등급·거래목적 <Badge>합성 보강 속성</Badge>
							</strong>
						</div>
					</div>
				</section>
				<section className="panel">
					<div className="section-head">
						<div>
							<h2>현재 업무 맥락</h2>
							<p>기술 식별자와 상태를 원문 그대로 표시</p>
						</div>
					</div>
					<div className="info-list">
						<div>
							<span>대표 케이스</span>
							<strong className="mono">CASE-2022-000057</strong>
						</div>
						<div>
							<span>연결 경보</span>
							<strong className="mono">ALT-20220902-000142</strong>
						</div>
						<div>
							<span>담당자</span>
							<strong>{item.assignee_id ?? "미배정"}</strong>
						</div>
						<div>
							<span>고객·법인 정보</span>
							<strong>미확인 · 원천에 없는 이름 생성 안 함</strong>
						</div>
					</div>
				</section>
			</div>
		</main>
	)
}
