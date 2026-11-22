import "../styles/status.css"

// 상태 배지 하나로 통일 (SCRUM-332, docs/05_ui.md §2). 뜻이 같은 상태는 어느 화면이든 같은 톤이에요.
// 기호(✓ ✕ ! •)는 status.css 의 ::before 꾸밈이라 글자 내용에 섞이지 않고 읽히지도 않아요 — 상태는 늘 글자로.
const TONES = ["success", "danger", "warning", "info", "neutral"]

export default function StatusBadge({ tone = "neutral", className, children, ...rest }) {
	const safeTone = TONES.includes(tone) ? tone : "neutral"
	return (
		<span
			className={["status-badge", `is-${safeTone}`, className].filter(Boolean).join(" ")}
			{...rest}
		>
			{children}
		</span>
	)
}
