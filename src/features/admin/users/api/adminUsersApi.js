import { apiClient } from "../../../../shared/api/apiClient"

// 관리자 계정 목록 — BE `GET /api/v1/admin/users` (SCRUM-135 ①, #82). ADMIN만, size 최대 100, display_name 오름차순.
// 지금은 담당자 변경 확인창(SCRUM-177)이 활성 조사역 고르기에만 써요. 계정 관리 화면(SCRUM-169)이 이어서 써요.
const toUser = (data) => ({
	id: data.id,
	loginId: data.login_id,
	displayName: data.display_name,
	role: data.role,
	isActive: data.is_active,
})

export const adminUsersApi = {
	activeInvestigators: async (signal) => {
		const { data } = await apiClient.get("/api/v1/admin/users", {
			params: { role: "INVESTIGATOR", is_active: true, size: 100 },
			signal,
		})
		return data.items.map(toUser)
	},
}
