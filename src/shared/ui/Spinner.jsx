import "../styles/spinner.css"

// 로딩 스피너(SCRUM-389). label은 화면 읽기 프로그램에만 읽혀요.
// size: "lg"(화면 전체) · "md"(패널·목록, 기본) · "sm"(대화상자·작은 영역)
export default function Spinner({ label = "불러오는 중", size = "md", className = "" }) {
	return (
		<div
			className={`ui-spinner ui-spinner-${size} ${className}`.trim()}
			role="status"
			aria-live="polite"
		>
			<span className="ui-spinner-ring" aria-hidden="true" />
			<span className="ui-spinner-label">{label}</span>
		</div>
	)
}
