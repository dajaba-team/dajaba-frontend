// 공통 작업 바 레이아웃 — 주요 행동 1개 강조 + 보조 행동 + "누를 수 없는 이유" 한 줄 칸.
// 어떤 버튼을 켤지는 화면이 서버 응답의 available_actions로 정해요. 바는 그리기만.
export default function ActionBar({ primary, secondaries = [], reason = null }) {
	return (
		<div className="action-bar" role="toolbar" aria-label="작업 바">
			<div className="action-bar-row">
				{primary && <div className="action-bar-primary">{primary}</div>}
				{secondaries.length > 0 && (
					<div className="action-bar-secondaries">{secondaries}</div>
				)}
			</div>
			{reason && (
				<p className="action-bar-reason" role="note">
					{reason}
				</p>
			)}
		</div>
	)
}
