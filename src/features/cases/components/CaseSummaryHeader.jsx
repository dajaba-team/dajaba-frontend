import { formatScore } from "../../../shared/format/score"
import { ButtonLink } from "../../../shared/ui/Button"
import Button from "../../../shared/ui/Button"
import InfoTip from "../../../shared/ui/InfoTip"
import RiskBadge from "../../../shared/ui/RiskBadge"
import StatusBadge from "../../../shared/ui/StatusBadge"
import {
	CLOSE_REASON_LABELS,
	REJECTION_LABELS,
	SCORE_STATUS_LABELS,
	STATUS_LABELS,
	STATUS_TONES,
	labelOf,
} from "../labels"
import { nextActionOf } from "./nextAction"

// 판단 요약(SCRUM-369 B안) — 등급·점수, 상태·사유·담당, 다음 처리 버튼만.
// 계좌·탐지 규칙·탐지 기간·경보 번호는 바로 아래 개요 띠(CaseInfoCard)에 있어요.
// 점수는 latest_score 와 같은 값(계약서 Q2 MVP). 실패 코드(failure_code)는 내부 값이라 보여 주지 않아요.
// 반려·종료 사유는 그 상태에서 가장 먼저 볼 정보라 상태 배지 옆에 둬요.
function scoreOf(detail) {
	const latest = detail.latestScore
	const score = detail.score ?? latest?.score ?? null
	const band = detail.scoreBand ?? latest?.scoreBand ?? null
	const status =
		score == null
			? `점수 ${latest ? labelOf(SCORE_STATUS_LABELS, latest.scoreStatus) : "정보 없음"}`
			: null
	return { score, band, status }
}

export default function CaseSummaryHeader({ detail, askButton, onAction }) {
	const { score, band, status } = scoreOf(detail)
	const next = nextActionOf(detail)
	const meta = [
		detail.rejectionReasonCode &&
			`반려 사유: ${labelOf(REJECTION_LABELS, detail.rejectionReasonCode)}`,
		detail.closeReason && `종료 사유: ${labelOf(CLOSE_REASON_LABELS, detail.closeReason)}`,
		detail.assignee?.displayName ? `담당 ${detail.assignee.displayName}` : "담당자 미배정",
		detail.currentDraftNo && `STR 초안 ${detail.currentDraftNo}`,
	].filter(Boolean)
	return (
		<header className="case-summary-head">
			<div className="case-summary-main">
				<h1>{detail.caseNo}</h1>
				<p className="case-summary-score">
					{score != null ? (
						<>
							<RiskBadge band={band} />
							<strong>{formatScore(score)}</strong>
							{/* 라벨과 ⓘ 는 한 덩어리 — 좁은 화면에서 ⓘ 만 다음 줄 왼쪽 끝으로 떨어져 설명이 화면 밖으로 나가지 않게. */}
							<span className="case-summary-score-name">
								<span className="case-summary-score-label">조사 우선순위 점수</span>
								<InfoTip
									clickable
									label="조사 우선순위 점수"
									text="높을수록 먼저 조사할 케이스입니다. 범죄 확률을 뜻하지 않습니다."
								/>
							</span>
						</>
					) : (
						<span className="case-summary-score-status">{status}</span>
					)}
				</p>
				<p className="case-summary-meta">
					<StatusBadge tone={STATUS_TONES[detail.status]}>
						{labelOf(STATUS_LABELS, detail.status)}
					</StatusBadge>
					{meta.map((item) => (
						<span key={item}>{item}</span>
					))}
				</p>
			</div>
			{(next || askButton) && (
				<div className="case-summary-actions">
					{next?.key === "open_report" && (
						<ButtonLink
							variant="primary"
							block
							to={`/cases/${encodeURIComponent(detail.caseNo)}/str`}
						>
							보고서 열기
						</ButtonLink>
					)}
					{next && next.key !== "open_report" && (
						<Button variant="primary" block onClick={() => onAction(next.key)}>
							{next.label}
						</Button>
					)}
					{askButton}
				</div>
			)}
		</header>
	)
}
