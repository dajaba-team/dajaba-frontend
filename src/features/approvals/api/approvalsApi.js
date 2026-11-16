import { apiClient } from "../../../shared/api/apiClient"

// 승인함 API — 계약서 P1~P3, BE ApprovalController(SCRUM-217 목록·218 승인·219 반려, develop 구현).
// 경로 번호는 초안 번호 `draft_no`(`DRF-` + 6자리, 계약서 2.2).
// 모의 제출(P4)·PDF(S7 미리보기·S8 확정본·P5 다시 만들기)는 BE 아직 없음(SCRUM-240) — BE str.md 10~13번 모양대로 부르고,
// 지금은 MSW(`src/mocks/approvals.js`)가 답해요. BE가 붙으면 이 파일은 그대로 써요(SCRUM-111).
// 서버는 snake_case, 화면은 camelCase — 변환은 여기서 한 번만 해요.
const approvalPath = (draftNo) => `/api/v1/approvals/${encodeURIComponent(draftNo)}`
const draftPath = (draftNo) => `/api/v1/str-drafts/${encodeURIComponent(draftNo)}`

// PDF는 blob으로 받아서 오류 본문도 blob이에요 — error.code 로 분기할 수 있게 JSON으로 되돌려요(01_code_rules §5).
async function getPdf(url, signal) {
	try {
		return (await apiClient.get(url, { responseType: "blob", signal })).data
	} catch (error) {
		const body = error.response?.data
		if (body && typeof body.text === "function") {
			try {
				error.response.data = JSON.parse(await body.text())
			} catch {
				// JSON이 아니면 그대로 둬요 — 상태별 기본 문구가 나가요
			}
		}
		throw error
	}
}

const toUser = (data) => (data ? { loginId: data.login_id, displayName: data.display_name } : null)

// 승인함 한 줄(P1). 본문은 없어요 — 본문은 STR 화면(S2)에서 봐요.
// verification: 지금 초안의 최신 검증, lastRejection: 이 초안의 최신 반려(보완 요청 뒤 새 초안이면 null).
const toPending = (data) => ({
	draftNo: data.draft_no,
	caseNo: data.case_no,
	assignee: toUser(data.assignee),
	submittedAt: data.submitted_at ?? null,
	verification: data.verification
		? {
				verificationId: data.verification.verification_id,
				revisionNo: data.verification.revision_no,
				status: data.verification.status,
				passed: data.verification.passed === true,
			}
		: null,
	lastRejection: data.last_rejection
		? {
				reasonCode: data.last_rejection.reason_code,
				comment: data.last_rejection.comment,
				decidedAt: data.last_rejection.decided_at ?? null,
			}
		: null,
	caseVersion: data.case_version,
	// 내가 담당했던 케이스(자기 승인 금지) — 버튼은 available_actions 만 보고 켜요.
	wasAssignee: data.was_assignee === true,
	availableActions: data.available_actions ?? [],
})

// 승인·반려 응답 — 케이스 공통 변경 응답(계약서 5.3). 상세 전체가 아니라서 성공 뒤엔 목록을 다시 불러요.
const toChange = (data) => ({
	caseNo: data.case_no,
	status: data.status,
	rejectionReasonCode: data.rejection_reason_code ?? null,
	currentDraftNo: data.current_draft_no ?? null,
	version: data.version,
	updatedAt: data.updated_at ?? null,
})

export const approvalsApi = {
	/** P1 — 화면 page는 1부터, API page는 0부터. 정렬은 서버가 요청 오래된 순으로 고정. */
	list: async ({ page = 1, size = 20 } = {}, signal) => {
		const { data } = await apiClient.get("/api/v1/approvals", {
			params: { page: page - 1, size },
			signal,
		})
		return {
			items: data.items.map(toPending),
			page: data.page + 1,
			size: data.size,
			total: data.total,
			totalPages: Math.ceil(data.total / data.size),
		}
	},
	/** P2 — 본점 의심 정도 1~5 필수(기본값 없음, 계약서 5.5). */
	approve: async ({ draftNo, caseVersion, suspicionLevelHq }) =>
		toChange(
			(
				await apiClient.post(`${approvalPath(draftNo)}/approve`, {
					case_version: caseVersion,
					suspicion_level_hq: suspicionLevelHq,
				})
			).data,
		),
	/** P3 — reasonCode NEED_REVISION(보완 요청)·NOT_REPORTABLE(보고 안 함), comment 1~2,000자 둘 다 필수. */
	reject: async ({ draftNo, caseVersion, reasonCode, comment }) =>
		toChange(
			(
				await apiClient.post(`${approvalPath(draftNo)}/reject`, {
					case_version: caseVersion,
					reason_code: reasonCode,
					comment,
				})
			).data,
		),
	/** P4 모의 제출 — APPROVED → REPORTED. 실제 기관 전송은 없어요. 승인자만. */
	report: async ({ draftNo, caseVersion }) =>
		toChange(
			(await apiClient.post(`${approvalPath(draftNo)}/report`, { case_version: caseVersion }))
				.data,
		),
	/** S7 제출 전 미리보기 — 서버가 "제출 전" 워터마크를 찍은 PDF(저장 안 함). APPROVED 일 때. */
	previewPdf: ({ draftNo }, signal) => getPdf(`${draftPath(draftNo)}/report/preview.pdf`, signal),
	/** S8 확정본 — REPORTED 일 때. 아직이면 409 REPORT_PDF_NOT_READY(details.pdf_status PENDING·FAILED). */
	reportPdf: ({ draftNo }, signal) => getPdf(`${draftPath(draftNo)}/report.pdf`, signal),
	/** P5 PDF 다시 만들기 — PDF FAILED 일 때만, 202 {pdf_status}. */
	regeneratePdf: async ({ draftNo }) => {
		const { data } = await apiClient.post(`${approvalPath(draftNo)}/report/pdf`, {})
		return { pdfStatus: data.pdf_status }
	},
}
