import { sectionTitle } from "../../../shared/str/sectionTitles"
import { SECTION_MAX, sectionError, textLength } from "../model/strRules"
import { CHECK_LABELS, CHECK_REASON_LABELS, labelOf } from "../labels"

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
					return (
						<li key={section.section} id={`str-section-${section.section}`}>
							<article className="str-section" aria-labelledby={headingId}>
								<header>
									<h2 id={headingId}>{sectionTitle(section)}</h2>
									<code>{section.section}</code>
									{changed && <span className="str-badge">저장 안 됨</span>}
								</header>
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
									<p className="str-section-text">{section.text}</p>
								)}
								{checks.map((check, index) => (
									<p
										key={`${check.check}-${index}`}
										className="str-section-check"
										role="note"
									>
										<strong>
											{labelOf(CHECK_LABELS, check.check)} ·{" "}
											{labelOf(CHECK_REASON_LABELS, check.reason)}
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
