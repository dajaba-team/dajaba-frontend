import { apiClient } from "../../../shared/api/apiClient"

// Spring의 전역 SNAKE_CASE를 UI 경계에서 한 번만 변환합니다. 로그인 응답도 me와 같은 모양입니다.
function toUser(data) {
	return {
		id: data.id,
		loginId: data.login_id,
		displayName: data.display_name,
		role: data.role,
	}
}

export const authApi = {
	me: async ({ signal } = {}) => {
		try {
			const { data } = await apiClient.get("/api/v1/auth/me", { signal })
			return toUser(data)
		} catch (error) {
			if (error.response?.status === 401) return null
			throw error
		}
	},
	// 실패는 401 LOGIN_FAILED 하나뿐입니다(없는 ID·틀린 비밀번호를 구분하지 않음).
	login: async ({ loginId, password }) => {
		const { data } = await apiClient.post("/api/v1/auth/login", {
			login_id: loginId,
			password,
		})
		return toUser(data)
	},
	logout: async () => {
		// 204에는 JSON 본문이 없습니다. 성공 여부만 확인합니다.
		await apiClient.post("/api/v1/auth/logout")
	},
}
