import { apiClient } from "../../../shared/api/apiClient"

// 감사 기록 — 메타만(본문·메모 전문·계좌번호·프롬프트 없음, NFR-COM-06). 관리자만.
// AI 호출 기록: 계약서 5.9 `GET /admin/ai-calls` (BE #69, SCRUM-134).
// 접근 기록: 계약서 5.10 `GET /admin/access-logs` (BE #102, SCRUM-168). target_id 는 화면 번호(문자열).
const toPage = (data, toItem) => ({
	items: data.items.map(toItem),
	page: data.page + 1,
	size: data.size,
	total: data.total,
	totalPages: Math.ceil(data.total / data.size),
})
// 비어 있는 필터는 보내지 않아요(서버는 빈 문자열을 형식 오류로 볼 수 있어요).
const clean = (params) =>
	Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null))

const toAiCall = (d) => ({
	id: d.id,
	endpoint: d.endpoint,
	requestId: d.request_id,
	attempt: d.attempt,
	statusCode: d.status_code ?? null,
	errorCode: d.error_code ?? null,
	durationMs: d.duration_ms,
	aiVersion: d.ai_version ?? null,
	generationId: d.generation_id ?? null,
	targetType: d.target_type ?? null,
	targetId: d.target_id ?? null,
	createdAt: d.created_at,
})

// LOGIN_FAIL 은 loginId·displayName 이 null 이고 loginIdAttempted(입력한 아이디 앞 64자)만 와요. 나머지 동작은 그 반대.
const toAccessLog = (d) => ({
	id: d.id,
	loginId: d.login_id ?? null,
	displayName: d.display_name ?? null,
	loginIdAttempted: d.login_id_attempted ?? null,
	action: d.action,
	targetType: d.target_type ?? null,
	targetId: d.target_id ?? null,
	createdAt: d.created_at,
})

export const auditApi = {
	/** from·to 는 UTC Z(from 포함·to 제외), 화면 page 는 1부터. */
	aiCalls: async ({ page = 1, size = 20, ...filters }, signal) => {
		const { data } = await apiClient.get("/api/v1/admin/ai-calls", {
			params: clean({ ...filters, page: page - 1, size }),
			signal,
		})
		return toPage(data, toAiCall)
	},
	accessLogs: async ({ page = 1, size = 20, ...filters }, signal) => {
		const { data } = await apiClient.get("/api/v1/admin/access-logs", {
			params: clean({ ...filters, page: page - 1, size }),
			signal,
		})
		return toPage(data, toAccessLog)
	},
}
