import StatusBadge from "../../../../shared/ui/StatusBadge"

// 4단계 카드 한 칸의 틀 — 번호·이름·범위·상태 배지(화면 설계서 ADM-01, 흐름 데모 v1.4). 버튼·결과는 children.
// 번호는 aria-hidden 이라 영역 이름은 "원천 적재"처럼 단계 이름만 읽혀요.
// 상태 → [글자, 톤]. 톤은 화면 공통 상태 배지 규칙(SCRUM-332, docs/05_ui.md §2).
const BADGE = {
	idle: ["대기", "neutral"],
	running: ["실행 중", "info"],
	done: ["완료", "success"],
	partial: ["일부 실패", "warning"],
	failed: ["실패", "danger"],
}

export default function BatchStep({ id, no, title, scope, state = "idle", children }) {
	return (
		<section className="batch-step" aria-labelledby={id}>
			<h2 id={id}>
				<span className="batch-step-no" aria-hidden="true">
					{no}
				</span>
				{title}
			</h2>
			<p className="batch-step-scope">{scope}</p>
			<StatusBadge className="batch-badge" data-state={state} tone={BADGE[state][1]}>
				{BADGE[state][0]}
			</StatusBadge>
			{children}
		</section>
	)
}
