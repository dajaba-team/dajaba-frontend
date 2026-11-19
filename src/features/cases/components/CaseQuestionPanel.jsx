import { useId, useState } from "react"
import { getErrorCode, getErrorMessage, isNoResponse } from "../../../shared/api/apiClient"
import { formatSystemTime } from "../../../shared/format/time"
import { AsyncState } from "../../../shared/ui/AsyncState"
import Pagination from "../../../shared/ui/Pagination"
import { useAskQuestion, useCaseQuestions } from "../hooks/useCaseQuestions"
import "../styles/caseQuestions.css"

// 질문 답변 패널 [근거에 물어보기] — 계약서 5.3 A8·C9, 설계 문서 8절 (SCRUM-303).
// 질문·답 카드가 최신순으로 쌓이는 모양(대화 말풍선 아님 — 이전 질문을 기억하지 않아요). 조회만 하는 기능이에요.
// 안내 문구는 화면이 정해요(AI 가 만들지 않음). 답 속 계좌는 받은 그대로(10_BD30 꼴) 보여 줘요.

export const QUESTION_MAX_LENGTH = 300
const questionLength = (text) => text.normalize("NFC").length // 서버·STR 편집과 같은 세기

const EXAMPLE_QUESTIONS = [
	"입금 상대가 몇 곳이야?",
	"왜 이 룰에 걸렸어?",
	"모델은 뭘 보고 점수를 높게 줬어?",
]

const STATUS_TEXT = {
	NO_DATA: "이 케이스 근거에는 그 값이 없어요",
	UNVERIFIED: "근거로 확인되지 않아 답을 보여 드리지 않아요",
}
const OUT_OF_SCOPE_TEXT = {
	EDIT_REQUEST: "이 기능은 조회만 해요. 수정은 편집 화면에서 해 주세요",
	OUTSIDE_CASE: "이 케이스 근거로는 답할 수 없어요",
	JUDGMENT: "판단은 조사역과 승인자가 해요. 근거 사실만 물어봐 주세요",
}

function QuestionCard({ item, highlighted, onShowEvidence }) {
	const ids = item.evidenceTransactionIds
	const muted =
		item.status === "OUT_OF_SCOPE"
			? (OUT_OF_SCOPE_TEXT[item.outOfScopeReason] ?? "이 질문에는 답하지 않아요")
			: STATUS_TEXT[item.status]
	return (
		<li
			className={highlighted ? "question-card is-highlighted" : "question-card"}
			aria-label={`질문 ${item.questionNo}`}
		>
			<p className="question-card-q">{item.question}</p>
			{item.status === "ANSWERED" ? (
				<>
					<p className="question-card-a">{item.answer}</p>
					{ids.length > 0 && (
						<button
							type="button"
							className="question-evidence-link"
							aria-pressed={highlighted}
							onClick={() => onShowEvidence(item)}
						>
							근거 거래 {ids.length}건 보기
						</button>
					)}
				</>
			) : (
				<p className="question-card-muted">{muted}</p>
			)}
			<p className="question-card-meta">
				{item.askedBy?.displayName ?? "—"} · {formatSystemTime(item.createdAt)}
			</p>
		</li>
	)
}

/**
 * @param highlightedNo 지금 근거를 강조 중인 답의 questionNo (없으면 null)
 * @param onShowEvidence 답 카드의 "근거 거래 n건 보기" — 부모가 거래 표로 옮기고 강조해요
 */
export default function CaseQuestionPanel({ caseNo, highlightedNo, onShowEvidence, onClose }) {
	const [text, setText] = useState("")
	const [page, setPage] = useState(1)
	const [recovered, setRecovered] = useState(false)
	const inputId = useId()
	const list = useCaseQuestions(caseNo, page)
	const ask = useAskQuestion(caseNo)

	const length = questionLength(text)
	const over = length > QUESTION_MAX_LENGTH
	const blank = text.trim() === ""
	const error = ask.isError && !recovered ? ask.error : null
	const code = error ? getErrorCode(error) : null
	const details = error?.response?.data?.error?.details ?? {}
	// 입력 칸 아래에 붙는 오류 — 429(남은 초)·400(details.question). 그 밖(502 등)은 패널 안 안내 + [다시 시도]
	const fieldError =
		code === "QUESTION_RATE_LIMITED"
			? `잠시 뒤 다시 물어봐 주세요(${details.retry_after_seconds ?? 60}초)`
			: code === "INVALID_REQUEST" && details.question
				? details.question
				: null

	const send = (question) => {
		// 응답 없이 끊기면 지난 질문을 다시 불러, 맨 위가 보낸 질문이면(누르기 전과 다르면) 저장된 것으로 봐요 (계약서 2.6)
		const before = list.data?.page === 1 ? (list.data.items[0]?.questionNo ?? null) : undefined
		setRecovered(false)
		ask.mutate(
			{ question },
			{
				onSuccess: () => {
					setText("")
					setPage(1)
				},
				onError: async (err) => {
					if (!isNoResponse(err)) return
					const latest = (await list.refetch()).data?.items[0]
					if (
						latest &&
						before !== undefined &&
						latest.questionNo !== before &&
						latest.question === question
					) {
						setRecovered(true)
						setText("")
					}
				},
			},
		)
	}

	const data = list.data
	const empty = data && data.total === 0
	return (
		<aside className="case-question-panel" aria-labelledby="question-panel-title">
			<header className="question-panel-head">
				<div>
					<h2 id="question-panel-title">이 케이스 근거에 물어보기</h2>
					<p>AI 답변 · 조회만 해요. 본문에는 반영되지 않아요</p>
				</div>
				<button type="button" onClick={onClose}>
					닫기
				</button>
			</header>
			<div className="question-panel-body">
				<AsyncState query={list} />
				{empty && (
					<div className="question-examples" role="group" aria-label="예시 질문">
						<p>이렇게 물어볼 수 있어요</p>
						{EXAMPLE_QUESTIONS.map((example) => (
							<button key={example} type="button" onClick={() => setText(example)}>
								{example}
							</button>
						))}
					</div>
				)}
				{data && data.items.length > 0 && (
					<ul className="question-cards" aria-label="질문과 답">
						{data.items.map((item) => (
							<QuestionCard
								key={item.questionNo}
								item={item}
								highlighted={item.questionNo === highlightedNo}
								onShowEvidence={onShowEvidence}
							/>
						))}
					</ul>
				)}
				{data && data.totalPages > 1 && (
					<Pagination
						label="지난 질문 페이지"
						page={page}
						totalPages={data.totalPages}
						total={data.total}
						size={data.size}
						onChange={setPage}
					/>
				)}
			</div>
			<form
				className="question-form"
				aria-label="질문 보내기"
				onSubmit={(event) => {
					event.preventDefault()
					if (!blank && !over && !ask.isPending) send(text)
				}}
			>
				{ask.isPending && (
					<p role="status" className="question-pending">
						근거를 확인하는 중이에요
					</p>
				)}
				{error && !fieldError && (
					<div role="alert" className="question-error">
						<p>{getErrorMessage(error)}</p>
						{!isNoResponse(error) && (
							<button
								type="button"
								onClick={() => send(ask.variables?.question ?? text)}
							>
								다시 시도
							</button>
						)}
					</div>
				)}
				<label htmlFor={inputId} className="question-label">
					질문
				</label>
				<div className="question-input-row">
					<input
						id={inputId}
						value={text}
						placeholder="질문 하나에 답 하나예요"
						aria-invalid={over || fieldError ? true : undefined}
						aria-describedby={`${inputId}-count${fieldError ? ` ${inputId}-error` : ""}`}
						onChange={(event) => setText(event.target.value)}
					/>
					<button type="submit" disabled={blank || over || ask.isPending}>
						묻기
					</button>
				</div>
				<p
					id={`${inputId}-count`}
					className={over ? "question-count is-over" : "question-count"}
				>
					{length} / {QUESTION_MAX_LENGTH}
				</p>
				{fieldError && (
					<p id={`${inputId}-error`} role="alert" className="question-field-error">
						{fieldError}
					</p>
				)}
			</form>
		</aside>
	)
}
