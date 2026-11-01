import { apiClient } from "../../../shared/api/apiClient"

export const authApi = {
	me: async ({ signal } = {}) => {
		try {
			const { data } = await apiClient.get("/api/v1/auth/me", { signal })
			// Spring의 전역 SNAKE_CASE를 UI 경계에서 한 번만 변환합니다.
			return {
				id: data.id,
				loginId: data.login_id,
				displayName: data.display_name,
				role: data.role,
			}
		} catch (error) {
			if (error.response?.status === 401) return null
			throw error
		}
	},
	mockLogin: async (loginId) => {
		await apiClient.post("/api/v1/auth/mock-login", null, { params: { login_id: loginId } })
	},
	logout: async () => {
		// 204에는 JSON 본문이 없습니다. 성공 여부만 확인합니다.
		await apiClient.post("/api/v1/auth/logout")
	},
}
