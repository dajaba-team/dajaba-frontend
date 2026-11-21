import {
	AI_REQUEST_TIMEOUT_MS,
	ASK_REQUEST_TIMEOUT_MS,
	apiClient,
} from "../../../shared/api/apiClient"

// 케이스 API — 프론트 API 계약서 v0.2 C1~C8·A1~A7, CASES 명세 API-01~13·15.
// 백엔드 CaseController(SCRUM-106)와 같은 경로·모양이에요. 메모(A3)·메모 이력(C8)은 SCRUM-176, 요약(A7·C7)은 SCRUM-175.
// 초안 있는 종료(A6, str 컨트롤러)는 백엔드가 아직 없어 MSW가 답해요.
// 서버는 snake_case, 화면은 camelCase — 변환은 여기서 한 번만 해요.
const casePath = (caseNo) => `/api/v1/cases/${encodeURIComponent(caseNo)}`

const toUser = (data) => (data ? { loginId: data.login_id, displayName: data.display_name } : null)

// 계좌는 서버가 가린 accountNo(10_****BD30)와 구별용 accountRef만 와요. 원본 account_key는 없어요(BE 미결 19).
const toCaseSummary = (data) => ({
	caseNo: data.case_no,
	status: data.status,
	accountRef: data.account_ref ?? null,
	accountNo: data.account_no ?? null,
	assignee: toUser(data.assignee),
	// score 는 케이스 생성 당시 점수, scoreBand·policyVersion 은 지금 운영 정책으로 매긴 등급(정책 없으면 둘 다 null, 계약서 C1·BE #112).
	score: data.score ?? null,
	scoreBand: data.score_band ?? null,
	policyVersion: data.policy_version ?? null,
	rejectionReasonCode: data.rejection_reason_code ?? null,
	version: data.version,
	createdAt: data.created_at,
	// 목록 한 줄에도 상세와 같은 버튼 목록이 와요(BE #87, #23 리뷰). 상세는 아래 toCaseDetail 이 같은 키로 덮어써요.
	availableActions: data.available_actions ?? [],
})

const toHistory = (data) => ({
	action: data.action,
	fromStatus: data.from_status ?? null,
	toStatus: data.to_status,
	reasonCode: data.reason_code ?? null,
	comment: data.comment ?? null,
	createdBy: data.created_by ?? null,
	createdAt: data.created_at,
	// 담당이 바뀐 줄만 — ASSIGN은 받은 사람, REASSIGN은 둘 다, 그 밖 null (BE SCRUM-348)
	fromAssignee: toUser(data.from_assignee),
	toAssignee: toUser(data.to_assignee),
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

// 상세 aggregates (C2). 통화별 합계 — 화면은 더하거나 환산하지 않아요. 경유·자기계좌 거래는 서버가 이미 뺐어요.
const toSide = (data) => ({
	transactionCount: data?.transaction_count ?? 0,
	totals: (data?.totals ?? []).map((total) => ({
		currency: total.currency,
		amount: total.amount,
	})),
})
const toAggregates = (data) =>
	data
		? {
				transactionCount: data.transaction_count,
				inbound: toSide(data.inbound),
				outbound: toSide(data.outbound),
				firstTs: data.first_ts ?? null,
				lastTs: data.last_ts ?? null,
			}
		: null

// 거래 한 줄 (C3·C4). ts는 데이터 시각. direction은 케이스 계좌 기준 INBOUND·OUTBOUND·INDIRECT(경유).
const toTransaction = (data) => ({
	transactionId: data.transaction_id,
	fromAccountRef: data.from_account_ref,
	fromAccountNo: data.from_account_no,
	toAccountRef: data.to_account_ref,
	toAccountNo: data.to_account_no,
	ts: data.ts,
	amountPaid: data.amount_paid,
	currencyPaid: data.currency_paid,
	amountReceived: data.amount_received,
	currencyReceived: data.currency_received,
	paymentFormat: data.payment_format,
	direction: data.direction,
	scope: data.scope,
})

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

// 아직 서버가 null로 주는 칸(current_draft 등)은 화면을 만들 때 옮겨요.
const toCaseDetail = (data) => ({
	...toCaseSummary(data),
	alert: toAlert(data.alert),
	latestScore: toLatestScore(data.latest_score),
	latestSummary: toSummary(data.latest_summary),
	updatedAt: data.updated_at ?? null,
	closeReason: data.close_reason ?? null,
	investigatorNotes: data.investigator_notes ?? null,
	aggregates: toAggregates(data.aggregates),
	currentDraftNo: data.current_draft_no ?? null,
	history: (data.history ?? []).map(toHistory),
	availableActions: data.available_actions ?? [],
})

// 메모 이력 한 줄 (계약서 C8). beforeText는 바로 앞 메모(첫 기록은 null), 비운 기록은 afterText "".
const toNoteHistory = (data) => ({
	beforeText: data.before_text ?? null,
	afterText: data.after_text,
	caseVersionBefore: data.case_version_before,
	createdBy: data.created_by,
	createdAt: data.created_at,
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

// 질문 한 줄 (A8 응답·C9 목록 한 줄, 계약서 5.3). 답 속 계좌는 AI가 준 그대로(10_BD30 꼴) — 화면이 고치지 않아요.
// status: ANSWERED·NO_DATA·UNVERIFIED·OUT_OF_SCOPE. 답은 ANSWERED 일 때만, 사유는 OUT_OF_SCOPE 일 때만 와요.
const toQuestion = (data) => ({
	questionNo: data.question_no,
	caseNo: data.case_no,
	question: data.question,
	status: data.status,
	outOfScopeReason: data.out_of_scope_reason ?? null,
	answer: data.answer ?? null,
	evidenceTransactionIds: data.evidence_transaction_ids ?? [],
	askedBy: toUser(data.asked_by),
	createdAt: data.created_at,
})

export const casesApi = {
	/** 화면 page는 1부터, API page는 0부터. statuses는 배열(비면 전체), mine이면 assignee=me, from·to는 케이스 생성일(YYYY-MM-DD, 양 끝 포함). */
	list: async (
		{ statuses = [], mine = false, assignee, from, to, page = 1, size = 20, sort } = {},
		signal,
	) => {
		const params = { page: page - 1, size }
		if (statuses.length) params.status = statuses.join(",")
		// 내 담당이 먼저 — 계정 관리 [케이스 보기]의 assignee=login_id 는 그다음
		if (mine) params.assignee = "me"
		else if (assignee) params.assignee = assignee
		if (from) params.from = from
		if (to) params.to = to
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
	/** 담당자 변경(A2, ADMIN만). assignee는 새 담당 조사역 login_id, comment는 선택. */
	reassign: async ({ caseNo, version, assignee, comment }) =>
		toChange(
			(
				await apiClient.post(`${casePath(caseNo)}/reassign`, {
					assignee,
					...(comment ? { comment } : {}),
					version,
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
	/** 근거 거래(C3). scope EVIDENCE(기본)·CONTEXT, 시각 오름차순. 화면 page는 1부터. */
	transactions: async ({ caseNo, scope = "EVIDENCE", page = 1, size = 20 }, signal) => {
		const { data } = await apiClient.get(`${casePath(caseNo)}/transactions`, {
			params: { scope, page: page - 1, size },
			signal,
		})
		return {
			items: data.items.map(toTransaction),
			page: data.page + 1,
			size: data.size,
			total: data.total,
			totalPages: Math.ceil(data.total / data.size),
		}
	},
	/** 거래 원본(C4). 이 케이스의 근거 거래가 아니면 404 EVIDENCE_NOT_FOUND. */
	evidence: async ({ caseNo, transactionId }, signal) => {
		const { data } = await apiClient.get(
			`${casePath(caseNo)}/evidence/${encodeURIComponent(transactionId)}`,
			{ signal },
		)
		return {
			caseNo: data.case_no,
			transaction: toTransaction(data.transaction),
			source: {
				dataset: data.source?.dataset ?? null,
				recordId: data.source?.record_id ?? null,
				isSynthetic: data.source?.is_synthetic ?? null,
			},
			eligibleForStr: data.eligible_for_str,
		}
	},
	/** 자금 흐름 그래프(C5). 넘치면 truncated — 화면은 "전체 N건 중 M건". */
	graph: async ({ caseNo }, signal) => {
		const { data } = await apiClient.get(`${casePath(caseNo)}/graph`, { signal })
		return {
			nodes: data.nodes.map((node) => ({
				accountRef: node.account_ref,
				accountNo: node.account_no,
			})),
			edges: data.edges.map((edge) => ({
				transactionId: edge.transaction_id,
				source: edge.source,
				target: edge.target,
				amount: edge.amount,
				currency: edge.currency,
				// 금액 기준(RECEIVED 등) — 보낸·받은 금액이 다를 수 있어 어느 쪽인지 같이 와요(계약서 C5).
				amountBasis: edge.amount_basis ?? null,
				scope: edge.scope,
				ts: edge.ts,
			})),
			returnedTransactionCount: data.returned_transaction_count,
			totalTransactionCount: data.total_transaction_count,
			truncated: data.truncated,
		}
	},
	/** 상태 이력 전체(C6), 최신 먼저, 메모(NOTE) 빼고. */
	histories: async ({ caseNo, page = 1, size = 20 }, signal) => {
		const { data } = await apiClient.get(`${casePath(caseNo)}/histories`, {
			params: { page: page - 1, size },
			signal,
		})
		return {
			items: data.items.map(toHistory),
			page: data.page + 1,
			size: data.size,
			total: data.total,
			totalPages: Math.ceil(data.total / data.size),
		}
	},
	/** 메모 이력(C8), 최신 먼저. 화면 page는 1부터, API page는 0부터. */
	noteHistories: async ({ caseNo, page = 1, size = 20 }, signal) => {
		const { data } = await apiClient.get(`${casePath(caseNo)}/note-histories`, {
			params: { page: page - 1, size },
			signal,
		})
		return {
			items: data.items.map(toNoteHistory),
			page: data.page + 1,
			size: data.size,
			total: data.total,
			totalPages: Math.ceil(data.total / data.size),
		}
	},
	/** 메모 저장(A3). 같은 내용이면 서버가 그대로 두고(version 안 오름), 빈 문자열은 비우기. */
	/**
	 * AI 조사 요약 생성·갱신(A7) → 201 { case_no, summary, case_version }. 실패(502 등)면 기존 요약은 그대로예요.
	 * 백엔드가 AI를 최대 90초 기다려서 기본 15초가 아니라 AI 전용 timeout(계약서 2.6, SCRUM-315).
	 */
	refreshSummary: async ({ caseNo, version }) => {
		const { data } = await apiClient.post(
			`${casePath(caseNo)}/refresh-summary`,
			{ version },
			{ timeout: AI_REQUEST_TIMEOUT_MS },
		)
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
	/**
	 * 질문하기(A8) → 201 질문 한 줄. version 은 안 보내요(케이스를 바꾸지 않음).
	 * 질문은 앞뒤 공백도 자르지 않고 받은 그대로 보내요(BE·AI 같은 규칙, SCRUM-302). 백엔드 한도 30초라 timeout 35초.
	 */
	ask: async ({ caseNo, question }) =>
		toQuestion(
			(
				await apiClient.post(
					`${casePath(caseNo)}/questions`,
					{ question },
					{ timeout: ASK_REQUEST_TIMEOUT_MS },
				)
			).data,
		),
	/** 지난 질문(C9), 최신 먼저. 화면 page는 1부터, API page는 0부터. */
	questions: async ({ caseNo, page = 1, size = 5 }, signal) => {
		const { data } = await apiClient.get(`${casePath(caseNo)}/questions`, {
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
