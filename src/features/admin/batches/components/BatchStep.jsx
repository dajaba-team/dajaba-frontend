import StatusBadge from "../../../../shared/ui/StatusBadge"

// 4단계 카드 한 칸의 틀 — 번호·이름·범위·상태 배지(화면 설계서 ADM-01, 흐름 데모 v1.4). 버튼·결과는 children.
// 번호는 aria-hidden 이라 영역 이름은 "원천 적재"처럼 단계 이름만 읽혀요.
// 상태 → 글자·뜻(SCRUM-332 공통 상태 배지 규칙).
const BADGE = {
	idle: { label: "대기", tone: "neutral" },
	running: { label: "실행 중", tone: "info" },
	done: { label: "완료", tone: "success" },
	partial: { label: "일부 실패", tone: "warning" },
	failed: { label: "실패", tone: "danger" },
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
			<StatusBadge tone={BADGE[state].tone} data-state={state}>
				{BADGE[state].label}
			</StatusBadge>
			{children}
		</section>
	)
}
