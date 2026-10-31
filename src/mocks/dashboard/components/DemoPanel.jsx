import "../styles/dashboard-demo.css"
import { useState } from "react"
import Button from "../../../shared/ui/dashboard/Button.jsx"
export default function DemoPanel({ onScenario, busy }) {
	const [open, setOpen] = useState(false)
	const scenarios = [
		["normal", "정상 조사·검증"],
		["date_mismatch", "최초 검증 날짜 불일치"],
		["edited", "본문 수정 후 재검증 필요"],
		["stale", "검증 도중 다른 탭 수정"],
		["verify_error", "초안 저장 / 검증 서비스 실패"],
		["conflict", "동시 수정 충돌"],
		["score_failure", "점수 일부 실패"],
		["rejected", "책임자 반려 후 보완"],
		["approved", "승인 완료 잠금"],
		["superseded", "대체된 초안 열람"],
	]
	return (
		<aside className={`demo-panel ${open ? "open" : ""}`}>
			<button disabled={busy} className="demo-handle" onClick={() => setOpen(!open)}>
				데모 시나리오 {open ? "접기" : "열기"}
			</button>
			{open && (
				<div>
					<p>실제 운영 화면과 구분되는 fixture 제어입니다.</p>
					<Button disabled={busy} variant="secondary" onClick={() => onScenario("reset")}>
						데모 초기화
					</Button>
					{scenarios.map(([id, label]) => (
						<Button
							disabled={busy}
							key={id}
							variant="secondary"
							onClick={() => onScenario(id)}
						>
							{label}
						</Button>
					))}
					<small>
						상태 fixture를 즉시 전환합니다. 정상 업무 버튼으로도 동일한 주요 흐름을
						시연할 수 있습니다.
					</small>
				</div>
			)}
		</aside>
	)
}
