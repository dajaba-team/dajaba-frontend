import Icon from "./dashboard/Icon"
import { pageItems } from "./pageItems"

// 공용 페이지 넘김 — 왼쪽 "전체 N건 · 1–20", 오른쪽 ‹ 1 2 3 … 7 › (SCRUM-285).
// page 는 1부터. size 를 주면 지금 보이는 범위(1–20)도 같이 보여 줘요.
export default function Pagination({
	page,
	totalPages,
	total,
	size,
	unit = "건",
	label = "페이지",
	onChange,
}) {
	const last = Math.max(totalPages, 1)
	const from = (page - 1) * size + 1
	const to = Math.min(page * size, total)
	// 주소의 page 가 마지막 쪽보다 크면(?page=5 인데 2쪽뿐) 범위가 뒤집혀요 — 그땐 범위를 빼요.
	const showRange = Boolean(size) && total > 0 && page <= last
	return (
		<nav className="pagination" aria-label={label}>
			<p className="pagination-summary" aria-live="polite">
				전체 <strong>{total}</strong>
				{unit}
				{showRange ? ` · ${from}–${to}` : ""}
			</p>
			<div className="pagination-pages">
				<button
					type="button"
					className="pagination-step"
					aria-label="이전 페이지"
					disabled={page <= 1}
					onClick={() => onChange(page - 1)}
				>
					<Icon name="chevron" size={16} />
				</button>
				{pageItems(page, last).map((item) =>
					typeof item === "number" ? (
						<button
							key={item}
							type="button"
							aria-label={`${item} 페이지`}
							aria-current={item === page ? "page" : undefined}
							onClick={() => item !== page && onChange(item)}
						>
							{item}
						</button>
					) : (
						<span key={item} className="pagination-gap" aria-hidden="true">
							…
						</span>
					),
				)}
				<button
					type="button"
					className="pagination-step is-next"
					aria-label="다음 페이지"
					disabled={page >= last}
					onClick={() => onChange(page + 1)}
				>
					<Icon name="chevron" size={16} />
				</button>
			</div>
		</nav>
	)
}
