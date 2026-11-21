import { useQuery } from "@tanstack/react-query"
import { casesApi } from "../../cases/api/casesApi"

// 집계 API가 없는 동안 C1의 전체 페이지를 조회한다. API 한도는 100건이다.
// 한 페이지라도 실패하면 부분 집계를 반환하지 않고 전체 요청을 실패시킨다.
export async function loadOverviewCases(signal) {
	const first = await casesApi.list({ page: 1, size: 100, sort: "score,desc" }, signal)
	const items = [...first.items]
	for (let page = 2; page <= first.totalPages; page += 1) {
		const next = await casesApi.list({ page, size: first.size, sort: "score,desc" }, signal)
		if (next.total !== first.total) throw new Error("조회 중 케이스 수가 변경되었습니다.")
		items.push(...next.items)
	}
	// 페이지 사이에 케이스가 이동하거나 누락되면 잘못된 전체 통계 대신 재조회를 안내한다.
	if (
		items.length !== first.total ||
		new Set(items.map((item) => item.caseNo)).size !== first.total
	)
		throw new Error("전체 케이스를 확인하지 못했습니다.")
	return { items, total: first.total }
}

export function useOverviewCases() {
	return useQuery({
		// 승인 요청·승인 등 기존 ["cases"] 무효화에 함께 갱신된다.
		queryKey: ["cases", "overview"],
		queryFn: ({ signal }) => loadOverviewCases(signal),
	})
}
