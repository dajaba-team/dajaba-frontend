import { useRef, useState } from "react"
import { Link, useLocation, useParams } from "react-router"
import "../styles/cases.css"
import { useCaseDetail } from "../hooks/useCases"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatDataTime, formatSystemTime } from "../../../shared/format/time"
import CaseActions from "../components/CaseActions"
import CaseEvidenceCard from "../components/CaseEvidenceCard"
import CaseNotesCard from "../components/CaseNotesCard"
import CaseQuestionPanel from "../components/CaseQuestionPanel"
import CaseScoreReasons from "../components/CaseScoreReasons"
import {
	CLOSE_REASON_LABELS,
	REJECTION_LABELS,
	SCORE_STATUS_LABELS,
	STATUS_LABELS,
	labelOf,
} from "../labels"

// 케이스 상세 — 계약서 C2 `GET /cases/{case_no}`. 열람 기록은 서버가 남겨요.
// 배치는 시연 화면(/demo/cases)과 같은 2단: 왼쪽은 점수·연결 경보 → 점수 이유 상위 3개(SCRUM-208),
// 오른쪽은 메모·AI 요약·상태 이력 탭 + 다음 작업. 거래 근거(합계 + 자금 흐름·근거·참고 탭)는 그 아래 전체 폭 —
// 그래프 글자가 줄어들지 않고 표가 가로로 잘리지 않게. 좁은 화면에선 한 줄로 쌓여요.

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
	// 질문 답변 패널 (SCRUM-303) — ASK_QUESTION 이 있을 때만. 닫기는 [닫기]로만, 닫으면 근거 강조도 풀려요.
	const [askOpen, setAskOpen] = useState(false)
	const [askCollapsed, setAskCollapsed] = useState(false)
	// 근거 강조 — seq 는 같은 답을 다시 눌러도 거래 탭으로 옮기려고 매번 올려요
	const [highlight, setHighlight] = useState(null)
	const evidenceRef = useRef(null)
	const canAsk = Boolean(detail?.availableActions.includes("ASK_QUESTION"))
	const panelOpen = canAsk && askOpen
	const closePanel = () => {
		setAskOpen(false)
		setAskCollapsed(false)
		setHighlight(null)
	}
	const showEvidence = (item) => {
		setHighlight((prev) => ({
			questionNo: item.questionNo,
			ids: item.evidenceTransactionIds,
			seq: (prev?.seq ?? 0) + 1,
		}))
		// 좁은 화면에선 패널이 본문을 덮어서, 근거를 보러 가면 접어요 (설계 문서 8.4)
		if (window.matchMedia?.("(max-width: 63.99rem)")?.matches) setAskCollapsed(true)
		evidenceRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" })
	}
	return (
		<div className="case-detail">
			<Link className="case-back-link" to={`/cases${listSearch}`}>
				← 케이스 목록
			</Link>
			<AsyncState query={query} />
			{detail && (
				<>
					<header className="case-page-heading">
						<div>
							<p className="case-eyebrow">CASE v{detail.version}</p>
							<h1>{detail.caseNo}</h1>
							<p className="case-page-desc">
								{[
									detail.accountNo,
									detail.alert && `연결 경보 ${detail.alert.alertNo}`,
									detail.alert &&
										`거래 시간 창 ${formatDataTime(detail.alert.windowStart)} ~ ${formatDataTime(detail.alert.windowEnd)}`,
								]
									.filter(Boolean)
									.join(" · ")}
							</p>
						</div>
						<p className="case-heading-badges">
							<span className="case-status">
								{labelOf(STATUS_LABELS, detail.status)}
							</span>
							<span className="case-badge">
								담당자 {detail.assignee?.displayName || "미배정"} · 버전{" "}
								{detail.version}
							</span>
							{canAsk && (
								<button
									type="button"
									className="case-ask-button"
									aria-expanded={panelOpen && !askCollapsed}
									onClick={() => {
										setAskOpen(true)
										setAskCollapsed(false)
									}}
								>
									<svg
										viewBox="0 0 24 24"
										width="16"
										height="16"
										aria-hidden="true"
									>
										<path
											d="M4 5h16v11H8l-4 4z"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinejoin="round"
										/>
									</svg>
									근거에 물어보기
								</button>
							)}
						</p>
					</header>
					<div
						className={
							panelOpen && !askCollapsed
								? "case-detail-shell has-question-panel"
								: "case-detail-shell"
						}
					>
						<div className="case-detail-layout">
							<div className="case-detail-main">
								<div className="case-detail-top">
									<section
										className="case-panel case-summary"
										aria-label="케이스 정보"
									>
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
														{labelOf(
															REJECTION_LABELS,
															detail.rejectionReasonCode,
														)}
													</dd>
												</>
											)}
											{detail.closeReason && (
												<>
													<dt>종료 사유</dt>
													<dd>
														{labelOf(
															CLOSE_REASON_LABELS,
															detail.closeReason,
														)}
													</dd>
												</>
											)}
										</dl>
									</section>
									<AlertPanel alert={detail.alert} />
								</div>
								<CaseScoreReasons latestScore={detail.latestScore} />
							</div>
							<aside className="case-detail-aside" aria-label="메모와 다음 작업">
								<CaseNotesCard detail={detail} onRefresh={() => query.refetch()} />
								<CaseActions detail={detail} />
								{detail.currentDraftNo && (
									<Link
										className="case-str-link"
										to={`/cases/${encodeURIComponent(detail.caseNo)}/str`}
									>
										<span>케이스 보고서 상세보기</span>
										<small>
											STR 초안 {detail.currentDraftNo} · 본문·검증·승인
										</small>
									</Link>
								)}
							</aside>
							<div className="case-evidence" ref={evidenceRef}>
								<CaseEvidenceCard
									detail={detail}
									highlight={panelOpen ? highlight : null}
									onClearHighlight={() => setHighlight(null)}
								/>
							</div>
						</div>
						{panelOpen && !askCollapsed && (
							<CaseQuestionPanel
								caseNo={detail.caseNo}
								highlightedNo={highlight?.questionNo ?? null}
								onShowEvidence={showEvidence}
								onClose={closePanel}
							/>
						)}
						{panelOpen && askCollapsed && (
							<button
								type="button"
								className="question-panel-reopen"
								onClick={() => setAskCollapsed(false)}
							>
								질문 패널 펼치기
							</button>
						)}
					</div>
				</>
			)}
		</div>
	)
}
