import "../styles/spinner.css"

// 로딩 스피너(SCRUM-389). label은 화면 읽기 프로그램에만 읽혀요.
export default function Spinner({ label = "불러오는 중" }) {
	return (
		<div className="ui-spinner" role="status" aria-live="polite">
			<span className="ui-spinner-ring" aria-hidden="true" />
			<span className="ui-spinner-label">{label}</span>
		</div>
	)
}
