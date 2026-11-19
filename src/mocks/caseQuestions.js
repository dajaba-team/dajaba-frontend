// 질문 답변 목업 — 계약서 5.3 A8·C9 모양 그대로 (BE SCRUM-302 · 규약 5.4). 질문 낱말로 상태를 골라요(BE 목업 AI 와 같은 방식).
// "고쳐·수정" → EDIT_REQUEST · "다른 고객·다른 케이스" → OUTSIDE_CASE · "세탁·보고해야" → JUDGMENT · "주소·전화" → NO_DATA
// "검증" → UNVERIFIED · "AI오류" → 502 · 그 밖 ANSWERED(근거 = 근거 거래 앞 2건, "유로·EUR"이면 Euro 거래만).

const MAX_LENGTH = 300
const RATE_LIMIT = 5
const WINDOW_MS = 60_000

let questions = [] // 전체 질문, 오래된 것부터
let seq = 40

export function resetQuestions() {
	questions = []
	seq = 40
}

/** BE CaseAction.canAsk — 승인자는 어느 케이스든, 조사역은 지금 담당만, 관리자는 안 돼요. */
export function canAsk(viewer, item) {
	if (viewer.role === "APPROVER") return true
	return viewer.role === "INVESTIGATOR" && item.assignee?.login_id === viewer.login_id
}

const fail = (status, code, message, details = {}) => ({
	status,
	body: { error: { code, message, details } },
})

// 파이썬 str.isspace 와 같은 공백 — JS \s 와 거의 같아요(BE CaseQuestion.isBlankLikePython).
const isBlank = (text) => /^[\s\u0085\u001c-\u001f]*$/.test(text)

function denied(viewer, item) {
	if (canAsk(viewer, item)) return null
	return viewer.role === "INVESTIGATOR"
		? fail(403, "NOT_ASSIGNEE", "담당 조사역만 할 수 있습니다", { case_no: item.case_no })
		: fail(403, "FORBIDDEN", "권한이 없습니다")
}

function answerOf(item, question) {
	if (/고쳐|수정/.test(question)) return { status: "OUT_OF_SCOPE", reason: "EDIT_REQUEST" }
	if (/다른 고객|다른 케이스/.test(question))
		return { status: "OUT_OF_SCOPE", reason: "OUTSIDE_CASE" }
	if (/세탁|보고해야/.test(question)) return { status: "OUT_OF_SCOPE", reason: "JUDGMENT" }
	if (/주소|전화/.test(question)) return { status: "NO_DATA" }
	if (/검증/.test(question)) return { status: "UNVERIFIED" }
	const all = item.transactions ?? []
	const picked = /유로|EUR/i.test(question)
		? all.filter((t) => t.currency_received === "Euro" || t.currency_paid === "Euro")
		: all.slice(0, 2)
	const ids = picked.map((t) => t.transaction_id)
	return {
		status: "ANSWERED",
		answer: `(예시) 이 케이스 근거 거래 중 ${ids.length}건을 확인했어요. 대상 계좌는 ${item.account_ref.replace("ACR-", "10_")}예요.`,
		ids,
	}
}

const toRow = (q) => ({
	question_no: `QST-${String(q.id).padStart(6, "0")}`,
	case_no: q.caseNo,
	question: q.question,
	status: q.status,
	out_of_scope_reason: q.reason ?? null,
	answer: q.answer ?? null,
	evidence_transaction_ids: q.ids ?? [],
	asked_by: q.askedBy,
	created_at: q.createdAt,
})

/** A8 — { status, body }. now 는 테스트가 시계를 정할 수 있게. */
export function askQuestion(viewer, item, body, now = Date.now()) {
	const no = denied(viewer, item)
	if (no) return no
	const question = body?.question
	if (typeof question !== "string" || isBlank(question))
		return fail(400, "INVALID_REQUEST", "요청 값이 올바르지 않습니다", {
			question: "질문을 입력해 주세요",
		})
	if (question.normalize("NFC").length > MAX_LENGTH)
		return fail(400, "INVALID_REQUEST", "요청 값이 올바르지 않습니다", {
			question: `질문은 ${MAX_LENGTH}자까지 쓸 수 있어요`,
		})
	const recent = questions.filter(
		(q) => q.askedBy.login_id === viewer.login_id && now - q.at < WINDOW_MS,
	)
	if (recent.length >= RATE_LIMIT) {
		const retry = Math.max(1, Math.ceil((recent[0].at + WINDOW_MS - now) / 1000))
		return fail(429, "QUESTION_RATE_LIMITED", "잠시 뒤 다시 물어봐 주세요", {
			case_no: item.case_no,
			retry_after_seconds: retry,
		})
	}
	if (/AI오류/.test(question)) return fail(502, "AI_UNAVAILABLE", "AI 서버에 연결하지 못했습니다")
	seq += 1
	const record = {
		id: seq,
		caseNo: item.case_no,
		question,
		...answerOf(item, question),
		askedBy: { login_id: viewer.login_id, display_name: viewer.display_name },
		at: now,
		createdAt: new Date(now).toISOString().replace(/\.\d{3}Z$/, "Z"),
	}
	questions.push(record)
	return { status: 201, body: toRow(record) }
}

/** C9 — 최신 먼저, 공통 목록. */
export function listQuestions(viewer, item, url) {
	const no = denied(viewer, item)
	if (no) return no
	const page = Number(url.searchParams.get("page") ?? 0)
	const size = Number(url.searchParams.get("size") ?? 20)
	const mine = questions.filter((q) => q.caseNo === item.case_no).reverse()
	return {
		status: 200,
		body: {
			items: mine.slice(page * size, (page + 1) * size).map(toRow),
			page,
			size,
			total: mine.length,
		},
	}
}
