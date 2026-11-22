// S2 초안 응답에 포함된 참고 사례만 표시해요. 검색·본문 조회 기능은 이 패널의 범위가 아닙니다.
export default function StrReferencePanel({ references = [] }) {
	const items = Array.isArray(references) ? references : []

	return (
		<section className="str-panel" aria-labelledby="str-reference-heading">
			<div className="str-panel-head">
				<h2 id="str-reference-heading">참고 사례</h2>
				<p>초안 작성에 참고한 유사 사례</p>
			</div>

			{items.length === 0 ? (
				<p className="str-muted">연결된 참고 사례가 없어요.</p>
			) : (
				<ul className="str-reference-list">
					{items.map((reference, index) => (
						<li
							className="str-reference-card"
							key={reference.chunkId ?? `${reference.docId ?? "reference"}-${index}`}
						>
							<p className="str-reference-title">
								{reference.docTitle || "문서명 정보 없음"}
							</p>
							<p className="str-reference-meta">
								<span>
									{reference.page != null
										? `PDF ${reference.page}쪽`
										: "PDF 쪽 정보 없음"}
								</span>
								<span>
									유사도{" "}
									{typeof reference.score === "number"
										? reference.score.toFixed(2)
										: "정보 없음"}
								</span>
							</p>
						</li>
					))}
				</ul>
			)}

			<p className="str-reference-note">원문은 해당 문서의 쪽에서 확인해 주세요</p>
		</section>
	)
}
