import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { getErrorMessage } from "../../../../shared/api/apiClient"
import { batchesApi } from "../api/batchesApi"
import { formatCount } from "../formatCount"
import BatchStep from "./BatchStep"

// [점수 산출] 카드 — 계약서 B3, 백엔드 ScoreBatchController(SCRUM-100). 동기 200, 상태 조회 없음.
// 200이어도 일부 실패가 있을 수 있어요(status FAILED = 다시 보낼 실패가 남음). 실패를 0점·저위험으로 보이지 않아요.
// 다시 보낼 실패(retryable)가 남으면 버튼 이름이 [점수 재처리] — 같은 API를 다시 부르면 남은 것만 보내요(따로 버튼 없음).
// 확인창 없음(흐름 데모와 같음) — 다시 눌러도 성공한 점수는 그대로라 되돌릴 일이 없어요.
const DATE = /^\d{4}-\d{2}-\d{2}$/

function Result({ score }) {
	if (!score.requested)
		return (
			<p role="status">점수를 낼 경보가 없어요. 남은 대상이 없거나 이미 모두 처리됐어요.</p>
		)
	const permanent = score.failed - score.retryable
	return (
		<div role={score.failed ? "alert" : "status"}>
			<p>
				{score.failed
					? `점수 ${formatCount(score.scored)}건 성공, ${formatCount(score.failed)}건 실패. 실패가 저위험을 뜻하지 않습니다.`
					: `점수 ${formatCount(score.scored)}건을 산출했어요.`}
			</p>
			{score.retryable > 0 && (
				<p>
					다시 보낼 실패 {formatCount(score.retryable)}건 — [점수 재처리]를 누르면 이것만
					다시 보내요. 성공한 점수는 그대로예요.
				</p>
			)}
			{permanent > 0 && (
				<p>
					다시 보내도 결과가 바뀌지 않는 실패 {formatCount(permanent)}건 — 경보 점검에서
					원인을 확인해 주세요.
				</p>
			)}
			<p>
				묶음 {formatCount(score.chunks.total)}개
				{score.chunks.failed > 0 && ` 중 호출 실패 ${formatCount(score.chunks.failed)}개`}
				{score.modelVersions.length > 0 && ` · 모델 ${score.modelVersions.join(", ")}`}
			</p>
		</div>
	)
}

export default function ScoreCard({ date, onResult, primary = false }) {
	// 마지막 성공 응답은 따로 들고 있어요 — 재처리 중·재처리 오류에도 이전 결과와 [점수 재처리] 이름이 남게
	const [last, setLast] = useState(null)
	const score = useMutation({
		mutationFn: () => batchesApi.score({ date }),
		onSuccess: (result) => {
			setLast(result)
			onResult?.({
				// 하나도 성공 못 했으면 "실패", 성공이 섞였으면 "일부 실패"(화면 표시용)
				status: !result.failed ? "SUCCEEDED" : result.scored ? "PARTIAL" : "FAILED",
				retry: result.retryable > 0,
				summary: result.requested
					? `${result.batchDate} 성공 ${formatCount(result.scored)} / 실패 ${formatCount(result.failed)}`
					: `${result.batchDate} 대상 없음`,
			})
		},
	})
	const retry = last?.retryable > 0
	const state = score.isPending
		? "running"
		: !last
			? "idle"
			: !last.failed
				? "done"
				: last.scored
					? "partial"
					: "failed"
	return (
		<BatchStep
			id="score-step-title"
			no={3}
			title="점수 산출"
			scope="미처리·재처리 가능한 실패만 · 성공분 유지"
			state={state}
		>
			<button
				type="button"
				className="batch-run"
				data-primary={primary || retry}
				disabled={!DATE.test(date) || score.isPending}
				onClick={() => score.mutate()}
			>
				{score.isPending ? "점수 산출 중…" : retry ? "점수 재처리" : "실행"}
			</button>
			{!DATE.test(date) && <p>위에서 분석 날짜를 먼저 골라 주세요.</p>}
			{score.isPending && (
				<p role="status">AI 점수를 기다리는 중이에요. 경보가 많으면 몇 분 걸려요.</p>
			)}
			{score.isError && <p role="alert">{getErrorMessage(score.error)}</p>}
			{last && !score.isPending && <Result score={last} />}
		</BatchStep>
	)
}
