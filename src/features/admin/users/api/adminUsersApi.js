import { apiClient } from "../../../../shared/api/apiClient"

// 관리자 계정 — 계약서 5.8, BE `docs/04_auth_user.md` §7. 목록은 SCRUM-135 ①(#82), 나머지는 SCRUM-135 ②(진희).
// 상태 변경은 `POST /admin/users/{id}/{동사}`(change-role · deactivate · activate · reset-password), PATCH 없음.
// 비밀번호는 보내기만 하고 응답·상태에 남기지 않아요.
const base = "/api/v1/admin/users"
const userPath = (id) => `${base}/${encodeURIComponent(id)}`

const toUser = (data) => ({
	id: data.id,
	loginId: data.login_id,
	displayName: data.display_name,
	role: data.role,
	isActive: data.is_active,
	// 조사역 행만 진행 중 담당 건수(미결 33). 그 밖·아직 안 채운 응답은 null
	activeCaseCount: data.active_case_count ?? null,
})
// 변경 응답이 본문 없이 올 수도 있어서(204) 있으면만 바꿔요 — 화면은 성공 뒤 목록을 다시 불러요.
const maybeUser = (data) => (data && typeof data === "object" && "id" in data ? toUser(data) : null)

export const adminUsersApi = {
	/** 목록(화면 page 는 1부터). active 기본 true — 서버도 미지정이면 활성만. */
	list: async ({ role, active = true, page = 1, size = 20 } = {}, signal) => {
		const params = { is_active: active, page: page - 1, size }
		if (role) params.role = role
		const { data } = await apiClient.get(base, { params, signal })
		return {
			items: data.items.map(toUser),
			page: data.page + 1,
			size: data.size,
			total: data.total,
			totalPages: Math.ceil(data.total / data.size),
		}
	},
	activeInvestigators: async (signal) => {
		const { data } = await apiClient.get(base, {
			params: { role: "INVESTIGATOR", is_active: true, size: 100 },
			signal,
		})
		return data.items.map(toUser)
	},
	/** 발급 — 409 LOGIN_ID_TAKEN 은 아이디 칸 아래. 응답에 비밀번호 없음. */
	create: async ({ loginId, displayName, role, initialPassword }) =>
		maybeUser(
			(
				await apiClient.post(base, {
					login_id: loginId,
					display_name: displayName,
					role,
					initial_password: initialPassword,
				})
			).data,
		),
	/** 조사역 ↔ 승인자만. 진행 중 담당이 남으면 409 ASSIGNEE_HAS_ACTIVE_CASES(details.active_case_count). */
	changeRole: async ({ id, role }) =>
		maybeUser((await apiClient.post(`${userPath(id)}/change-role`, { role })).data),
	deactivate: async ({ id }) =>
		maybeUser((await apiClient.post(`${userPath(id)}/deactivate`)).data),
	activate: async ({ id }) => maybeUser((await apiClient.post(`${userPath(id)}/activate`)).data),
	resetPassword: async ({ id, newPassword }) =>
		maybeUser(
			(await apiClient.post(`${userPath(id)}/reset-password`, { new_password: newPassword }))
				.data,
		),
}
