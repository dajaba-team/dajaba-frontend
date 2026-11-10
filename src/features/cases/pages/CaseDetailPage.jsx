import { Link, useLocation, useParams } from "react-router"
import "../styles/cases.css"
import { useCaseDetail } from "../hooks/useCases"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatDataTime, formatSystemTime } from "../../../shared/format/time"
import CaseMemoEditor from "../components/CaseMemoEditor"
import CaseNoteHistory from "../components/CaseNoteHistory"
import CaseAggregatesPanel from "../components/CaseAggregatesPanel"
import CaseTransactionsPanel from "../components/CaseTransactionsPanel"
import CaseFlowGraph from "../components/CaseFlowGraph"
import CaseHistoryPanel from "../components/CaseHistoryPanel"
import CaseActions from "../components/CaseActions"
import CaseSummaryPanel from "../components/CaseSummaryPanel"
import {
	CLOSE_REASON_LABELS,
	REJECTION_LABELS,
	SCORE_STATUS_LABELS,
	STATUS_LABELS,
	labelOf,
} from "../labels"

// 케이스 상세 — 계약서 C2 `GET /cases/{case_no}`. 열람 기록은 서버가 남겨요.
// 경보·최근 점수는 서버 alert·latest_score(SCRUM-152), AI 조사 요약은 latest_summary(SCRUM-175).
// 합계(aggregates)·근거 거래(C3)·그래프(C5)·이력 전체(C6)는 SCRUM-179.

// 맨 위 score·scoreBand는 계약서 Q2 MVP대로 latest_score와 같은 값이에요(#78 리뷰). 혹시 비면 latest_score로.
// 모델 점수라 범죄 확률이 아니에요. 등급은 서버 값(HIGH·MEDIUM·LOW) 그대로 — 정책이 없으면 등급 없이 점수만.
function scoreText(detail) {
	const latest = detail.latestScore
	const score = detail.score ?? latest?.score ?? null
	if (score != null) {
		const band = detail.scoreBand ?? latest?.scoreBand ?? null
		const text = [score, band && `등급 ${band}`, "범죄 확률 아님"].filter(Boolean).join(" · ")
		return latest?.modelVersion ? `${text} (모델 ${latest.modelVersion})` : text
	}
	if (!latest) return "산출 정보 없음"
	const label = labelOf(SCORE_STATUS_LABELS, latest.scoreStatus)
	return latest.failureCode ? `${label} (${latest.failureCode})` : label
}

// 메모를 고칠 수 있는 상태인데 버튼(UPDATE_NOTES)이 없으면 담당자가 아니라서예요 — 안내 문구만 고르고,
// 저장 가능 여부는 서버 available_actions 그대로예요(BE CaseStatus EDITABLE + 보완 반려).
function memoEditableStatus(detail) {
	return (
		["REVIEWING", "ESCALATED", "DRAFTED"].includes(detail.status) ||
		(detail.status === "REJECTED" && detail.rejectionReasonCode === "NEED_REVISION")
	)
}

function AlertPanel({ alert }) {
	return (
		<section className="case-panel case-summary" aria-labelledby="alert-title">
			<h2 id="alert-title">연결 경보</h2>
			{alert ? (
				<dl>
					<dt>경보 번호</dt>
					<dd>{alert.alertNo}</dd>
					<dt>탐지 규칙</dt>
					<dd>{alert.ruleId}</dd>
					<dt>배치 기준일</dt>
					<dd>{alert.batchDate}</dd>
					<dt>거래 시간 창</dt>
					<dd>
						{formatDataTime(alert.windowStart)} ~ {formatDataTime(alert.windowEnd)}
					</dd>
					<dt>묶인 거래</dt>
					<dd>{alert.transactionCount}건</dd>
				</dl>
			) : (
				<p>경보 정보 없음</p>
			)}
		</section>
	)
}

export default function CaseDetailPage() {
	const { caseNo } = useParams()
	// 목록에서 들어왔으면 그때의 필터·정렬·페이지(주소 query)로 돌아가요 (SCRUM-181)
	const fromList = useLocation().state?.listSearch
	const listSearch = typeof fromList === "string" && fromList.startsWith("?") ? fromList : ""
	const query = useCaseDetail(caseNo)
	const detail = query.data
	return (
		<>
			<Link to={`/cases${listSearch}`}>← 케이스 목록</Link>
			<AsyncState query={query} />
			{detail && (
				<>
					<header className="case-page-heading">
						<h1>{detail.caseNo}</h1>
						<p>
							<span className="case-status">
								{labelOf(STATUS_LABELS, detail.status)}
							</span>{" "}
							담당자 {detail.assignee?.displayName || "미배정"} · 버전{" "}
							{detail.version}
						</p>
					</header>
					<section className="case-panel case-summary" aria-label="케이스 정보">
						<dl>
							<dt>계좌</dt>
							<dd>{detail.accountNo}</dd>
							<dt>조사 우선순위 점수</dt>
							<dd>{scoreText(detail)}</dd>
							<dt>생성</dt>
							<dd>{formatSystemTime(detail.createdAt)}</dd>
							{detail.rejectionReasonCode && (
								<>
									<dt>반려</dt>
									<dd>{labelOf(REJECTION_LABELS, detail.rejectionReasonCode)}</dd>
								</>
							)}
							{detail.closeReason && (
								<>
									<dt>종료 사유</dt>
									<dd>{labelOf(CLOSE_REASON_LABELS, detail.closeReason)}</dd>
								</>
							)}
						</dl>
					</section>
					<AlertPanel alert={detail.alert} />
					<CaseAggregatesPanel aggregates={detail.aggregates} />
					<CaseTransactionsPanel caseNo={detail.caseNo} />
					<CaseFlowGraph caseNo={detail.caseNo} accountRef={detail.accountRef} />
					<CaseActions detail={detail} />
					<CaseSummaryPanel detail={detail} />
					{detail.availableActions.includes("UPDATE_NOTES") ? (
						<CaseMemoEditor
							key={detail.caseNo}
							detail={detail}
							onRefresh={() => query.refetch()}
						/>
					) : (
						<section>
							<h2>조사 메모</h2>
							<p className="preserve-lines">
								{detail.investigatorNotes || "메모 없음"}
							</p>
							<p>
								{memoEditableStatus(detail)
									? "담당 조사역만 메모를 수정할 수 있어요."
									: "현재 케이스는 읽기 전용입니다."}
							</p>
						</section>
					)}
					<CaseNoteHistory caseNo={detail.caseNo} />
					<CaseHistoryPanel caseNo={detail.caseNo} recent={detail.history} />
					{detail.currentDraftNo && (
						<Link to={`/cases/${encodeURIComponent(detail.caseNo)}/str`}>
							STR 화면으로 이동 →
						</Link>
					)}
				</>
			)}
		</>
	)
}
