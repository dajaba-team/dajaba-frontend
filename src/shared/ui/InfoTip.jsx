import { useId, useRef } from "react"
import Icon from "./dashboard/Icon"

const EDGE = 8 // 화면 가장자리와 띄울 거리(px)

// 툴팁 상자를 글자에 맞춰요(SCRUM-393). 띄우기 직전에 재요.
// 1) CSS 만으로는 줄이 바뀌면 상자가 최대 폭에 붙어 오른쪽에 빈 자리가 남아요 → 가장 긴 줄 폭으로 줄여요.
// 2) 화면 가장자리 카드에서는 상자가 화면 밖으로 나가요 → 안쪽으로 밀어 넣어요(CSS translate 라 화면별 transform 과 겹쳐도 돼요).
function fitTip(tip) {
	if (!tip || typeof document.createRange !== "function") return
	const range = document.createRange()
	if (typeof range.getClientRects !== "function") return // jsdom 등 레이아웃이 없는 환경
	tip.style.width = ""
	tip.style.translate = ""
	range.selectNodeContents(tip)
	const lines = Array.from(range.getClientRects())
	if (lines.length > 1) {
		const textWidth =
			Math.max(...lines.map((rect) => rect.right)) -
			Math.min(...lines.map((rect) => rect.left))
		const style = getComputedStyle(tip)
		const frame =
			parseFloat(style.paddingLeft) +
			parseFloat(style.paddingRight) +
			parseFloat(style.borderLeftWidth) +
			parseFloat(style.borderRightWidth)
		if (textWidth > 0) {
			tip.style.width = `${Math.ceil(textWidth + frame)}px`
			// 줄인 폭에서 줄이 다시 나뉘어 넘치거나 줄 수가 늘면 원래 폭으로 돌려요.
			const after = range.getClientRects().length
			if (tip.scrollWidth > tip.clientWidth || after > lines.length) tip.style.width = ""
		}
	}
	// 기준은 화면, 그리고 상자를 잘라 내는(overflow ≠ visible) 가장 가까운 바깥 상자 — 카드 패널 밖으로 나가도 잘려요.
	let minX = 0
	let maxX = document.documentElement.clientWidth
	for (let el = tip.parentElement; el && el !== document.body; el = el.parentElement) {
		if (getComputedStyle(el).overflowX !== "visible") {
			const clip = el.getBoundingClientRect()
			minX = Math.max(minX, clip.left)
			maxX = Math.min(maxX, clip.right)
			break
		}
	}
	const box = tip.getBoundingClientRect()
	let shift = 0
	if (box.right > maxX - EDGE) shift = maxX - EDGE - box.right
	if (box.left + shift < minX + EDGE) shift = minX + EDGE - box.left
	if (shift) tip.style.translate = `${Math.round(shift)}px 0`
}

// 제목 옆 ⓘ — 마우스를 올리거나 키보드(Tab)로 가면 설명을 보여 줘요. 화면 읽기 프로그램에는 버튼 설명(aria-describedby)으로.
// 키보드로 띄운 설명은 Esc 로 닫아요(포커스를 놓으면 사라짐). 클릭 뒤 포커스가 남아도 계속 떠 있지 않게 :focus-visible 만(SCRUM-345).
// 대시보드 KPI 카드에서 쓰던 것을 데이터·배치 운영 카드도 같이 쓰려고 꺼냈어요. 위치는 쓰는 화면 CSS 가 정해요.
export default function InfoTip({ label, text }) {
	const tipId = useId()
	const tipRef = useRef(null)
	const fit = () => fitTip(tipRef.current)
	return (
		<span className="kpi-info" onMouseEnter={fit} onFocus={fit}>
			<button
				type="button"
				className="kpi-info-button"
				aria-label={`${label} 설명`}
				aria-describedby={tipId}
				onKeyDown={(event) => event.key === "Escape" && event.currentTarget.blur()}
			>
				<Icon name="info" size={14} />
			</button>
			<span ref={tipRef} role="tooltip" id={tipId} className="kpi-info-tip">
				{text}
			</span>
		</span>
	)
}
