// 4단계 카드 한 칸의 틀 — 번호·이름·범위·상태 배지(화면 설계서 ADM-01, 흐름 데모 v1.4). 버튼·결과는 children.
// 번호는 aria-hidden 이라 영역 이름은 "원천 적재"처럼 단계 이름만 읽혀요.
const BADGE = {
	idle: "대기",
	running: "실행 중",
	done: "완료",
	partial: "일부 실패",
	failed: "실패",
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
			<span className="batch-badge" data-state={state}>
				{BADGE[state]}
			</span>
			{children}
		</section>
	)
}
