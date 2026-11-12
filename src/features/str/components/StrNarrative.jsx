import { sectionTitle } from "../../../shared/str/sectionTitles"
import { SECTION_MAX, mismatchMarks, sectionError, textLength } from "../model/strRules"
import { labelOf } from "../labels"
import { CODE_CHECKS, CODE_REASON_LABELS } from "../verificationLabels"

// 본문 글자를 밑줄 범위로 나눠 그려요. 글자로만(마크업 해석 없음).
function MarkedText({ text, marks }) {
	const parts = []
	let at = 0
	marks.forEach((mark, index) => {
		if (mark.start > at) parts.push(text.slice(at, mark.start))
		const source = mark.check.sourceValue ?? "-"
		parts.push(
			<span key={index} className="str-mismatch-wrap">
				<mark className="str-mismatch" title={`원본: ${source}`}>
					{text.slice(mark.start, mark.end)}
				</mark>
				<span className="str-mismatch-source">원본: {source}</span>
			</span>,
		)
		at = mark.end
	})
	if (at < text.length) parts.push(text.slice(at))
	return parts
}

// 검사 이름 → 화면 라벨(검증 결과 패널과 같은 표). 표에 없는 이름은 labelOf가 이름 그대로 보여 줘요.
const CODE_CHECK_LABELS = Object.fromEntries(CODE_CHECKS)

// 서술부 본문. 서버가 준 narrative 목록·순서 그대로 그리고, 섹션 개수(6·7)나 이름을 가정하지 않아요(SCRUM-115).
// AI 본문은 글자로만 그려요(dangerouslySetInnerHTML 금지, docs/06_features/str.md §1).
// editable이면 text만 고칠 수 있어요. cites·evidence_ids는 서버가 관리해서 보기만 해요(문장을 고쳐도 그대로).
//
// props
//   narrative       [{section, label, text, cites, evidenceIds}] — 서버 저장본
//   editable        true면 textarea
//   inputs          {section: text} — 편집 중 값(없는 섹션은 저장본)
//   onChange        (section, text) => void
//   failedChecks    검증에서 떨어진 코드 검사(현재 저장본 기준일 때만 넘겨요) — 해당 항목 아래 본문 값·원본 값
export default function StrNarrative({
	narrative,
	editable = false,
	inputs = {},
	onChange,
	failedChecks = [],
}) {
	if (narrative.length === 0) return <p>본문이 비어 있어요.</p>
	return (
		<>
			<nav className="str-section-index" aria-label="서술부 항목 바로 가기">
				{narrative.map((section) => (
					<a key={section.section} href={`#str-section-${section.section}`}>
						{sectionTitle(section)}
					</a>
				))}
			</nav>
			<ol className="str-sections" aria-label="서술부">
				{narrative.map((section) => {
					const headingId = `str-section-${section.section}-title`
					const value = inputs[section.section] ?? section.text
					const changed = value !== section.text
					const error = editable ? sectionError(value) : null
					const checks = failedChecks.filter((check) => check.section === section.section)
					// 밑줄은 검증한 저장본 글자 위에만 — 이 항목을 고치기 시작하면 감춰요(위치가 달라져서).
					const marks = changed ? [] : mismatchMarks(section.text, checks)
					return (
						<li key={section.section} id={`str-section-${section.section}`}>
							<article className="str-section" aria-labelledby={headingId}>
								<header>
									<h2 id={headingId}>{sectionTitle(section)}</h2>
									<code>{section.section}</code>
									{changed && <span className="str-badge">저장 안 됨</span>}
								</header>
								{editable && marks.length > 0 && (
									<p
										className="str-section-text str-section-verified"
										aria-label={`${sectionTitle(section)} 검증 결과 표시`}
									>
										<MarkedText text={section.text} marks={marks} />
									</p>
								)}
								{editable ? (
									<>
										<textarea
											className="str-section-input"
											aria-labelledby={headingId}
											aria-invalid={error ? "true" : undefined}
											value={value}
											onChange={(event) =>
												onChange(section.section, event.target.value)
											}
										/>
										<small className={error ? "str-error" : "str-muted"}>
											{error ??
												`${textLength(value).toLocaleString()} / ${SECTION_MAX.toLocaleString()}`}
										</small>
									</>
								) : (
									<p className="str-section-text">
										<MarkedText text={section.text} marks={marks} />
									</p>
								)}
								{checks.map((check, index) => (
									<p
										key={`${check.check}-${index}`}
										className="str-section-check"
										role="note"
									>
										<strong>
											{labelOf(CODE_CHECK_LABELS, check.check)} ·{" "}
											{labelOf(CODE_REASON_LABELS, check.reason)}
										</strong>{" "}
										본문 {check.draftValue ?? "-"} / 원본{" "}
										{check.sourceValue ?? "-"}
									</p>
								))}
								<p className="str-section-evidence">
									{section.evidenceIds.length > 0
										? `근거 거래 ${section.evidenceIds.length}건 · ${section.evidenceIds.join(", ")}`
										: "근거 거래 없음"}
									{section.cites.length > 0 &&
										` · 근거 사실 ${section.cites.join(", ")}`}
								</p>
							</article>
						</li>
					)
				})}
			</ol>
		</>
	)
}
