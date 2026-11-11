import { Link, useLocation, useParams } from "react-router"
import "../styles/cases.css"
import { useCaseDetail } from "../hooks/useCases"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatDataTime, formatSystemTime } from "../../../shared/format/time"
import CaseActions from "../components/CaseActions"
import CaseEvidenceCard from "../components/CaseEvidenceCard"
import CaseNotesCard from "../components/CaseNotesCard"
import {
	CLOSE_REASON_LABELS,
	REJECTION_LABELS,
	SCORE_STATUS_LABELS,
	STATUS_LABELS,
	labelOf,
} from "../labels"

// 케이스 상세 — 계약서 C2 `GET /cases/{case_no}`. 열람 기록은 서버가 남겨요.
// 배치(화면 설계 CASE-02): 점수 카드 + 연결 경보 → 거래 근거(합계 + 근거·참고·자금 흐름 탭, 전체 폭 —
// 표가 가로로 잘리지 않게) → 그 아래 메모·AI 요약·상태 이력 탭 + 다음 작업. 좁은 화면에선 한 줄로 쌓여요.

// 맨 위 score·scoreBand는 계약서 Q2 MVP대로 latest_score와 같은 값이에요(#78 리뷰). 혹시 비면 latest_score로.
// 모델 점수라 범죄 확률이 아니에요. 등급은 서버 값(HIGH·MEDIUM·LOW) 그대로 — 정책이 없으면 등급 없이 점수만.
function ScoreBlock({ detail }) {
	const latest = detail.latestScore
	const score = detail.score ?? latest?.score ?? null
	const band = detail.scoreBand ?? latest?.scoreBand ?? null
	let status = null
	if (score == null) {
		const label = latest ? labelOf(SCORE_STATUS_LABELS, latest.scoreStatus) : "산출 정보 없음"
		status = latest?.failureCode ? `${label} (${latest.failureCode})` : label
	}
	return (
		<div className="case-score">
			<p className="case-score-label">조사 우선순위 점수</p>
			{score != null ? (
				<p className="case-score-value">
					<strong>{score}</strong>
					{band && <span className="case-status">등급 {band}</span>}
				</p>
			) : (
				<p className="case-score-status">{status}</p>
			)}
			{score != null && (
				<p className="case-action-note">
					범죄 확률 아님{latest?.modelVersion && ` · 모델 ${latest.modelVersion}`}
				</p>
			)}
		</div>
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
					<div className="case-detail-top">
						<section className="case-panel case-summary" aria-label="케이스 정보">
							<ScoreBlock detail={detail} />
							<dl>
								<dt>계좌</dt>
								<dd>{detail.accountNo}</dd>
								<dt>생성</dt>
								<dd>{formatSystemTime(detail.createdAt)}</dd>
								{detail.rejectionReasonCode && (
									<>
										<dt>반려</dt>
										<dd>
											{labelOf(REJECTION_LABELS, detail.rejectionReasonCode)}
										</dd>
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
					</div>
					<div className="case-detail-grid">
						<CaseEvidenceCard detail={detail} />
						<div className="case-detail-aside">
							<CaseNotesCard detail={detail} onRefresh={() => query.refetch()} />
							<CaseActions detail={detail} />
							{detail.currentDraftNo && (
								<Link
									className="case-str-link"
									to={`/cases/${encodeURIComponent(detail.caseNo)}/str`}
								>
									STR 화면으로 이동 →
								</Link>
							)}
						</div>
					</div>
				</>
			)}
		</>
	)
}
