import { apiClient } from "../../../shared/api/apiClient"

// 케이스 API — 프론트 API 계약서 v0.2 C1·C2·C7·A1·A3·A4·A5·A6·A7, CASES 명세 API-01·02·03·05·06·07·12·13.
// 백엔드 CaseController(SCRUM-106)와 같은 경로·모양이에요. 메모(A3 PUT …/notes)와 초안 있는 종료(A6, str 컨트롤러)는
// 백엔드가 아직 없어 MSW가 답해요.
// 서버는 snake_case, 화면은 camelCase — 변환은 여기서 한 번만 해요.
const casePath = (caseNo) => `/api/v1/cases/${encodeURIComponent(caseNo)}`

const toUser = (data) => (data ? { loginId: data.login_id, displayName: data.display_name } : null)

// 계좌는 서버가 가린 accountNo(010_****BD30)와 구별용 accountRef만 와요. 원본 account_key는 없어요(BE 미결 19).
const toCaseSummary = (data) => ({
	caseNo: data.case_no,
	status: data.status,
	accountRef: data.account_ref ?? null,
	accountNo: data.account_no ?? null,
	assignee: toUser(data.assignee),
	score: data.score ?? null,
	scoreBand: data.score_band ?? null,
	rejectionReasonCode: data.rejection_reason_code ?? null,
	version: data.version,
	createdAt: data.created_at,
})

const toHistory = (data) => ({
	action: data.action,
	fromStatus: data.from_status ?? null,
	toStatus: data.to_status,
	reasonCode: data.reason_code ?? null,
	comment: data.comment ?? null,
	createdBy: data.created_by ?? null,
	createdAt: data.created_at,
})

// 연결 경보 (C2 alert). window_*·reference_ts는 데이터 시각, batch_date는 날짜 — 시간대를 붙이지 않아요.
const toAlert = (data) =>
	data
		? {
				alertNo: data.alert_no,
				ruleId: data.rule_id,
				batchDate: data.batch_date,
				windowStart: data.window_start,
				windowEnd: data.window_end,
				referenceTs: data.reference_ts,
				transactionCount: data.transaction_count,
			}
		: null

// 경보의 최근 점수 (C2 latest_score). score_status는 PENDING·SCORED·FAILED, 점수 전·실패면 score 칸은 null, reasons는 [].
const toLatestScore = (data) =>
	data
		? {
				scoreStatus: data.score_status,
				score: data.score ?? null,
				scoreBand: data.score_band ?? null,
				failureCode: data.failure_code ?? null,
				modelVersion: data.model_version ?? null,
				featureVersion: data.feature_version ?? null,
				dataQualityStatus: data.data_quality_status ?? null,
				reasons: data.reasons ?? [],
			}
		: null

// AI 조사 요약 한 건 (A7·C7·상세 latest_summary 같은 모양). isCurrent: 지금 입력과 같은가, 판정 못 하면 null.
// modelFocus("모델이 주목한 점")는 관측 사실(summaryLines)과 섞지 않으려고 따로 둬요.
const toSummary = (data) =>
	data
		? {
				summaryLines: data.summary_lines ?? [],
				modelFocus: data.model_focus ?? null,
				producedAt: data.produced_at ?? null,
				generatorVersion: data.generator_version ?? null,
				basedOnCaseVersion: data.based_on_case_version ?? null,
				isCurrent: data.is_current ?? null,
			}
		: null

// 아직 서버가 null로 주는 칸(aggregates 등)은 화면을 만들 때 옮겨요.
const toCaseDetail = (data) => ({
	...toCaseSummary(data),
	alert: toAlert(data.alert),
	latestScore: toLatestScore(data.latest_score),
	latestSummary: toSummary(data.latest_summary),
	updatedAt: data.updated_at ?? null,
	closeReason: data.close_reason ?? null,
	investigatorNotes: data.investigator_notes ?? null,
	currentDraftNo: data.current_draft_no ?? null,
	history: (data.history ?? []).map(toHistory),
	availableActions: data.available_actions ?? [],
})

// 공통 변경 응답 M (계약서 5.3). 상세 전체가 아니라서 성공 뒤엔 상세를 다시 불러요.
const toChange = (data) => ({
	caseNo: data.case_no,
	status: data.status,
	assignee: toUser(data.assignee),
	rejectionReasonCode: data.rejection_reason_code ?? null,
	currentDraftNo: data.current_draft_no ?? null,
	version: data.version,
	updatedAt: data.updated_at,
})

export const casesApi = {
	/** 화면 page는 1부터, API page는 0부터. statuses는 배열(비면 전체), mine이면 assignee=me. */
	list: async ({ statuses = [], mine = false, page = 1, size = 20, sort } = {}, signal) => {
		const params = { page: page - 1, size }
		if (statuses.length) params.status = statuses.join(",")
		if (mine) params.assignee = "me"
		if (sort) params.sort = sort
		const { data } = await apiClient.get("/api/v1/cases", { params, signal })
		return {
			items: data.items.map(toCaseSummary),
			page: data.page + 1,
			size: data.size,
			total: data.total,
			totalPages: Math.ceil(data.total / data.size),
		}
	},
	detail: async (caseNo, signal) =>
		toCaseDetail((await apiClient.get(casePath(caseNo), { signal })).data),
	/** 조사역은 assignee 없이(본인), 관리자는 배정할 조사역 login_id. */
	assign: async ({ caseNo, version, assignee }) =>
		toChange(
			(
				await apiClient.post(`${casePath(caseNo)}/assign`, {
					version,
					...(assignee ? { assignee } : {}),
				})
			).data,
		),
	escalate: async ({ caseNo, version, comment }) =>
		toChange((await apiClient.post(`${casePath(caseNo)}/escalate`, { comment, version })).data),
	/** 초안 없는 종료(A5). 초안이 있으면 서버가 409 CLOSE_REQUIRES_STR. */
	close: async ({ caseNo, version, closeReason, comment }) =>
		toChange(
			(
				await apiClient.post(`${casePath(caseNo)}/close`, {
					close_reason: closeReason,
					comment,
					version,
				})
			).data,
		),
	/** 초안 있는 종료(A6) — 본문은 close와 같고, 서버가 초안을 SUPERSEDED로 바꿔요. */
	closeWithDraft: async ({ caseNo, version, closeReason, comment }) =>
		toChange(
			(
				await apiClient.post(`${casePath(caseNo)}/close-with-draft`, {
					close_reason: closeReason,
					comment,
					version,
				})
			).data,
		),
	/** AI 조사 요약 생성·갱신(A7) → 201 { case_no, summary, case_version }. 실패(502 등)면 기존 요약은 그대로예요. */
	refreshSummary: async ({ caseNo, version }) => {
		const { data } = await apiClient.post(`${casePath(caseNo)}/refresh-summary`, { version })
		return {
			caseNo: data.case_no,
			summary: toSummary(data.summary),
			version: data.case_version,
		}
	},
	/** 현재 요약(C7). 요약이 없으면 summary: null. 화면은 상세의 latestSummary를 쓰고, 이건 따로 확인할 때 써요. */
	summary: async (caseNo, signal) => {
		const { data } = await apiClient.get(`${casePath(caseNo)}/summary`, { signal })
		return { caseNo: data.case_no, summary: toSummary(data.summary) }
	},
	saveNotes: async ({ caseNo, version, investigatorNotes }) =>
		toChange(
			(
				await apiClient.put(`${casePath(caseNo)}/notes`, {
					investigator_notes: investigatorNotes,
					version,
				})
			).data,
		),
}
