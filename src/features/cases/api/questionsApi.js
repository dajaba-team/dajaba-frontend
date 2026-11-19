import { apiClient } from "../../../shared/api/apiClient"

// 질문 답변 API — 계약서 5.3 A8 질문하기 · 5.2 C9 지난 질문 (BE SCRUM-302, 화면 SCRUM-303).
// casesApi 와 따로 둬요 — 응답 모양(질문 한 줄)과 timeout(35초)이 케이스 작업과 달라요. 변환은 여기서 한 번만.

/** 질문하기만 백엔드 전체 30초 + 여유 (계약서 2.6 — 초안·검증·요약의 100초가 아님). */
export const ASK_REQUEST_TIMEOUT_MS = 35_000
/** 패널을 열면 최근 5개 (계약서 5.3). */
export const QUESTIONS_PAGE_SIZE = 5

const questionsPath = (caseNo) => `/api/v1/cases/${encodeURIComponent(caseNo)}/questions`

// 질문 한 줄 — A8 응답 = C9 목록 한 줄. answer 는 ANSWERED 일 때만, outOfScopeReason 은 OUT_OF_SCOPE 일 때만 와요.
const toQuestion = (data) => ({
	questionNo: data.question_no,
	caseNo: data.case_no,
	question: data.question,
	status: data.status,
	outOfScopeReason: data.out_of_scope_reason ?? null,
	answer: data.answer ?? null,
	evidenceTransactionIds: data.evidence_transaction_ids ?? [],
	askedBy: data.asked_by
		? { loginId: data.asked_by.login_id, displayName: data.asked_by.display_name }
		: null,
	createdAt: data.created_at,
})

export const questionsApi = {
	/** A8 → 201 질문 한 줄. question 은 받은 그대로(앞뒤 공백 포함) 보내요. version 은 보내지 않아요. */
	ask: async ({ caseNo, question }) =>
		toQuestion(
			(
				await apiClient.post(
					questionsPath(caseNo),
					{ question },
					{ timeout: ASK_REQUEST_TIMEOUT_MS },
				)
			).data,
		),
	/** C9 — 최신 먼저. 화면 page 는 1부터, API page 는 0부터. */
	list: async ({ caseNo, page = 1, size = QUESTIONS_PAGE_SIZE }, signal) => {
		const { data } = await apiClient.get(questionsPath(caseNo), {
			params: { page: page - 1, size },
			signal,
		})
		return {
			items: data.items.map(toQuestion),
			page: data.page + 1,
			size: data.size,
			total: data.total,
			totalPages: Math.ceil(data.total / data.size),
		}
	},
}
