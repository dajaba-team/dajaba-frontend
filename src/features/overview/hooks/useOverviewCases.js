import { useQuery } from "@tanstack/react-query"
import { casesApi } from "../../cases/api/casesApi"

// 집계 API가 없는 동안 C1의 전체 페이지를 조회한다. API 한도는 100건이다.
// 한 페이지라도 실패하면 부분 집계를 반환하지 않고 전체 요청을 실패시킨다.
// TODO(FE-14): 페이지를 차례로 불러서 케이스가 수백 건이면 대시보드가 늦게 뜬다. BE에 상태별 건수 API가 생기면 그걸로 바꾼다.
const OVERVIEW_PAGE_SIZE = 100
// 집계만 하니 순서는 상관없다. 점수처럼 조회 중 바뀌는 칸 대신 안 바뀌는 생성 시각(BE가 같은 시각은 id로 이어 정렬)으로
// 넘겨서, 페이지 사이에 같은 케이스가 두 번 나오거나 빠지는 경우 자체를 줄인다.
const OVERVIEW_SORT = "created_at,asc"

// mine이면 내 담당만(assignee=me) — 조사역 대시보드(SCRUM-337). 승인자·관리자는 조회 가능한 전체.
export async function loadOverviewCases(signal, { mine = false } = {}) {
	const first = await casesApi.list(
		{ page: 1, size: OVERVIEW_PAGE_SIZE, sort: OVERVIEW_SORT, mine },
		signal,
	)
	const items = [...first.items]
	for (let page = 2; page <= first.totalPages; page += 1) {
		const next = await casesApi.list(
			{ page, size: first.size, sort: OVERVIEW_SORT, mine },
			signal,
		)
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

export function useOverviewCases({ mine = false, enabled = true } = {}) {
	return useQuery({
		// 승인 요청·승인 등 기존 ["cases"] 무효화에 함께 갱신된다. 범위가 다르면 다른 캐시.
		queryKey: ["cases", "overview", mine ? "mine" : "all"],
		queryFn: ({ signal }) => loadOverviewCases(signal, { mine }),
		enabled,
	})
}
