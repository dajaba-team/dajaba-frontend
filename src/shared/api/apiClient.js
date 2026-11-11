import axios from "axios"

// 세션 쿠키·CSRF는 같은 출처를 전제로 합니다. 값이 없으면 같은 출처(개발은 Vite 프록시)로 보냅니다.
const baseUrl = import.meta.env.VITE_API_BASE_URL || ""

export const apiClient = axios.create({
	baseURL: baseUrl,
	timeout: 15_000,
	withCredentials: true,
	withXSRFToken: true,
	xsrfCookieName: "XSRF-TOKEN",
	xsrfHeaderName: "X-XSRF-TOKEN",
})

// AI를 기다리는 요청(초안 생성)은 백엔드 한도 90초(재시도 포함) + 여유. 03_api.md §4, FE-8 〔확인 필요: 프록시 한도〕
export const AI_REQUEST_TIMEOUT_MS = 100_000

export function isNoResponse(error) {
	return !error?.response && ["ECONNABORTED", "ETIMEDOUT", "ERR_NETWORK"].includes(error?.code)
}

export function getErrorCode(error) {
	return error.response?.data?.error?.code
}

export function isVersionConflict(error) {
	return error.response?.status === 409 && getErrorCode(error) === "CONCURRENT_UPDATE"
}

export function getErrorMessage(error) {
	const code = getErrorCode(error)
	// 로그인 실패는 없는 ID인지 비밀번호가 틀렸는지 알려 주지 않으므로 문구도 하나입니다.
	if (code === "LOGIN_FAILED") return "아이디 또는 비밀번호가 맞지 않아요."
	if (error.response?.status === 401) return "로그인이 필요합니다."
	if (isVersionConflict(error)) {
		return "다른 사용자가 먼저 변경했습니다. 작성 내용은 유지됩니다. 최신 내용을 확인한 후 다시 저장해 주세요."
	}
	if (code === "CSRF_INVALID")
		return "보안 토큰을 확인하지 못했습니다. 작성 내용은 유지됩니다. 현재 사용자를 다시 확인한 후 시도해 주세요."
	if (code === "INVALID_CASE_TRANSITION")
		return "현재 상태에서 실행할 수 없습니다. 최신 상태를 확인해 주세요."
	if (code === "NOT_ASSIGNEE") return "담당자만 할 수 있어요. 최신 상태를 확인해 주세요."
	// 역할 권한 없음(계약서 3절) — 서버 문구("권한이 없습니다")보다 화면 문구를 먼저 써요(SCRUM-200).
	if (code === "FORBIDDEN") return "실행 권한이 없어요."
	// AI 초안 생성이 이미 진행 중이라는 뜻이라 AI 장애(502)와 다르게 안내합니다.
	if (code === "DRAFT_IN_PROGRESS") return "초안을 만드는 중이에요. 잠시 후 상태를 확인해 주세요."
	if (code === "SELF_APPROVAL") return "본인이 담당한 케이스는 승인할 수 없습니다."
	if (code === "NARRATIVE_UNCHANGED") return "반려된 본문을 보완한 후 다시 요청해 주세요."
	// STR 초안 (BE str 도메인 예외 이름 → UPPER_SNAKE)
	if (code === "DRAFT_LOCKED") return "승인된 초안이라 더는 고칠 수 없어요."
	if (code === "DRAFT_SUPERSEDED")
		return "다른 초안으로 바뀌었어요. 작성 내용은 유지됩니다. 현재 초안을 확인해 주세요."
	if (code === "DRAFT_REQUEST_CLOSED")
		return "이미 끝난 초안 요청이에요. 현재 초안을 확인해 주세요."
	if (code === "INVALID_SECTION_TEXT")
		return "비어 있거나 너무 긴 항목이 있어요. 각 항목은 1~5,000자로 써 주세요."
	if (code === "REVISION_NOT_FOUND") return "해당 수정본을 찾을 수 없어요."
	if (code === "INVALID_REQUEST") return "입력 값이 올바른지 확인해 주세요."
	// NOT_FOUND는 주소 자체가 없다는 뜻(아직 서버에 없는 API)이에요. CASE_NOT_FOUND처럼 대상이 없는 것과 달라요.
	// 조회에서도 같은 문구가 떠서 "입력 유지" 안내는 넣지 않아요. 입력이 남는 건 입력칸이 보여 줘요(#12 리뷰).
	if (code === "NOT_FOUND") return "아직 서버에 없는 기능이에요."
	// AI 요약은 만들었지만 숫자·날짜·건수·계좌 검사를 통과하지 못해 저장하지 않았어요(BE RefreshCaseSummary).
	if (code === "SUMMARY_CODE_CHECK_FAILED")
		return "AI 요약이 원본 데이터 검사를 통과하지 못해 저장하지 않았어요. 다시 생성해 주세요."
	// 코드별 문구가 없으면 서버 문구를 먼저 쓰고, 없을 때만 상태별 기본 문구를 씁니다.
	const serverMessage = error.response?.data?.error?.message
	if (serverMessage) return serverMessage
	if (error.response?.status === 403) return "실행 권한이 없어요."
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
