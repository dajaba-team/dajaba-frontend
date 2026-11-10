import { apiClient } from "../../../shared/api/apiClient"

// 감사 기록 — 메타만(본문·메모 전문·계좌번호·프롬프트 없음, NFR-COM-06). 관리자만.
// AI 호출 기록: 계약서 5.9 `GET /admin/ai-calls` (BE #69, SCRUM-134).
// 접근 기록: `GET /admin/access-logs` (SCRUM-168, 진희) — 응답 모양이 아직 계약서에 없어 access_logs 칸 + 공통 목록 모양으로 가정했어요〔가정〕.
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

const toAccessLog = (d) => ({
	id: d.id,
	loginId: d.login_id ?? null,
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
