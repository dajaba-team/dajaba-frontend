import { useEffect, useState } from "react"
import { Link, useLocation, useParams } from "react-router"
import "../styles/cases.css"
import { useCaseDetail } from "../hooks/useCases"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatDataTime, formatSystemTime } from "../../../shared/format/time"
import { useSession } from "../../auth/hooks/useSession"
import CaseActions from "../components/CaseActions"
import CaseAskPanel from "../components/CaseAskPanel"
import bearFace from "../../../shared/assets/bear-face.png"
import CaseEvidenceCard from "../components/CaseEvidenceCard"
import CaseNotesCard from "../components/CaseNotesCard"
import CaseScoreReasons from "../components/CaseScoreReasons"
import { formatScore } from "../../../shared/format/score"
import {
	CLOSE_REASON_LABELS,
	REJECTION_LABELS,
	SCORE_STATUS_LABELS,
	STATUS_LABELS,
	labelOf,
} from "../labels"

// 케이스 상세 — 계약서 C2 `GET /cases/{case_no}`. 열람 기록은 서버가 남겨요.
// 카드 제목은 명사형으로 맞춰요: 케이스 개요 · 경보 정보 · 점수 근거 · 조사 메모/AI 요약/처리 이력 · 처리 작업 · 거래 분석.
// 배치는 시연 화면(/demo/cases)과 같은 2단: 왼쪽은 케이스 개요·경보 정보 → 점수 이유 상위 3개(SCRUM-208),
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
					<strong>{formatScore(score)}</strong>
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
			<h2 id="alert-title">경보 정보</h2>
			{alert ? (
				<dl>
					<dt>경보 번호</dt>
					<dd>{alert.alertNo}</dd>
					<dt>탐지 규칙</dt>
					<dd>{alert.ruleId}</dd>
					<dt>배치 기준일</dt>
					<dd>{alert.batchDate}</dd>
					<dt>묶인 거래</dt>
					<dd>{alert.transactionCount}건</dd>
				</dl>
			) : (
				<p>경보 정보 없음</p>
			)}
		</section>
	)
}

// 질문 채팅창 상태 — 열림·접힘(근거 보기)·근거 강조. 케이스가 바뀌면 key 로 새로 시작해요(SCRUM-303).
// 채팅창은 본문 위 오른쪽 아래에 떠 있어서 본문 배치를 바꾸지 않아요. 근거 거래를 보면 표를 가리지 않게 접어 두고,
// 오른쪽 아래 [질의 창 열기]로 다시 펼쳐요 — 쓰던 입력·지난 질문은 그대로예요.
function useAskPanel() {
	const [open, setOpen] = useState(false)
	const [collapsed, setCollapsed] = useState(false)
	const [highlight, setHighlight] = useState(null)
	useEffect(() => {
		if (!highlight) return
		const card = document.getElementById("case-evidence-card")
		card?.scrollIntoView?.({ block: "start", behavior: "smooth" })
		document.getElementById("ask-evidence-bar")?.focus({ preventScroll: true })
	}, [highlight])
	return {
		open,
		collapsed,
		highlight,
		openPanel: () => {
			setOpen(true)
			setCollapsed(false)
		},
		close: () => {
			setOpen(false)
			setCollapsed(false)
			setHighlight(null)
			document.getElementById("ask-open")?.focus({ preventScroll: true })
		},
		showEvidence: (record) => {
			setHighlight((prev) => ({
				questionNo: record.questionNo,
				ids: record.evidenceTransactionIds,
				seq: (prev?.seq ?? 0) + 1,
			}))
			setCollapsed(true)
		},
		clearHighlight: () => setHighlight(null),
		minimize: () => setCollapsed(true),
	}
}

function AskButton({ ask }) {
	const shown = ask.open && !ask.collapsed
	return (
		<button
			id="ask-open"
			type="button"
			className="case-ask-open"
			aria-expanded={shown}
			aria-controls={ask.open ? "ask-panel" : undefined}
			onClick={ask.openPanel}
		>
			<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
				<path d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 16 14h-6.2L6 17v-3H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5Z" />
				<path d="M7 9.25h6M7 11.25h3.5" />
			</svg>
			{ask.open && ask.collapsed ? "질의 창 열기" : "근거 질의"}
		</button>
	)
}

export default function CaseDetailPage() {
	const { caseNo } = useParams()
	return <CaseDetail key={caseNo} caseNo={caseNo} />
}

function CaseDetail({ caseNo }) {
	// 목록에서 들어왔으면 그때의 필터·정렬·페이지(주소 query)로 돌아가요 (SCRUM-181)
	const fromList = useLocation().state?.listSearch
	const listSearch = typeof fromList === "string" && fromList.startsWith("?") ? fromList : ""
	const query = useCaseDetail(caseNo)
	const detail = query.data
	const viewer = useSession().data
	const ask = useAskPanel()
	// 버튼·패널은 서버가 준 ASK_QUESTION 으로만 그려요. 역할·상태를 화면에서 계산하지 않아요.
	const canAsk = Boolean(detail?.availableActions?.includes("ASK_QUESTION"))
	const panelOpen = canAsk && ask.open
	return (
		<div className="case-detail">
			<div className="case-ask-main">
				<Link className="case-back-link" to={`/cases${listSearch}`}>
					← 케이스 목록
				</Link>
				<AsyncState query={query} />
				{detail && (
					<>
						<header className="case-page-heading">
							<div>
								<p className="case-eyebrow">케이스 상세</p>
								<h1>{detail.caseNo}</h1>
								<p className="case-page-desc">
									{[
										detail.accountNo,
										detail.alert && `경보 ${detail.alert.alertNo}`,
										detail.alert &&
											`탐지 기간 ${formatDataTime(detail.alert.windowStart)} ~ ${formatDataTime(detail.alert.windowEnd)}`,
									]
										.filter(Boolean)
										.join(" · ")}
								</p>
							</div>
							<div className="case-heading-side">
								{canAsk && <AskButton ask={ask} />}
								<p className="case-heading-badges">
									<span className="case-status">
										{labelOf(STATUS_LABELS, detail.status)}
									</span>
									<span className="case-badge">
										담당자 {detail.assignee?.displayName || "미배정"} · 버전{" "}
										{detail.version}
									</span>
								</p>
							</div>
						</header>
						<div className="case-detail-layout">
							<div className="case-detail-main">
								<div className="case-detail-top">
									<section
										className="case-panel case-summary"
										aria-labelledby="case-overview-title"
									>
										<h2 id="case-overview-title">케이스 개요</h2>
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
							<div className="case-evidence">
								<CaseEvidenceCard
									detail={detail}
									highlight={panelOpen ? ask.highlight : null}
									onClearHighlight={ask.clearHighlight}
									onReopenAsk={
										panelOpen && ask.collapsed ? ask.openPanel : undefined
									}
								/>
							</div>
						</div>
					</>
				)}
			</div>
			{panelOpen && (
				<div className="ask-float" id="ask-panel">
					{ask.collapsed && (
						<button type="button" className="ask-float-reopen" onClick={ask.openPanel}>
							<img src={bearFace} alt="" aria-hidden="true" />
							질의 창 열기
						</button>
					)}
					<CaseAskPanel
						caseNo={detail.caseNo}
						viewerName={viewer?.displayName ?? "나"}
						viewerLoginId={viewer?.loginId ?? null}
						highlightedNo={ask.highlight?.questionNo ?? null}
						onShowEvidence={ask.showEvidence}
						onClose={ask.close}
						onMinimize={ask.minimize}
						hidden={ask.collapsed}
					/>
				</div>
			)}
		</div>
	)
}
