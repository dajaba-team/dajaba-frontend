import { useState } from "react"
import InfoTip from "../../../shared/ui/InfoTip"
import { formatDataTime } from "../../../shared/format/time"
import { formatNumber } from "./caseMoney"

// "점수 근거" — 상세 latest_score.reasons (BE SCRUM-152, AI 점수 응답 그대로) 상위 3개 (CASE-02, SCRUM-208).
// 이유 하나는 관측값(observation)·기준값(baseline)·모델 기여(contribution)로 나뉘어 와요(안건 3, 10/28).
// 기여값은 모델 내부 값이라 관측값 자리에 쓰지 않고 따로 "거래 사실 아님"으로 보여 줘요. 확인 못 한 값(null)은 채우지 않아요.
// 이름(name)·단위(unit)·방법(method)은 값 목록이 아직 미결이라 받은 그대로 보여 줘요.
const TOP_N = 3

const contributionOf = (reason) => {
	const value = reason?.contribution?.value
	return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** 기여값 크기(절댓값)가 큰 순. 기여값이 없으면 뒤로, 같으면 받은 순서 그대로. */
function topReasons(reasons, n = TOP_N) {
	if (!Array.isArray(reasons)) return []
	return reasons
		.filter((reason) => reason && typeof reason === "object")
		.map((reason, index) => ({ reason, index, size: Math.abs(contributionOf(reason) ?? -1) }))
		.sort((a, b) => b.size - a.size || a.index - b.index)
		.slice(0, n)
		.map(({ reason }) => reason)
}

function withUnit(value, unit) {
	if (value == null) return null
	const text = typeof value === "number" ? formatNumber(value) : String(value)
	return unit ? `${text} ${unit}` : text
}

function Observation({ observation }) {
	const text = withUnit(observation?.value, observation?.unit)
	if (text == null) return <dd>값 없음</dd>
	const window =
		observation.window_start && observation.window_end
			? `${formatDataTime(observation.window_start)} ~ ${formatDataTime(observation.window_end)}`
			: null
	const detail = [observation.basis, window].filter(Boolean).join(" · ")
	return (
		<dd>
			{text}
			{detail && <span className="case-action-note"> ({detail})</span>}
		</dd>
	)
}

function Baseline({ baseline }) {
	const text = withUnit(baseline?.value, null)
	if (text == null) return <dd>기준값 없음</dd>
	return <dd>{baseline.definition ? `${text} (${baseline.definition})` : text}</dd>
}

function Contribution({ contribution }) {
	const value = contributionOf({ contribution })
	if (value == null) return <dd>값 없음</dd>
	const how = [contribution.method, contribution.scale].filter(Boolean).join(" · ")
	const signed = `${value > 0 ? "+" : ""}${formatNumber(value)}`
	return <dd>{how ? `${signed} (${how})` : signed}</dd>
}

function emptyText(latest) {
	if (!latest) return "점수 정보가 없습니다."
	if (latest.scoreStatus === "FAILED") return "점수 산출에 실패해 근거가 없습니다."
	if (latest.scoreStatus !== "SCORED") return "점수 산출 전입니다."
	return "점수 근거가 없습니다."
}

// 처음엔 상위 3개, 더 있으면 [전체 n개 보기]로 펼쳐요.
export default function CaseScoreReasons({ latestScore }) {
	const [all, setAll] = useState(false)
	const scored = latestScore?.scoreStatus === "SCORED"
	const total = scored && Array.isArray(latestScore.reasons) ? latestScore.reasons.length : 0
	const reasons = scored ? topReasons(latestScore.reasons, all ? total : TOP_N) : []
	return (
		<section className="case-panel case-summary" aria-labelledby="score-reasons-title">
			<h2 id="score-reasons-title">점수 근거</h2>
			{reasons.length ? (
				<>
					<ol className="case-reasons">
						{reasons.map((reason, index) => (
							<li key={`${reason.name ?? "reason"}-${index}`}>
								<code>{reason.name ?? "이름 없음"}</code>
								<dl>
									<dt>관측값</dt>
									<Observation observation={reason.observation} />
									<dt>기준값</dt>
									<Baseline baseline={reason.baseline} />
									<dt>
										모델 기여도{" "}
										<InfoTip
											label="모델 기여도"
											text="모델 내부 계산값입니다. 거래 사실이 아니므로 STR 근거로 쓰지 않습니다."
										/>
									</dt>
									<Contribution contribution={reason.contribution} />
								</dl>
							</li>
						))}
					</ol>
					{total > TOP_N && (
						<button type="button" onClick={() => setAll(!all)}>
							{all ? "상위 3개만 보기" : `전체 ${total}개 보기`}
						</button>
					)}
				</>
			) : (
				<p>{emptyText(latestScore)}</p>
			)}
		</section>
	)
}
