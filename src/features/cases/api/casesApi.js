import { apiClient } from "../../../shared/api/apiClient"

// 임시 개발 계약입니다. 실제 백엔드 명세 확정 후 이 모듈과 MSW를 함께 수정합니다.
export const casesApi = {
	list: async (params, signal) => (await apiClient.get("/api/cases", { params, signal })).data,
	detail: async (id, signal) =>
		(await apiClient.get(`/api/cases/${encodeURIComponent(id)}`, { signal })).data,
	saveMemo: async ({ id, memo, case_version }) =>
		(
			await apiClient.put(`/api/cases/${encodeURIComponent(id)}/memo`, {
				memo,
				case_version,
			})
		).data,
}
