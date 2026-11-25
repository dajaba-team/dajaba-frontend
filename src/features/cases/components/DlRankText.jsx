import { describeDlRank } from "../dlRank"

// ML+DL 조사 순위 한 칸(SCRUM-420) — 목록 표·상세 정보 카드에서 같이 써요.
// 위 줄은 결합 순위(또는 "순위 없음"·"순위 조회 불가"), 아래 작은 줄은 ML 순위·이유예요.
export default function DlRankText({ rank }) {
	const { text, note, unavailable } = describeDlRank(rank)
	return (
		<span className={unavailable ? "dl-rank dl-rank-unavailable" : "dl-rank"}>
			<span className="dl-rank-main">{text}</span>
			{note && <span className="dl-rank-note">{note}</span>}
		</span>
	)
}
