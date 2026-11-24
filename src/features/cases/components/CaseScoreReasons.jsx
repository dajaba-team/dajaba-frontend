import InfoTip from "../../../shared/ui/InfoTip"
import { formatDataTime } from "../../../shared/format/time"
import { formatNumber } from "./caseMoney"
import { basisLabel, reasonLabel, withReasonUnit } from "../reasonLabels"

// "점수 근거" — 상세 latest_score.reasons (BE SCRUM-152, AI 점수 응답 그대로) 상위 3개 (CASE-02, SCRUM-208).
// 이유 하나는 관측값(observation)·기준값(baseline)·모델 기여(contribution)로 나뉘어 와요(안건 3, 10/28).
// 기여값은 모델 내부 값이라 관측값 자리에 쓰지 않고 따로 "거래 사실 아님"으로 보여 줘요. 확인 못 한 값(null)은 채우지 않아요.
// 이름(name)·단위(unit)·관측 기준(basis)은 reasonLabels 에서 화면 글자만 한글로 바꿔요(원래 코드는 그대로 둬요).
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

function Observation({ observation, name }) {
	const text = withReasonUnit(observation?.value, observation?.unit, name, formatNumber)
	if (text == null) return <dd>확인 못 함</dd>
	const window =
		observation.window_start && observation.window_end
			? `${formatDataTime(observation.window_start)} ~ ${formatDataTime(observation.window_end)}`
			: null
	const detail = [basisLabel(observation.basis), window].filter(Boolean).join(" · ")
	return (
		<dd>
			{text}
			{detail && <span className="case-action-note"> ({detail})</span>}
		</dd>
	)
}

// 기준값은 관측값과 같은 단위로 비교해요.
function Baseline({ baseline, unit, name }) {
	const text = withReasonUnit(baseline?.value, unit, name, formatNumber)
	if (text == null) return <dd>기준값 없음</dd>
	return <dd>{baseline.definition ? `${text} (${baseline.definition})` : text}</dd>
}

// 계산 방식(SHAP)·척도(raw_margin)는 모델 내부 용어라 값 옆에 쓰지 않고 ⓘ 설명에만 둬요.
function Contribution({ contribution }) {
	const value = contributionOf({ contribution })
	if (value == null) return <dd>확인 못 함</dd>
	const signed = `${value > 0 ? "+" : ""}${formatNumber(value)}`
	const effect = value > 0 ? "점수를 높임" : value < 0 ? "점수를 낮춤" : "영향 없음"
	return (
		<dd>
			{signed} <span className="case-action-note">({effect})</span>
		</dd>
	)
}

const contributionTip = (method) =>
	`${method ? `${method} 방식으로 계산한 ` : ""}모델 내부 값이에요. 클수록 이 점수에 크게 작용했어요. 거래 사실이 아니라서 STR 근거로 쓰지 않아요.`

// 한글 이름을 보여 주고, 모르는 지표만 코드 그대로. 코드는 data-reason 에 남겨 AI 요약 문장과 맞춰 볼 수 있게.
function ReasonName({ name }) {
	const label = reasonLabel(name)
	if (label) return <strong data-reason={name}>{label}</strong>
	return <code data-reason={name}>{name ?? "이름 없음"}</code>
}

function emptyText(latest) {
	if (!latest) return "점수 정보가 없어요."
	if (latest.scoreStatus === "FAILED")
		return "점수 산출에 실패해서 이유가 없어요. 위험이 낮다는 뜻이 아니에요."
	if (latest.scoreStatus !== "SCORED") return "점수 산출 전이라 이유가 아직 없어요."
	return "모델이 이유를 보내지 않았어요."
}

export default function CaseScoreReasons({ latestScore }) {
	const reasons = latestScore?.scoreStatus === "SCORED" ? topReasons(latestScore.reasons) : []
	return (
		<section className="case-panel case-summary" aria-labelledby="score-reasons-title">
			<h2 id="score-reasons-title">점수 근거</h2>
			{reasons.length ? (
				<>
					<ol className="case-reasons">
						{reasons.map((reason, index) => (
							<li key={`${reason.name ?? "reason"}-${index}`}>
								<ReasonName name={reason.name} />
								<dl>
									<dt>관측값</dt>
									<Observation
										observation={reason.observation}
										name={reason.name}
									/>
									<dt>기준값</dt>
									<Baseline
										baseline={reason.baseline}
										unit={reason.observation?.unit}
										name={reason.name}
									/>
									<dt>
										모델 기여 (거래 사실 아님){" "}
										<InfoTip
											label="모델 기여"
											text={contributionTip(reason.contribution?.method)}
										/>
									</dt>
									<Contribution contribution={reason.contribution} />
								</dl>
							</li>
						))}
					</ol>
				</>
			) : (
				<p>{emptyText(latestScore)}</p>
			)}
		</section>
	)
}
