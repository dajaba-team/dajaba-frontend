import { useId } from "react"

// 짧은 업무 용어 설명에 공통으로 쓰는 도움말입니다.
// 버튼이라 마우스 hover뿐 아니라 키보드 Tab 포커스로도 내용을 확인할 수 있습니다.
export default function HelpTooltip({ label, children }) {
	const tooltipId = useId()

	return (
		<span className="help-tooltip">
			<button
				type="button"
				className="help-tooltip-trigger"
				aria-label={`${label} 도움말`}
				aria-describedby={tooltipId}
			>
				?
			</button>
			<span id={tooltipId} role="tooltip" className="help-tooltip-content">
				{children}
			</span>
		</span>
	)
}
