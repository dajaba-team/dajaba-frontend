import { useState } from "react"
import { useStrRevision, useStrRevisions } from "../hooks/useStrDraft"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemTime } from "../../../shared/format/time"
import { revisionLabel } from "../../../shared/str/revisionLabel"
import { sectionTitle } from "../../../shared/str/sectionTitles"

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

function RevisionDiff({ revision }) {
	const sections = [
		...new Set([
			...revision.narrativeBefore.map((item) => item.section),
			...revision.narrativeAfter.map((item) => item.section),
		]),
	]
	const find = (list, section) => list.find((item) => item.section === section)
	return (
		<table
			className="str-table"
			aria-label={`${revisionLabel(revision.revisionNo, revision.aiOriginal)} 전·후 본문`}
		>
			<thead>
				<tr>
					<th scope="col">항목</th>
					<th scope="col">고치기 전</th>
					<th scope="col">고친 뒤</th>
				</tr>
			</thead>
			<tbody>
				{sections.map((section) => {
					const before = find(revision.narrativeBefore, section)
					const after = find(revision.narrativeAfter, section)
					return (
						<tr key={section}>
							<th scope="row">{sectionTitle(after ?? before)}</th>
							<td className="str-pre">{before?.text ?? "(없음 — AI 원문)"}</td>
							<td className="str-pre">{after?.text ?? "-"}</td>
						</tr>
					)
				})}
			</tbody>
		</table>
	)
}
