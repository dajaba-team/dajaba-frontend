import { useId } from "react"
import {
	SUSPICION_GROUPS,
	SUSPICION_LEVELS,
	SUSPICION_LEVEL_HINT,
	SUSPICION_TYPES,
	isKnownSuspicionType,
	suspicionTypeLabel,
} from "../../../shared/str/suspicionTypes"

// VI부 — 의심스러운 거래유형(복수 선택)·지점 의심 정도(1~5, 기본값 없음). 화면 설계 STR-01 ⑤·STR-01-E.
// 본문 저장(S3)과 분리돼 있고, 승인 요청(S6) 때 함께 보내요. 추천(suspicion_types_recommended)은
// 표시만 하고 자동 체크하지 않아요(룰→서식 유형 매핑 미확정).
// 고르는 곳은 [승인 요청] 창 한 곳(StrSubmitDialog) — 이 패널은 지금 고른 값을 보여 주기만 해요.
// 그 창을 쓰는 담당 조사역에겐 안 그려요(StrPage) — 승인자·승인 뒤 화면용.
export default function StrSuspicionPanel({ types, level, levelHq = null, recommended }) {
	return (
		<section className="str-panel" aria-labelledby="str-vi-heading">
			<div className="str-panel-head">
				<h2 id="str-vi-heading">VI. 의심 유형·지점 의심 정도</h2>
				<p>
					지점 의심 정도 {level ?? "미입력"}
					{/* 본점 정도는 승인(P2) 때 승인자가 정해요 — 승인 전엔 null이라 안 보여요 */}
					{levelHq != null && ` · 본점 의심 정도 ${levelHq}`}
				</p>
			</div>
			<p>
				{types.length ? types.map(suspicionTypeLabel).join(", ") : "선택한 유형이 없어요."}
			</p>
			{recommended.length > 0 && (
				<p className="str-muted">
					서버 추천: {recommended.map(suspicionTypeLabel).join(", ")}
				</p>
			)}
		</section>
	)
}

/** 승인 요청 창 1단계 — 유형 체크·지점 의심 정도 라디오. */
export function SuspicionFields({ types, level, recommended, onTypesChange, onLevelChange }) {
	const levelName = useId()
	const unknown = types.filter((id) => !isKnownSuspicionType(id))
	return (
		<div className="str-vi-fields">
			{recommended.length > 0 && (
				<p className="str-muted">
					서버 추천: {recommended.map(suspicionTypeLabel).join(", ")} (자동 선택하지
					않아요)
				</p>
			)}
			<p className="str-vi-title">
				의심 유형 <span className="str-required">필수 · 1개 이상 선택</span>
			</p>
			{SUSPICION_GROUPS.map((group) => (
				<fieldset key={group} className="str-vi-group">
					<legend>{group}</legend>
					{SUSPICION_TYPES.filter((item) => item.group === group).map((item) => (
						<label key={item.id}>
							<input
								type="checkbox"
								checked={types.includes(item.id)}
								onChange={(event) =>
									onTypesChange(
										event.target.checked
											? [...types, item.id]
											: types.filter((id) => id !== item.id),
									)
								}
							/>{" "}
							{item.label}
							{recommended.includes(item.id) && (
								<span className="str-badge">추천</span>
							)}
						</label>
					))}
				</fieldset>
			))}
			{unknown.length > 0 && (
				<p role="note">
					목록에 없는 유형 {unknown.join(", ")}이 선택돼 있어요. 지우지 않고 그대로
					보내요.
				</p>
			)}
			<fieldset className="str-vi-group">
				<legend>
					지점 의심 정도 <span className="str-required">필수 · 1개 선택</span>
				</legend>
				<p className="str-muted">{SUSPICION_LEVEL_HINT} · 기본값 없음</p>
				<div className="str-levels">
					{SUSPICION_LEVELS.map((value) => (
						<label key={value}>
							<input
								type="radio"
								name={levelName}
								value={value}
								checked={level === value}
								onChange={() => onLevelChange(value)}
							/>{" "}
							{value}
						</label>
					))}
				</div>
			</fieldset>
		</div>
	)
}
