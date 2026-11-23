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
import {
	ASK_EXAMPLES,
	QUESTION_MAX,
	SAVED_QUESTION_WINDOW_MS,
	askOutcomeText,
	questionLength,
} from "../askRules"

// 케이스 근거에 물어보기 — 계약서 A8(질문하기)·C9(지난 질문), 노션 「조사역 질문 답변 설계 문서」 8절, SCRUM-303.
// 질문 하나에 답 하나예요(이전 질문을 기억하지 않음). 질문·답 카드는 오래된 것부터 위에 쌓여요.
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
					근거 분석 <span className="ask-ai">AI</span>
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
						근거 거래 {count}건
					</button>
				)}
			</AskReply>
		</article>
	)
}

// 응답 없이 끊긴 질문이 서버에 저장됐는지 — 지금 사용자가 같은 질문을 보낸 시각 무렵(시계 차이 여유) 이후로
// 지난 질문 첫 페이지에 있으면 저장된 것으로 봐요. 같은 케이스의 다른 사람(승인자·조사역)이 같은 예시 질문을 눌러도
// 남의 기록을 내 것으로 보지 않게 login_id 도 같이 봐요.
const savedAfter = (items, question, sentAt, loginId) =>
	items.some(
		(item) =>
			item.question === question &&
			item.askedBy?.loginId === loginId &&
			Date.parse(item.createdAt) >= sentAt - SAVED_QUESTION_WINDOW_MS,
	)

/**
 * @param caseNo 케이스 번호
 * @param viewerName 지금 사용자 이름(기다리는 동안 질문 카드에 써요)
 * @param viewerLoginId 지금 사용자 login_id(응답 없이 끊긴 질문이 내 것인지 볼 때 써요)
 * @param highlightedNo 근거 강조 중인 질문 번호
 * @param onShowEvidence 답 카드의 [근거 거래 n건 보기]
 * @param onClose [닫기]
 * @param onMinimize [접기] — 창을 오른쪽 아래 버튼으로 접어요(입력·지난 질문은 그대로)
 * @param hidden 근거 거래를 보려고 접었을 때 — 입력은 그대로 남아요
 */
export default function CaseAskPanel({
	caseNo,
	viewerName,
	viewerLoginId,
	highlightedNo,
	onShowEvidence,
	onClose,
	onMinimize,
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
		? "300자 이내로 입력하세요."
		: waitSeconds > 0
			? `요청 한도를 초과했습니다. ${waitSeconds}초 후 다시 시도하세요.`
			: issue?.field
				? issue.message
				: ""

	const submit = async (event) => {
		event?.preventDefault()
		if (!ready) return
		const question = value
		const sentAt = Date.now()
		setIssue(null)
		setPage(1)
		try {
			await ask.mutateAsync({ question })
			setValue("")
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
					if (savedAfter(fresh.items, question, sentAt, viewerLoginId)) {
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
		if (
			fresh.data &&
			target &&
			savedAfter(fresh.data.items, target.question, target.sentAt, viewerLoginId)
		) {
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
	const displayItems = [...items].reverse() // C9는 최신순, 패널은 오래된 질문부터 표시
	const empty = data && data.total === 0 && !pending

	useEffect(() => {
		if (hidden || !historyRef.current) return
		historyRef.current.scrollTop = page === 1 ? historyRef.current.scrollHeight : 0
	}, [hidden, page, pending, data])

	return (
		<section
			className="ask-panel"
			role="dialog"
			aria-modal="false"
			aria-labelledby="ask-panel-title"
			hidden={hidden}
			onKeyDown={(event) => {
				// 모달처럼 Esc 로 닫아요. 화면 뒤는 막지 않아서(aria-modal=false) 표·탭은 그대로 쓸 수 있어요.
				// 보내는 중엔 닫지 않아요 — 닫으면 "근거 확인 중" 카드가 사라져 질문이 날아간 것처럼 보여요. 접기는 돼요.
				if (event.key === "Escape" && !pending) onClose()
			}}
		>
			<header className="ask-head">
				<span className="ask-head-avatar" aria-hidden="true">
					<img src={bearFace} alt="" />
				</span>
				<div className="ask-head-text">
					<h2 id="ask-panel-title" ref={titleRef} tabIndex={-1}>
						케이스 근거 질의
					</h2>
					<p>AI 응답 · 조회 전용, 본문에 반영되지 않습니다.</p>
				</div>
				<div className="ask-head-tools">
					{onMinimize && (
						<button
							type="button"
							className="ask-icon-button"
							aria-label="접기"
							title="접기"
							onClick={onMinimize}
						>
							<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
								<path d="M5 10h10" />
							</svg>
						</button>
					)}
					<button
						type="button"
						className="ask-icon-button"
						aria-label="닫기"
						title={pending ? "답변을 받는 중에는 닫을 수 없습니다." : "닫기 (Esc)"}
						disabled={pending}
						onClick={onClose}
					>
						<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
							<path d="M6 6l8 8M14 6l-8 8" />
						</svg>
					</button>
				</div>
			</header>
			<div
				className="ask-history"
				ref={historyRef}
				aria-label="질의 이력 오래된 순"
				tabIndex={0}
			>
				{questions.isPending && (
					<p className="ask-loading">질의 이력을 불러오는 중입니다.</p>
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
									케이스 근거 데이터에 대해 질의하세요. 답변의 근거가 된 거래를
									함께 제시합니다.
								</p>
							</AskReply>
						</div>
						<div className="ask-idle">
							<h3>질의 예시</h3>
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
				{(items.length > 0 || pending) && <p className="ask-kicker">질의 이력</p>}
				{displayItems.map((record) => (
					<AskCard
						key={record.questionNo}
						record={record}
						selected={highlightedNo === record.questionNo}
						onShowEvidence={onShowEvidence}
					/>
				))}
				{pending && page === 1 && (
					<article className="ask-card ask-wait">
						<AskQuestion who={viewerName} text={ask.variables?.question ?? ""} />
						<AskReply>
							<p role="status">
								근거 확인 중
								<span className="ask-dots" aria-hidden="true">
									<i />
									<i />
									<i />
								</span>
							</p>
						</AskReply>
					</article>
				)}
				{data && data.totalPages > 1 && (
					<nav className="ask-pages" aria-label="질의 이력 페이지">
						<button
							type="button"
							disabled={page <= 1}
							onClick={() => setPage(page - 1)}
						>
							최신
						</button>
						<span>
							{page} / {data.totalPages}
						</span>
						<button
							type="button"
							disabled={page >= data.totalPages}
							onClick={() => setPage(page + 1)}
						>
							이전 질의
						</button>
					</nav>
				)}
			</div>
			<form className="ask-composer" onSubmit={submit} noValidate>
				<div className={`ask-field${over ? " is-over" : ""}`}>
					<input
						id="ask-question"
						ref={inputRef}
						type="text"
						autoComplete="off"
						placeholder="질의 내용을 입력하세요"
						value={value}
						readOnly={pending}
						aria-invalid={over || undefined}
						aria-describedby="ask-counter ask-inline"
						onChange={(event) => {
							setValue(event.target.value)
							if (issue?.field) setIssue(null)
						}}
					/>
					<button
						type="submit"
						className="ask-send"
						aria-label="전송"
						title="전송 (Enter)"
						disabled={!ready}
					>
						<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
							<path d="M10 15.5v-11M5.5 9 10 4.5 14.5 9" />
						</svg>
					</button>
				</div>
				<div className="ask-meta">
					<label htmlFor="ask-question">각 질의는 이전 대화와 무관하게 처리됩니다.</label>
					<span id="ask-counter" className={`ask-counter${over ? " is-over" : ""}`}>
						{length} / {QUESTION_MAX}
					</span>
				</div>
				<p id="ask-inline" className="ask-inline" role="status">
					{inlineMessage}
				</p>
				{pending && (
					<p className="ask-progress" role="status">
						최대 30초 소요될 수 있습니다.
					</p>
				)}
				{issue?.kind === "FAIL" && (
					<div className="ask-problem" role="alert">
						<p>AI 서버가 응답하지 않습니다. 잠시 후 다시 시도하세요.</p>
						<button type="button" disabled={!ready} onClick={submit}>
							재시도
						</button>
					</div>
				)}
				{issue?.kind === "UNKNOWN" && (
					<div className="ask-problem" role="alert">
						<p>응답이 중단되었습니다. 질의 이력에서 처리 결과를 확인하세요.</p>
						<button type="button" onClick={recheck}>
							이력 새로고침
						</button>
					</div>
				)}
				{issue?.kind === "RESOLVED" && (
					<p className="ask-problem is-ok" role="status">
						응답은 중단되었으나 답변이 저장되었습니다. 질의 이력에서 확인하세요.
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
