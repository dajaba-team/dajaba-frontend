import { getErrorMessage } from "../api/apiClient"

// loading을 넘기면 기본 문구 대신 그걸 보여 줘요(예: 대시보드 스피너).
export function AsyncState({ query, loading = null }) {
	if (query.isPending) return loading ?? <p role="status">불러오는 중…</p>
	if (query.isError)
		return (
			<div role="alert">
				<p>데이터를 불러오지 못했습니다.</p>
				<p>{getErrorMessage(query.error)}</p>
				<button onClick={() => query.refetch()}>다시 불러오기</button>
			</div>
		)
	return null
}
