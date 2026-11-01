import { apiClient } from "../../../shared/api/apiClient"

// 연동 확인 전용 호출입니다. 업무 화면과 달리 응답을 정규화하지 않고 상태 코드·시간·원본을 그대로 돌려줍니다.
async function probe(request) {
	const started = performance.now()
	try {
		const response = await request()
		return { ok: true, status: response.status, ms: elapsed(started), data: response.data }
	} catch (error) {
		return {
			ok: false,
			status: error.response?.status ?? null,
			ms: elapsed(started),
			data: error.response?.data ?? null,
			error,
		}
	}
}

function elapsed(started) {
	return Math.round(performance.now() - started)
}

export const connectionApi = {
	baseUrl: () => apiClient.defaults.baseURL,
	health: () => probe(() => apiClient.get("/actuator/health")),
	apiDocs: () => probe(() => apiClient.get("/v3/api-docs")),
	me: () => probe(() => apiClient.get("/api/v1/auth/me")),
	mockLogin: (loginId) =>
		probe(() =>
			apiClient.post("/api/v1/auth/mock-login", null, { params: { login_id: loginId } }),
		),
	logout: () => probe(() => apiClient.post("/api/v1/auth/logout")),
	hasCsrfCookie: () => document.cookie.split("; ").some((item) => item.startsWith("XSRF-TOKEN=")),
}
