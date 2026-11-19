import { useState } from "react"
import { useStrRevision, useStrRevisions } from "../hooks/useStrDraft"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemTime } from "../../../shared/format/time"
import { revisionLabel } from "../../../shared/str/revisionLabel"
import { sectionTitle } from "../../../shared/str/sectionTitles"
import { diffNarratives } from "../../../shared/str/textDiff"
import { StrDiffText } from "./StrChangeReview"

// 수정 이력 (화면 설계 STR-03 ①, 계약서 S4). 목록엔 본문이 없고, 한 수정본을 고르면 전·후 본문을 받아 나란히 보여 줘요.
// 본문 열람이 안 되는 사람(META_ONLY)에겐 이 컴포넌트를 그리지 않아요 — 목록도 부르지 않음.
export default function StrRevisionHistory({ draftNo, onClose }) {
	const list = useStrRevisions(draftNo)
	const [selected, setSelected] = useState(null)
	const detail = useStrRevision(draftNo, selected)
	return (
		<section className="str-panel" aria-labelledby="str-history-heading">
			<div className="str-panel-head str-panel-head-row">
				<h2 id="str-history-heading">수정 이력</h2>
				<button type="button" onClick={onClose}>
					닫기
				</button>
			</div>
			<AsyncState query={list} />
			{list.data && (
				<ol className="str-history">
					{list.data.items.map((item) => (
						<li key={item.revisionNo}>
							<button
								type="button"
								aria-pressed={selected === item.revisionNo}
								onClick={() => setSelected(item.revisionNo)}
							>
								{revisionLabel(item.revisionNo, item.aiOriginal)}
							</button>{" "}
							{item.revisionNo === list.data.currentRevisionNo && (
								<span className="str-badge">지금 저장본</span>
							)}{" "}
							{item.changedSections.length
								? item.changedSections.join(", ")
								: "변경 항목 없음"}{" "}
							· {item.editedBy ?? "-"} · {formatSystemTime(item.editedAt)}
						</li>
					))}
				</ol>
			)}
			{selected != null && <AsyncState query={detail} />}
			{detail.data && <RevisionDiff revision={detail.data} />}
		</section>
	)
}

// 한 수정본에서 바뀐 항목만 단어 단위로 보여 줘요(BE는 전·후 본문 전체를 줘요 — 변경 없는 항목은 숨김).
function RevisionDiff({ revision }) {
	const rows = diffNarratives(revision.narrativeBefore, revision.narrativeAfter).filter(
		(row) => row.changed,
	)
	const label = revisionLabel(revision.revisionNo, revision.aiOriginal)
	return (
		<section className="str-review" aria-label={`${label} 전·후 본문`}>
			{!revision.narrativeBefore.length ? (
				<p className="str-muted">AI가 처음 만든 본문이라 비교할 이전 본문이 없어요.</p>
			) : !rows.length ? (
				<p className="str-muted">이 수정본에서 바뀐 문장이 없어요.</p>
			) : (
				<ol className="str-review-list">
					{rows.map((row) => (
						<li key={row.section} className="str-review-file">
							<header>
								<strong>{sectionTitle(row.current)}</strong>
							</header>
							<StrDiffText segments={row.segments} />
						</li>
					))}
				</ol>
			)}
		</section>
	)
}
