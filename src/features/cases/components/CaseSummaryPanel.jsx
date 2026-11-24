import { useIsFetching } from "@tanstack/react-query"
import { caseKey, useCaseCommand } from "../hooks/useCases"
import { getErrorMessage, isNoResponse } from "../../../shared/api/apiClient"
import { formatSystemMinute as formatSystemTime } from "../caseTime"
import StatusBadge from "../../../shared/ui/StatusBadge"
import { humanizeText } from "../displayText"

// AI 조사 요약 (FR-CASE-19·20, 화면 CASE-02-E, 계약서 A7·C7). 요약은 보조 정보라 실패해도 다른 작업은 그대로예요.
// 요약 내용은 상세의 latestSummary를 그대로 써요(C7과 같은 값). 만들고 나면 상세를 다시 불러 version도 맞춰요.
// 실패는 이 칸에만 보여 주고, 기존 요약은 지우지 않고 "이전에 만든 요약"으로 구분해요.
// 응답 없이 끊겨도 서버엔 저장됐을 수 있어요 — 다시 불러온 요약의 producedAt이 누르기 전과 다르면 실패로 보지 않아요(SCRUM-315).
// 다시 불러오는 동안은 실패 안내 대신 "결과 확인 중"을 보여 줘요(실제로 저장된 경우 경고가 잠깐 떴다 사라지지 않게).
// 배지 뜻은 공통 상태 배지 규칙(SCRUM-332) — 현재 기준 success, 바뀜·이전 요약 warning, 알 수 없음 neutral.
const CURRENT_BADGE = {
	true: { label: "최신", tone: "success" },
	false: { label: "데이터 변경됨 · 갱신 필요", tone: "warning" },
}

export default function CaseSummaryPanel({ detail }) {
	const command = useCaseCommand(detail.caseNo, "refreshSummary")
	const summary = detail.latestSummary
	const canRefresh = detail.availableActions.includes("REFRESH_SUMMARY")
	const badge = summary && CURRENT_BADGE[summary.isCurrent]
	const refetching = useIsFetching({ queryKey: caseKey(detail.caseNo), exact: true }) > 0
	const noResponse = command.isError && isNoResponse(command.error)
	const savedAnyway =
		noResponse && (summary?.producedAt ?? null) !== command.variables?.baselineProducedAt
	const checking = noResponse && !savedAnyway && refetching
	const failed = command.isError && !savedAnyway && !checking
	return (
		<section
			className="case-panel case-summary case-ai-summary"
			aria-labelledby="ai-summary-title"
		>
			<h2 id="ai-summary-title">AI 요약</h2>
			{checking && <p role="status">결과를 확인하는 중이에요…</p>}
			{failed && <p role="alert">{getErrorMessage(command.error)}</p>}
			{summary ? (
				<div aria-label={failed ? "이전에 만든 요약" : "현재 요약"} role="group">
					<p>
						{badge ? (
							<StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
						) : (
							<StatusBadge tone="neutral">갱신 필요</StatusBadge>
						)}{" "}
						{failed && <StatusBadge tone="warning">이전에 만든 요약</StatusBadge>}{" "}
						<small>{formatSystemTime(summary.producedAt)} 생성</small>
					</p>
					{summary.summaryLines.length ? (
						<ul className="case-ai-summary-lines">
							{summary.summaryLines.map((line, index) => (
								<li key={index}>{humanizeText(line)}</li>
							))}
						</ul>
					) : (
						<p>요약 문장이 없습니다.</p>
					)}
					{summary.modelFocus && (
						<p>
							<strong>모델이 주목한 점</strong> {humanizeText(summary.modelFocus)}
						</p>
					)}
				</div>
			) : (
				<p>
					{canRefresh
						? "아직 요약이 없습니다. [요약 생성]을 누르면 근거 거래를 바탕으로 요약을 만듭니다."
						: "아직 요약이 없습니다."}
				</p>
			)}
			{canRefresh && (
				<button
					type="button"
					disabled={command.isPending}
					onClick={() =>
						command.mutate({
							version: detail.version,
							baselineProducedAt: summary?.producedAt ?? null,
						})
					}
				>
					{command.isPending ? "요약 만드는 중…" : summary ? "요약 갱신" : "요약 생성"}
				</button>
			)}
		</section>
	)
}
