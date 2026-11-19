// 조사역 질문 답변 MSW 대역 — 계약서 5.3 A8 질문하기·C9 지난 질문, 3절 429 QUESTION_RATE_LIMITED (SCRUM-289·303).
// 설계 문서 「조사역 질문 답변」 7.1~7.3·8.2절과 같은 모양이에요. 백엔드(SCRUM-302)·AI(SCRUM-290)는 아직 없어요 〔초안〕.
//
// 오류 순서: 404 CASE_NOT_FOUND → 400 질문 길이 → 403 NOT_ASSIGNEE·FORBIDDEN → 429 → (AI) 502.
// AI 답은 질문 글자로 정해요(실제 AI 흉내가 아니라 화면 상태를 골고루 보려는 것):
//   - "고쳐"·"수정"            → OUT_OF_SCOPE · EDIT_REQUEST
//   - "다른 케이스"·"다른 고객" → OUT_OF_SCOPE · OUTSIDE_CASE
//   - "세탁"·"보고해야"         → OUT_OF_SCOPE · JUDGMENT
//   - "직업"·"업종"·"나이"      → NO_DATA
//   - "제일 큰"·"가장 큰"        → UNVERIFIED (답이 코드 검사에서 어긋남 — 답 본문 안 나감)
//   - "[502]"                  → 502 AI_UNAVAILABLE (기록 안 남음)
//   - 그 밖                    → ANSWERED (입금·출금이 들어가면 그 방향 거래만 근거)
// 답 속 계좌는 AI가 가린 모양 그대로예요(13절 8번, 10_BD30 꼴) — 화면 다른 곳의 10_****BD30과 달라요.

export const QUESTION_MAX = 300
export const QUESTIONS_PER_MINUTE = 5

// 백엔드 aml.ai.ask-enabled — 서버 기본은 false지만 MSW는 화면을 만들려고 켜 둬요(resetCases 옵션으로 끌 수 있어요).
let askEnabled = true
export const setAskEnabled = (value) => {
	askEnabled = value
}

/** 질문할 수 있는 사람 — 담당 조사역·승인자. 케이스 상태와는 상관없어요(7.2절). */
export function canAsk(viewer, item) {
	if (!askEnabled || !viewer || !item) return false
	if (viewer.role === "APPROVER") return true
	return viewer.role === "INVESTIGATOR" && item.assignee?.login_id === viewer.login_id
}

const fail = (status, code, message, details = {}) => ({
	status,
	body: { error: { code, message, details } },
})

/** 글자 수는 NFC 뒤 UTF-16 코드 단위(STR 수정본·AI와 같은 규칙). 앞뒤 공백은 자르지 않아요. */
export const questionLength = (text) => text.normalize("NFC").length

const questionNo = (n) => `QST-${String(n).padStart(6, "0")}`

const row = (n, caseNo, question, status, extra, askedBy, createdAt) => ({
	question_no: questionNo(n),
	case_no: caseNo,
	question,
	status,
	out_of_scope_reason: null,
	answer: null,
	evidence_transaction_ids: [],
	asked_by: askedBy,
	created_at: createdAt,
	...extra,
})

/** 지난 질문 예시 — CASE-2022-001001(담당 inv01)에 상태별로 한 줄씩. 최신이 앞이에요. */
export function seedQuestions() {
	const inv01 = { login_id: "inv01", display_name: "예시 inv01" }
	const apr01 = { login_id: "apr01", display_name: "예시 apr01" }
	const caseNo = "CASE-2022-001001"
	return {
		next: 46,
		items: [
			row(
				45,
				caseNo,
				"제일 큰 거래는 얼마야?",
				"UNVERIFIED",
				{},
				inv01,
				"2026-11-02T03:30:00Z",
			),
			row(
				44,
				caseNo,
				"이 계좌 세탁 맞아?",
				"OUT_OF_SCOPE",
				{ out_of_scope_reason: "JUDGMENT" },
				apr01,
				"2026-11-02T03:20:00Z",
			),
			row(43, caseNo, "고객 직업이 뭐야?", "NO_DATA", {}, inv01, "2026-11-02T03:10:00Z"),
			row(
				42,
				caseNo,
				"EUR로 들어온 건 얼마야?",
				"ANSWERED",
				{
					answer: "경유 거래 1건이 EUR 4,600로 확인돼요. 대상 계좌로 직접 들어온 EUR 거래는 없어요.",
					evidence_transaction_ids: [5102],
				},
				inv01,
				"2026-11-02T03:00:00Z",
			),
			row(
				41,
				caseNo,
				"입금 상대가 몇 곳이야?",
				"ANSWERED",
				{
					answer: "입금 상대 계좌는 1개예요(33_A901).",
					evidence_transaction_ids: [5103],
				},
				inv01,
				"2026-11-02T02:50:00Z",
			),
		],
	}
}

const has = (text, words) => words.some((word) => text.includes(word))

/** 가짜 AI — 질문 글자로 상태를 골라요. null이면 502(AI 연동 실패)예요. */
function fakeAi(item, question) {
	if (question.includes("[502]")) return null
	if (has(question, ["고쳐", "수정"]))
		return { status: "OUT_OF_SCOPE", out_of_scope_reason: "EDIT_REQUEST" }
	if (has(question, ["다른 케이스", "다른 고객"]))
		return { status: "OUT_OF_SCOPE", out_of_scope_reason: "OUTSIDE_CASE" }
	if (has(question, ["세탁", "보고해야"]))
		return { status: "OUT_OF_SCOPE", out_of_scope_reason: "JUDGMENT" }
	if (has(question, ["직업", "업종", "나이"])) return { status: "NO_DATA" }
	if (has(question, ["제일 큰", "가장 큰"])) return { status: "UNVERIFIED" }
	const all = (item.transactions ?? []).filter((tx) => tx.scope === "EVIDENCE")
	const direction = question.includes("입금")
		? "INBOUND"
		: question.includes("출금") || question.includes("보낸")
			? "OUTBOUND"
			: null
	const picked = direction ? all.filter((tx) => tx.direction === direction) : all
	const answer = direction
		? `${direction === "INBOUND" ? "입금" : "출금"} 거래는 ${picked.length}건이에요.`
		: question.includes("왜") || question.includes("모델")
			? "모델이 주목한 점: 24시간 동안 입금 상대 계좌 수가 평소보다 많았어요."
			: `근거 거래는 모두 ${picked.length}건이에요.`
	return {
		status: "ANSWERED",
		answer,
		evidence_transaction_ids: picked.map((tx) => tx.transaction_id),
	}
}

function guard(item) {
	if (!item) return fail(404, "CASE_NOT_FOUND", "케이스가 없습니다")
	return null
}

function permission(viewer, item) {
	if (viewer.role === "ADMIN") return fail(403, "FORBIDDEN", "권한이 없습니다")
	if (!canAsk(viewer, item)) return fail(403, "NOT_ASSIGNEE", "담당 조사역만 할 수 있습니다")
	return null
}

/**
 * A8 질문하기. store는 seedQuestions() 모양({ next, items }) — 성공하면 맨 앞에 한 줄을 넣어요.
 * 성공이면 { status: 201, body: 질문 한 줄 }, 실패면 { status, body: 에러 }.
 * nowMs는 시험용 — 안 주면 지금 시각.
 */
export function askQuestion(viewer, item, body, store, nowMs = Date.now()) {
	const missing = guard(item)
	if (missing) return missing
	const question = body?.question
	if (typeof question !== "string" || !question.trim())
		return fail(400, "INVALID_REQUEST", "질문을 입력해 주세요", {
			question: "질문을 입력해 주세요",
		})
	if (questionLength(question) > QUESTION_MAX)
		return fail(400, "INVALID_REQUEST", "질문은 300자까지 쓸 수 있어요", {
			question: "질문은 300자까지 쓸 수 있어요",
		})
	const denied = permission(viewer, item)
	if (denied) return denied
	// 최근 60초 본인 질문 수(DB 건수로 세기, 7.4절). 502는 행이 없어서 안 세요.
	const recent = store.items
		.filter((entry) => entry.asked_by.login_id === viewer.login_id)
		.map((entry) => Date.parse(entry.created_at))
		.filter((at) => nowMs - at < 60_000)
	if (recent.length >= QUESTIONS_PER_MINUTE) {
		const oldest = Math.min(...recent)
		return fail(429, "QUESTION_RATE_LIMITED", "잠시 뒤 다시 물어봐 주세요", {
			retry_after_seconds: Math.max(1, Math.ceil((oldest + 60_000 - nowMs) / 1000)),
		})
	}
	const ai = fakeAi(item, question)
	if (!ai) return fail(502, "AI_UNAVAILABLE", "AI 서버에 연결하지 못했습니다")
	const created = row(
		store.next,
		item.case_no,
		question,
		ai.status,
		{
			out_of_scope_reason: ai.out_of_scope_reason ?? null,
			answer: ai.answer ?? null,
			evidence_transaction_ids: ai.evidence_transaction_ids ?? [],
		},
		{ login_id: viewer.login_id, display_name: viewer.display_name },
		new Date(nowMs).toISOString().replace(/\.\d{3}Z$/, "Z"),
	)
	store.next += 1
	store.items = [created, ...store.items]
	return { status: 201, body: created }
}

/** C9 지난 질문 — 그 케이스 것만, 최신순, 공통 목록. 권한은 A8과 같아요. */
export function listQuestions(viewer, item, url, store) {
	const missing = guard(item)
	if (missing) return missing
	const denied = permission(viewer, item)
	if (denied) return denied
	const page = Number(url.searchParams.get("page") ?? 0)
	const size = Number(url.searchParams.get("size") ?? 20)
	if (!Number.isInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 100)
		return fail(400, "INVALID_REQUEST", "page·size 값이 올바르지 않습니다", {
			parameter: "size",
		})
	const mine = store.items
		.filter((entry) => entry.case_no === item.case_no)
		.sort((a, b) => b.created_at.localeCompare(a.created_at))
	return {
		status: 200,
		body: { items: mine.slice(page * size, (page + 1) * size), page, size, total: mine.length },
	}
}
