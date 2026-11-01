import { getErrorMessage } from "../api/apiClient"

export function AsyncState({ query }) {
	if (query.isPending) return <p role="status">불러오는 중…</p>
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
