import { useId } from "react"
import Icon from "./dashboard/Icon"

// 제목 옆 ⓘ — 마우스를 올리거나 키보드(Tab)로 가면 설명을 보여 줘요. 화면 읽기 프로그램에는 버튼 설명(aria-describedby)으로.
// 키보드로 띄운 설명은 Esc 로 닫아요(포커스를 놓으면 사라짐). 클릭 뒤 포커스가 남아도 계속 떠 있지 않게 :focus-visible 만(SCRUM-345).
// 대시보드 KPI 카드에서 쓰던 것을 데이터·배치 운영 카드도 같이 쓰려고 꺼냈어요. 위치는 쓰는 화면 CSS 가 정해요.
export default function InfoTip({ label, text }) {
	const tipId = useId()
	return (
		<span className="kpi-info">
			<button
				type="button"
				className="kpi-info-button"
				aria-label={`${label} 설명`}
				aria-describedby={tipId}
				onKeyDown={(event) => event.key === "Escape" && event.currentTarget.blur()}
			>
				<Icon name="info" size={14} />
			</button>
			<span role="tooltip" id={tipId} className="kpi-info-tip">
				{text}
			</span>
		</span>
	)
}
