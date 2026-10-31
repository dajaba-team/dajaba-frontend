import axios from "axios"

const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080"

export const apiClient = axios.create({
	baseURL: baseUrl,
	timeout: 15_000,
	withCredentials: true,
	withXSRFToken: true,
	xsrfCookieName: "XSRF-TOKEN",
	xsrfHeaderName: "X-XSRF-TOKEN",
})

export function getErrorCode(error) {
	// 최상위 code는 기존 MSW 계약만을 위한 호환 경로입니다.
	return error.response?.data?.error?.code || error.response?.data?.code
}

export function isVersionConflict(error) {
	return (
		error.response?.status === 409 &&
		["CONCURRENT_UPDATE", "CASE_VERSION_CONFLICT"].includes(getErrorCode(error))
	)
}

export function getErrorMessage(error) {
	const code = getErrorCode(error)
	if (error.response?.status === 401) return "로그인이 필요합니다."
	if (isVersionConflict(error)) {
		return "다른 사용자가 먼저 변경했습니다. 작성 내용은 유지됩니다. 최신 내용을 확인한 후 다시 저장해 주세요."
	}
	if (code === "CSRF_INVALID")
		return "보안 토큰을 확인하지 못했습니다. 작성 내용은 유지됩니다. 현재 사용자를 다시 확인한 후 시도해 주세요."
	if (["INVALID_CASE_TRANSITION", "INVALID_TRANSITION"].includes(code))
		return "현재 상태에서 실행할 수 없습니다. 최신 상태를 확인해 주세요."
	if (code === "SELF_APPROVAL") return "본인이 담당한 케이스는 승인할 수 없습니다."
	if (code === "NARRATIVE_UNCHANGED") return "반려된 본문을 보완한 후 다시 요청해 주세요."
	if (code === "INVALID_REQUEST") return "입력 값이 올바른지 확인해 주세요."
	if (error.response?.status === 403) return "실행 권한이 없습니다."
	if (error.response?.status === 404)
		return "대상을 찾을 수 없습니다. 목록에서 다시 확인해 주세요."
	if (error.response?.status === 409)
		return "현재 업무 상태에서 처리할 수 없습니다. 최신 상태를 확인해 주세요."
	if (error.response?.status === 502)
		return "AI 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."
	if (!error.response && ["ECONNABORTED", "ETIMEDOUT", "ERR_NETWORK"].includes(error.code)) {
		return "서버 응답을 확인하지 못했습니다. 저장 요청이었다면 최신 내용을 확인한 후 다시 시도해 주세요."
	}
	return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."
}
