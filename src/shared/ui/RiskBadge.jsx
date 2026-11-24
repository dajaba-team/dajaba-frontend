import "../styles/status.css"
import "../styles/risk-badge.css"

// 위험 등급 배지(SCRUM-371) — 서버 등급(HIGH·MEDIUM·LOW) 그대로 받아요. 등급이 없으면 그리지 않아요.
// 상태(진행·완료 등)는 StatusBadge, 위험 등급은 이것 하나 — 같은 뜻은 어느 화면이든 같은 색이에요.
// 글자는 --risk-*-strong(옅은 면 위 4.5:1 이상), 색만이 아니라 등급 글자를 같이 보여 줘요.
// 모양은 상태 배지와 같아요(status.css) — 점도 ::before 로 같은 크기예요.
const KNOWN = ["HIGH", "MEDIUM", "LOW"]

export default function RiskBadge({ band }) {
	if (!band) return null
	return (
		<span className="risk-badge" data-band={KNOWN.includes(band) ? band : undefined}>
			등급 {band}
		</span>
	)
}
