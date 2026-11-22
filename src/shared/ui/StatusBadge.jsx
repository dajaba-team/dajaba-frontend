import "../styles/status.css"

// 상태 배지 하나(SCRUM-332, 05_ui.md 4절 「상태 배지」). 뜻은 다섯 가지만 —
// success 성공·완료 · danger 실패·반려 · warning 확인 필요 · info 진행 중·할 일 · neutral 대기·종료·참고.
// 글자(children)가 상태를 말해요. 색은 보조라 글자 없이 쓰지 않아요.
const STATUS_TONES = ["success", "danger", "warning", "info", "neutral"]

// className 은 자리 잡기(여백·정렬)만 — 색·모양은 status.css 가 맡아요.
export default function StatusBadge({ tone = "neutral", className, children, ...rest }) {
	const safeTone = STATUS_TONES.includes(tone) ? tone : "neutral"
	return (
		// rest 를 먼저 펼쳐요 — 부르는 쪽이 data-tone·className 을 넘겨도 safeTone·공통 클래스를 덮지 못하게.
		<span
			{...rest}
			className={className ? `status-badge ${className}` : "status-badge"}
			data-tone={safeTone}
		>
			{children}
		</span>
	)
}
