// 보여 줄 페이지 번호 — 처음·끝·지금 앞뒤 한 칸, 그 사이가 비면 "…".
// 예) 10쪽 중 5쪽 → 1 … 4 5 6 … 10
export function pageItems(page, totalPages) {
	const pages = new Set([1, totalPages, page - 1, page, page + 1])
	const sorted = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b)
	const items = []
	sorted.forEach((n, i) => {
		const prev = sorted[i - 1]
		if (prev != null && n - prev === 2) items.push(prev + 1)
		else if (prev != null && n - prev > 2) items.push(`gap-${n}`)
		items.push(n)
	})
	return items
}
