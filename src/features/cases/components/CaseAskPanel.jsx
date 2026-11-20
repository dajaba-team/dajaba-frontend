import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import bearFace from "../../../shared/assets/bear-face.png"
import {
	getErrorCode,
	getErrorMessage,
	getRetryAfterSeconds,
	isAiFailure,
	isNoResponse,
} from "../../../shared/api/apiClient"
import { formatSystemTime } from "../../../shared/format/time"
import { casesApi } from "../api/casesApi"
import { caseQuestionsKey, useAskQuestion, useCaseQuestions } from "../hooks/useCases"
import { ASK_EXAMPLES, QUESTION_MAX, askOutcomeText, questionLength } from "../askRules"

// 케이스 근거에 물어보기 — 계약서 A8(질문하기)·C9(지난 질문), 노션 「조사역 질문 답변 설계 문서」 8절, SCRUM-303.
// 질문 하나에 답 하나예요(이전 질문을 기억하지 않음). 그래서 이어지는 대화가 아니라 질문·답 카드가 최신순으로 쌓여요.
// 본문·상태·점수는 바꾸지 않는 조회 기능이라 상세를 다시 부르지 않아요.

function Bear() {
	return <img className="ask-bear" src={bearFace} alt="" aria-hidden="true" />
}

function AskQuestion({ who, at, text }) {
	return (
		<div className="ask-self">
			<span className="ask-who">
				{who}
				{at && ` · ${at}`}
			</span>
			<h3 className="ask-q">{text}</h3>
		</div>
	)
}

function AskReply({ children }) {
	return (
		<div className="ask-reply">
			<Bear />
			<div>
				<p className="ask-name">
					근거 도우미 <span className="ask-ai">AI</span>
				</p>
				<div className="ask-bubble">{children}</div>
			</div>
		</div>
	)
}

function AskCard({ record, selected, onShowEvidence }) {
	const answered = record.status === "ANSWERED"
	const count = record.evidenceTransactionIds.length
	return (
		<article className={`ask-card${selected ? " is-selected" : ""}`}>
			<AskQuestion
				who={record.askedBy?.displayName ?? "알 수 없음"}
				at={formatSystemTime(record.createdAt)}
				text={record.question}
			/>
			<AskReply>
				{answered ? (
					<p>{record.answer}</p>
				) : (
					<p className="ask-neutral">{askOutcomeText(record)}</p>
				)}
				{answered && count > 0 && (
					<button
						type="button"
						className="ask-source"
						aria-pressed={selected}
						onClick={() => onShowEvidence(record)}
					>
						근거 거래 {count}건 보기
					</button>
				)}
			</AskReply>
		</article>
	)
}

// 응답 없이 끊긴 질문이 서버에 저장됐는지 — 같은 질문이 보낸 시각 이후로 지난 질문 첫 페이지에 있으면 저장된 것으로 봐요.
const savedAfter = (items, question, sentAt) =>
	items.some((item) => item.question === question && Date.parse(item.createdAt) >= sentAt - 5_000)

/**
 * @param caseNo 케이스 번호
 * @param viewerName 지금 사용자 이름(기다리는 동안 질문 카드에 써요)
 * @param highlightedNo 근거 강조 중인 질문 번호
 * @param onShowEvidence 답 카드의 [근거 거래 n건 보기]
 * @param onClose [닫기]
 * @param hidden 근거 거래를 보려고 접었을 때 — 입력은 그대로 남아요
 */
export default function CaseAskPanel({
	caseNo,
	viewerName,
	highlightedNo,
	onShowEvidence,
	onClose,
	hidden = false,
}) {
	const client = useQueryClient()
	const [value, setValue] = useState("")
	const [page, setPage] = useState(1)
	// 패널 안 안내: FAIL(502) · UNKNOWN(응답 없음, 저장 여부 모름) · RESOLVED(끊겼지만 저장됨) · { message }(그 밖)
	const [issue, setIssue] = useState(null)
	const [retryUntil, setRetryUntil] = useState(0)
	const [now, setNow] = useState(() => Date.now())
	const titleRef = useRef(null)
	const historyRef = useRef(null)
	const inputRef = useRef(null)
	const questions = useCaseQuestions(caseNo, page)
	const ask = useAskQuestion(caseNo)

	useEffect(() => {
		titleRef.current?.focus({ preventScroll: true })
	}, [])

	// 429 남은 초 세기 — 다 지나면 멈춰요.
	useEffect(() => {
		if (retryUntil <= Date.now()) return undefined
		const timer = setInterval(() => {
			const current = Date.now()
			setNow(current)
			if (current >= retryUntil) clearInterval(timer)
		}, 500)
		return () => clearInterval(timer)
	}, [retryUntil])

	const length = questionLength(value)
	const over = length > QUESTION_MAX
	const waitSeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000))
	const pending = ask.isPending
	const ready = length > 0 && !over && value.trim() !== "" && !pending && waitSeconds === 0
	const inlineMessage = over
		? "질문을 300자 이내로 줄여 주세요."
		: waitSeconds > 0
			? `잠시 뒤 다시 물어봐 주세요 (${waitSeconds}초).`
			: issue?.field
				? issue.message
				: ""

	const scrollTop = () => {
		if (historyRef.current) historyRef.current.scrollTop = 0
	}

	const submit = async (event) => {
		event?.preventDefault()
		if (!ready) return
		const question = value
		const sentAt = Date.now()
		setIssue(null)
		setPage(1)
		scrollTop()
		try {
			await ask.mutateAsync({ question })
			setValue("")
			scrollTop()
		} catch (error) {
			const seconds = getRetryAfterSeconds(error)
			if (error?.response?.status === 429) {
				const until = Date.now() + (seconds ?? 10) * 1000
				setNow(Date.now())
				setRetryUntil(until)
				return
			}
			if (isNoResponse(error)) {
				// 실패로 단정하지 않고 지난 질문을 다시 불러 확인해요(설계 8.3).
				try {
					const fresh = await client.fetchQuery({
						queryKey: [...caseQuestionsKey(caseNo), 1],
						queryFn: ({ signal }) =>
							casesApi.questions({ caseNo, page: 1, size: 5 }, signal),
						staleTime: 0,
					})
					if (savedAfter(fresh.items, question, sentAt)) {
						setValue("")
						setIssue({ kind: "RESOLVED" })
						return
					}
				} catch {
					// 다시 불러오기도 실패하면 아래 안내로
				}
				setIssue({ kind: "UNKNOWN", question, sentAt })
				return
			}
			if (isAiFailure(error) || error?.response?.status === 502) {
				setIssue({ kind: "FAIL" })
				return
			}
			const field = getErrorCode(error) === "INVALID_REQUEST"
			setIssue({ kind: "MESSAGE", field, message: getErrorMessage(error) })
		}
	}

	const recheck = async () => {
		const target = issue
		const fresh = await questions.refetch()
		setPage(1)
		if (fresh.data && target && savedAfter(fresh.data.items, target.question, target.sentAt)) {
			if (value === target.question) setValue("")
			setIssue({ kind: "RESOLVED" })
		}
	}

	const fillExample = (text) => {
		if (pending) return
		setValue(text)
		inputRef.current?.focus()
	}

	const data = questions.data
	const items = data?.items ?? []
	const empty = data && data.total === 0 && !pending

	return (
		<section
			className="ask-panel"
			role="dialog"
			aria-modal="false"
			aria-labelledby="ask-panel-title"
			hidden={hidden}
			onKeyDown={(event) => {
				// 모달처럼 Esc 로 닫아요. 화면 뒤는 막지 않아서(aria-modal=false) 표·탭은 그대로 쓸 수 있어요.
				if (event.key === "Escape") onClose()
			}}
		>
			<header className="ask-head">
				<div>
					<h2 id="ask-panel-title" ref={titleRef} tabIndex={-1}>
						이 케이스 근거에 물어보기
					</h2>
					<p>AI 답변 · 조회만 해요. 본문에는 반영되지 않아요.</p>
				</div>
				<button type="button" className="ask-close" onClick={onClose}>
					닫기
				</button>
			</header>
			<div
				className="ask-history"
				ref={historyRef}
				aria-label="질문과 답변 최신순"
				tabIndex={0}
			>
				{questions.isPending && (
					<p className="ask-loading">지난 질문을 불러오는 중이에요.</p>
				)}
				{questions.isError && (
					<div className="ask-problem" role="alert">
						<p>{getErrorMessage(questions.error)}</p>
						<button type="button" onClick={() => questions.refetch()}>
							다시 불러오기
						</button>
					</div>
				)}
				{empty && (
					<>
						<div className="ask-welcome">
							<AskReply>
								<p>
									이 케이스에서 궁금한 점을 물어보세요. 답을 뒷받침하는 거래가
									있으면 함께 보여드려요.
								</p>
							</AskReply>
						</div>
						<div className="ask-idle">
							<h3>이런 질문을 할 수 있어요</h3>
							<div className="ask-examples">
								{ASK_EXAMPLES.map((text) => (
									<button
										key={text}
										type="button"
										onClick={() => fillExample(text)}
									>
										{text}
									</button>
								))}
							</div>
						</div>
					</>
				)}
				{(items.length > 0 || pending) && <p className="ask-kicker">질문 이력 · 최신순</p>}
				{pending && page === 1 && (
					<article className="ask-card ask-wait">
						<AskQuestion who={viewerName} text={ask.variables?.question ?? ""} />
						<AskReply>
							<p role="status">
								근거를 확인하는 중이에요
								<span className="ask-dots" aria-hidden="true">
									<i />
									<i />
									<i />
								</span>
							</p>
						</AskReply>
					</article>
				)}
				{items.map((record) => (
					<AskCard
						key={record.questionNo}
						record={record}
						selected={highlightedNo === record.questionNo}
						onShowEvidence={onShowEvidence}
					/>
				))}
				{data && data.totalPages > 1 && (
					<nav className="ask-pages" aria-label="지난 질문 페이지">
						<button
							type="button"
							disabled={page <= 1}
							onClick={() => setPage(page - 1)}
						>
							최신 쪽
						</button>
						<span>
							{page} / {data.totalPages}
						</span>
						<button
							type="button"
							disabled={page >= data.totalPages}
							onClick={() => setPage(page + 1)}
						>
							지난 질문 더 보기
						</button>
					</nav>
				)}
			</div>
			<form className="ask-composer" onSubmit={submit} noValidate>
				<label htmlFor="ask-question">이전 질문과 별개로, 한 번에 하나씩 물어보세요.</label>
				<div className="ask-row">
					<input
						id="ask-question"
						ref={inputRef}
						type="text"
						autoComplete="off"
						placeholder="이 케이스에서 무엇을 확인할까요?"
						value={value}
						readOnly={pending}
						aria-invalid={over || undefined}
						aria-describedby="ask-counter ask-inline"
						onChange={(event) => {
							setValue(event.target.value)
							if (issue?.field) setIssue(null)
						}}
					/>
					<button type="submit" disabled={!ready}>
						묻기
					</button>
				</div>
				<p id="ask-counter" className={`ask-counter${over ? " is-over" : ""}`}>
					{length} / {QUESTION_MAX}
				</p>
				<p id="ask-inline" className="ask-inline" role="status">
					{inlineMessage}
				</p>
				{pending && (
					<p className="ask-progress" role="status">
						답변에 최대 30초 걸릴 수 있어요.
					</p>
				)}
				{issue?.kind === "FAIL" && (
					<div className="ask-problem" role="alert">
						<p>AI 서버 응답이 없어요. 잠시 후 다시 시도해 주세요.</p>
						<button type="button" disabled={!ready} onClick={submit}>
							다시 시도
						</button>
					</div>
				)}
				{issue?.kind === "UNKNOWN" && (
					<div className="ask-problem" role="alert">
						<p>응답이 끊겼어요. 지난 질문에서 처리 결과를 확인해 주세요.</p>
						<button type="button" onClick={recheck}>
							지난 질문 다시 불러오기
						</button>
					</div>
				)}
				{issue?.kind === "RESOLVED" && (
					<p className="ask-problem is-ok" role="status">
						응답은 끊겼지만 답이 저장돼 있었어요. 위 지난 질문에서 확인해 주세요.
					</p>
				)}
				{issue?.kind === "MESSAGE" && !issue.field && (
					<p className="ask-problem" role="alert">
						{issue.message}
					</p>
				)}
			</form>
		</section>
	)
}
