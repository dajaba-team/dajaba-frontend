import { formatDataMinute as formatDataTime } from "../caseTime"
import { formatScore } from "../../../shared/format/score"
import { ButtonLink } from "../../../shared/ui/Button"
import Button from "../../../shared/ui/Button"
import InfoTip from "../../../shared/ui/InfoTip"
import RiskBadge from "../../../shared/ui/RiskBadge"
import StatusBadge from "../../../shared/ui/StatusBadge"
import { SCORE_STATUS_LABELS, STATUS_LABELS, STATUS_TONES, labelOf } from "../labels"
import { nextActionOf } from "./nextAction"

// 판단 요약(SCRUM-369 B안) — 등급·점수, 상태·담당·탐지 규칙, 탐지 기간, 다음 처리 버튼만.
// 계좌·경보 번호·버전 같은 보조 정보는 「케이스·경보 정보」 카드로 내려요.
// 점수는 latest_score 와 같은 값(계약서 Q2 MVP). 모델 점수라 범죄 확률이 아니에요 — 안내는 ⓘ 로.
function scoreOf(detail) {
	const latest = detail.latestScore
	const score = detail.score ?? latest?.score ?? null
	const band = detail.scoreBand ?? latest?.scoreBand ?? null
	let status = null
	if (score == null) {
		const label = latest ? labelOf(SCORE_STATUS_LABELS, latest.scoreStatus) : "산출 정보 없음"
		status = latest?.failureCode ? `${label} (${latest.failureCode})` : label
	}
	return { score, band, status, modelVersion: latest?.modelVersion ?? null }
}

export default function CaseSummaryHeader({ detail, askButton, onAction }) {
	const { score, band, status, modelVersion } = scoreOf(detail)
	const next = nextActionOf(detail)
	const alert = detail.alert
	const meta = [
		detail.assignee?.displayName ? `담당 ${detail.assignee.displayName}` : "미배정",
		alert?.ruleId,
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
									text={`모델 점수예요. 범죄 확률이 아니에요.${modelVersion ? ` 모델 ${modelVersion}` : ""}`}
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
				{alert && (
					<p className="case-summary-window">
						탐지 기간 {formatDataTime(alert.windowStart)} ~{" "}
						{formatDataTime(alert.windowEnd)}
					</p>
				)}
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
