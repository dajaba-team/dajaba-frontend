import InfoTip from "../../../../shared/ui/InfoTip"
import Icon from "../../../../shared/ui/dashboard/Icon"

// 배치 카드 한 칸의 틀 — (아이콘)·이름·ⓘ·한 줄 설명·상태 배지(화면 설계서 ADM-01). 버튼·결과는 children.
// 단계 번호는 두지 않아요 — 위 [분석 일괄 실행]을 누르는 구조인데 번호가 있으면 아래 룰 스캔부터 직접 누르는 것으로 보일 수 있어서(SCRUM-345).
// ⓘ 는 제목(h2) 밖 — 영역 이름에 설명이 섞이지 않게. 한 줄 설명(scope)은 위 작업 카드만, 자동 처리 현황 단계는 아이콘(icon)으로.
// 자세한 규칙(최초 1회·건너뜀 등)은 ⓘ(info)로.
const BADGE = {
	idle: "대기",
	running: "실행 중",
	done: "완료",
	partial: "일부 실패",
	failed: "실패",
}

// stateLabel — 배지 글자만 바꿀 때(원천 적재의 대기 → "미적재"). 색은 state 그대로.
export default function BatchStep({
	id,
	title,
	scope,
	info,
	icon,
	state = "idle",
	stateLabel,
	children,
}) {
	return (
		<section className="batch-step" aria-labelledby={id}>
			{icon && (
				<span className="batch-step-icon" aria-hidden="true">
					<Icon name={icon} size={20} />
				</span>
			)}
			{/* 상태 배지는 모든 카드에서 오른쪽 위 */}
			<div className="batch-step-head">
				<div className="batch-step-title">
					<h2 id={id}>{title}</h2>
					{info && <InfoTip label={title} text={info} />}
				</div>
				<span className="batch-badge" data-state={state}>
					{stateLabel ?? BADGE[state]}
				</span>
			</div>
			{scope && <p className="batch-step-scope">{scope}</p>}
			{children}
		</section>
	)
}
