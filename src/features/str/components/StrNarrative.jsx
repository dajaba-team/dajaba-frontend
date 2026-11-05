import { sectionTitle } from "../sectionTitles"

// 서술부 본문. 서버가 준 narrative 목록·순서 그대로 그리고, 섹션 개수(6·7)나 이름을 가정하지 않아요(SCRUM-115).
// AI 본문은 글자로만 그려요(dangerouslySetInnerHTML 금지, docs/06_features/str.md §1).
export default function StrNarrative({ narrative }) {
	if (narrative.length === 0) return <p>본문이 비어 있어요.</p>
	return (
		<ol className="str-sections" aria-label="서술부">
			{narrative.map((section) => {
				const headingId = `str-section-${section.section}`
				return (
					<li key={section.section}>
						<article className="str-section" aria-labelledby={headingId}>
							<header>
								<h2 id={headingId}>{sectionTitle(section)}</h2>
								<code>{section.section}</code>
							</header>
							<p className="str-section-text">{section.text}</p>
							<p className="str-section-evidence">
								{section.evidenceIds.length > 0
									? `근거 거래 ${section.evidenceIds.length}건 · ${section.evidenceIds.join(", ")}`
									: "근거 거래 없음"}
							</p>
						</article>
					</li>
				)
			})}
		</ol>
	)
}
