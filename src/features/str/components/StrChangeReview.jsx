import { useState } from "react"
import { useStrRevision } from "../hooks/useStrDraft"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { sectionTitle } from "../../../shared/str/sectionTitles"
import { diffNarratives, diffStats } from "../../../shared/str/textDiff"

// 지운 곳·더한 곳을 한 문단 안에 표시해요(GitHub 리뷰처럼). 글자로만 그려요.
export function StrDiffText({ segments }) {
	return (
		<p className="str-diff-text">
			{segments.map((segment, index) =>
				segment.type === "add" ? (
					<ins key={index} className="str-diff-add">
						<span className="visually-hidden">추가: </span>
						{segment.text}
					</ins>
				) : segment.type === "del" ? (
					<del key={index} className="str-diff-del">
						<span className="visually-hidden">삭제: </span>
						{segment.text}
					</del>
				) : (
					<span key={index}>{segment.text}</span>
				),
			)}
		</p>
	)
}

/**
 * 변경 비교 (화면 설계 STR-03 확장) — 기준 수정본 ↔ 지금 저장본을 항목별로 비교해요.
 * - 승인자: "반려 뒤 무엇을 고쳤나"를 바로 봐요(기본 기준 = 반려 당시 수정본, 없으면 AI 원문).
 * - 조사역: 반려 당시와 지금을 비교해 고친 곳·남은 곳을 확인해요.
 * 기준 본문은 S4 수정본 상세의 narrative_after(BE가 수정본마다 본문 전체를 저장)예요. S4는 담당 조사역·승인자만.
 *
 * props: draftNo, narrative(지금 저장본), currentRevisionNo, rejectionRevisionNo(없으면 null), onClose
 */
export default function StrChangeReview({
	draftNo,
	narrative,
	currentRevisionNo,
	rejectionRevisionNo,
	onClose,
}) {
	const options = baseOptions(currentRevisionNo, rejectionRevisionNo)
	const [baseNo, setBaseNo] = useState(options[0]?.revisionNo ?? null)
	const [showSame, setShowSame] = useState(false)
	const base = useStrRevision(draftNo, baseNo, { enabled: baseNo != null })

	if (!options.length)
		return (
			<section className="str-panel str-review" aria-label="변경 비교">
				<ReviewHead onClose={onClose} />
				<p>아직 고친 내용이 없어요. 지금 본문이 AI 원문 그대로예요.</p>
			</section>
		)

	const rows = base.data ? diffNarratives(base.data.narrativeAfter, narrative) : []
	const changed = rows.filter((row) => row.changed)
	const same = rows.filter((row) => !row.changed)
	const stats = changed.reduce(
		(sum, row) => {
			const s = diffStats(row.segments)
			return { added: sum.added + s.added, removed: sum.removed + s.removed }
		},
		{ added: 0, removed: 0 },
	)

	return (
		<section className="str-panel str-review" aria-label="변경 비교">
			<ReviewHead onClose={onClose} />
			<div className="str-review-bases" role="radiogroup" aria-label="비교 기준">
				{options.map((option) => (
					<label key={option.revisionNo}>
						<input
							type="radio"
							name="str-review-base"
							checked={baseNo === option.revisionNo}
							onChange={() => setBaseNo(option.revisionNo)}
						/>{" "}
						{option.label}
					</label>
				))}
			</div>
			<AsyncState query={base} />
			{base.data && (
				<>
					<p className="str-review-summary" role="status">
						{changed.length
							? `${changed.length}개 항목이 바뀌었어요 · 더함 ${stats.added}단어 · 지움 ${stats.removed}단어`
							: "기준과 지금 본문이 같아요."}
						<span className="str-muted">
							{" "}
							(수정본 {baseNo}번 → 수정본 {currentRevisionNo}번)
						</span>
					</p>
					<ol className="str-review-list">
						{changed.map((row) => (
							<li key={row.section} className="str-review-file">
								<header>
									<strong>{sectionTitle(row.current)}</strong>
									<span className="str-badge str-badge-changed">
										{row.base ? "바뀜" : "새 항목"}
									</span>
								</header>
								<StrDiffText segments={row.segments} />
							</li>
						))}
					</ol>
					{same.length > 0 && (
						<button
							type="button"
							className="str-link-button"
							aria-expanded={showSame}
							onClick={() => setShowSame(!showSame)}
						>
							{showSame
								? "변경 없는 항목 접기"
								: `변경 없는 항목 ${same.length}개 보기`}
						</button>
					)}
					{showSame && (
						<ul className="str-review-same">
							{same.map((row) => (
								<li key={row.section}>{sectionTitle(row.current)}</li>
							))}
						</ul>
					)}
				</>
			)}
		</section>
	)
}

function ReviewHead({ onClose }) {
	return (
		<div className="str-panel-head str-panel-head-row">
			<h2>변경 비교</h2>
			<button type="button" onClick={onClose}>
				닫기
			</button>
		</div>
	)
}

// 비교 기준 — 반려 당시(있으면 먼저) · AI 원문(수정본 1) · 직전 수정본. 지금 수정본과 같은 번호는 빼요.
export function baseOptions(currentRevisionNo, rejectionRevisionNo) {
	if (!currentRevisionNo || currentRevisionNo <= 1) return []
	const options = []
	const add = (revisionNo, label) => {
		if (revisionNo == null || revisionNo < 1 || revisionNo >= currentRevisionNo) return
		if (options.some((option) => option.revisionNo === revisionNo)) return
		options.push({ revisionNo, label })
	}
	add(rejectionRevisionNo, `반려 당시 (수정본 ${rejectionRevisionNo}번)`)
	add(1, "AI 원문 (수정본 1번)")
	add(currentRevisionNo - 1, `직전 수정본 (수정본 ${currentRevisionNo - 1}번)`)
	return options
}
