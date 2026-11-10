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
export default function StrSuspicionPanel({
	editable,
	types,
	level,
	recommended,
	onTypesChange,
	onLevelChange,
}) {
	const levelName = useId()
	const unknown = types.filter((id) => !isKnownSuspicionType(id))
	return (
		<section className="str-panel" aria-labelledby="str-vi-heading">
			<div className="str-panel-head">
				<h2 id="str-vi-heading">VI. 의심 유형·지점 의심 정도</h2>
				<p>
					선택 {types.length}개 · 지점 의심 정도 {level ?? "미입력"}
					{editable && " · 승인 요청 때 함께 보내요(따로 저장하지 않아요)"}
				</p>
			</div>
			{recommended.length > 0 && (
				<p className="str-muted">
					서버 추천: {recommended.map(suspicionTypeLabel).join(", ")} (자동 선택하지
					않아요)
				</p>
			)}
			{!editable ? (
				<p>
					{types.length
						? types.map(suspicionTypeLabel).join(", ")
						: "선택한 유형이 없어요."}
				</p>
			) : (
				<details className="str-vi-picker">
					<summary>유형 선택 열기</summary>
					<p className="str-muted">
						항목명·분류는 미확정 서식 참고안이에요. 실제 유형 코드는 룰 명세 확정 뒤
						바뀌어요.
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
							목록에 없는 유형 {unknown.join(", ")}이 선택돼 있어요. 지우지 않고
							그대로 보내요.
						</p>
					)}
				</details>
			)}
			<fieldset className="str-vi-group" disabled={!editable}>
				<legend>지점 의심 정도 *</legend>
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
		</section>
	)
}
