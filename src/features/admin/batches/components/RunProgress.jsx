import { elapsedText, useNow } from "../hooks/useNow"

// 실행 중 표시 — 스피너 + 지금 단계 + 단계 막대 + 경과 시간(BE progress, SCRUM-356).
// 막대는 문구의 "n/전체"와 같은 값(지금 도는 단계까지)이에요 — 마지막 단계면 "6/6"·막대 가득(SCRUM-345).
// 행 단위 실제 %는 서버가 주지 않아요. 진행 단계가 없으면(점수·케이스 생성) 문구만.
// compact — 자동 처리 현황 칸처럼 좁은 곳: 경과 시간 없이 문구·막대만(칸 높이가 들쑥날쑥하지 않게).
// 시작한 지 10분이 넘으면 자동 조회가 멈춰요(계약서 5.6) — onRecheck 가 있으면 실패로 단정하지 않고 [상태 다시 확인].
const MAX_POLL_MS = 10 * 60 * 1000

export default function RunProgress({
	label,
	progress,
	startedAt,
	title,
	compact = false,
	onRecheck,
	rechecking,
}) {
	const now = useNow(true)
	const elapsed = compact ? null : elapsedText(startedAt, now)
	const stale = onRecheck && startedAt != null && now - Date.parse(startedAt) > MAX_POLL_MS
	const percent =
		progress && progress.total > 0
			? Math.min(100, Math.round(((progress.done + 1) / progress.total) * 100))
			: null
	return (
		<div className="batch-progress" data-compact={compact}>
			<p role="status">
				<span className="batch-spinner" aria-hidden="true" />
				{label}
			</p>
			{percent != null && (
				<div
					className="batch-progress-bar"
					role="progressbar"
					aria-label={`${title} 진행`}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent}
				>
					<span style={{ width: `${percent}%` }} />
				</div>
			)}
			{elapsed && <p className="batch-step-date">경과 {elapsed}</p>}
			{stale && (
				<div role="alert">
					<p>10분이 지나도 끝나지 않아 자동 확인을 멈췄어요. 실패로 보지 마세요.</p>
					<button type="button" onClick={onRecheck} disabled={rechecking}>
						상태 다시 확인
					</button>
				</div>
			)}
		</div>
	)
}
