import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { ToastContext } from "./ToastContext"

// 토스트(SCRUM-365, 「비동기 작업 알림 설계 문서」 7.4) — 최대 3개 쌓여요(넘으면 오래된 것부터). 보통은 duration 뒤에 스스로 사라지고,
// sticky 는 닫을 때까지 남아요(실패 알림). action {label, to} 를 주면 버튼이 붙고, 누르면 이동하며 닫혀요.
// 기존 호출 show({ tone, text })·dismiss() 는 그대로예요. 초점은 빼앗지 않아요 — 오류는 role="alert", 그 밖은 "status".
const MAX_TOASTS = 3

export default function ToastProvider({ children, duration = 5000 }) {
	const [toasts, setToasts] = useState([])
	const timers = useRef(new Map())
	const counter = useRef(0)

	useEffect(() => {
		const all = timers.current
		return () => all.forEach((timer) => clearTimeout(timer))
	}, [])

	// id 없이 부르면 전부 닫아요(계정이 바뀔 때 AppLayout 이 불러요)
	const dismiss = useCallback((id) => {
		if (id == null) {
			timers.current.forEach((timer) => clearTimeout(timer))
			timers.current.clear()
			setToasts([])
			return
		}
		clearTimeout(timers.current.get(id))
		timers.current.delete(id)
		setToasts((all) => all.filter((toast) => toast.id !== id))
	}, [])

	const show = useCallback(
		(next) => {
			counter.current += 1
			const id = counter.current
			const toast = {
				id,
				tone: next?.tone || "info",
				text: next?.text || "",
				sticky: Boolean(next?.sticky),
				action: next?.action ?? null,
			}
			setToasts((all) => {
				const kept = [...all, toast]
				kept.slice(0, Math.max(0, kept.length - MAX_TOASTS)).forEach((old) => {
					clearTimeout(timers.current.get(old.id))
					timers.current.delete(old.id)
				})
				return kept.slice(-MAX_TOASTS)
			})
			if (!toast.sticky)
				timers.current.set(
					id,
					setTimeout(() => dismiss(id), duration),
				)
			return id
		},
		[duration, dismiss],
	)

	return (
		<ToastContext.Provider value={{ show, dismiss }}>
			{children}
			{toasts.length > 0 && (
				<div className="toast-area">
					{toasts.map((toast) => (
						<div
							key={toast.id}
							className={`toast is-${toast.tone}`}
							role={toast.tone === "error" ? "alert" : "status"}
							aria-live={toast.tone === "error" ? "assertive" : "polite"}
						>
							<span className="toast-text">{toast.text}</span>
							{toast.action && (
								<ToastAction
									action={toast.action}
									onDone={() => dismiss(toast.id)}
								/>
							)}
							{toast.sticky && (
								<button
									type="button"
									className="toast-close"
									aria-label="알림 닫기"
									onClick={() => dismiss(toast.id)}
								>
									×
								</button>
							)}
						</div>
					))}
				</div>
			)}
		</ToastContext.Provider>
	)
}

// 이동 버튼은 따로 — 라우터 밖에서 토스트만 쓰는 화면·테스트도 깨지지 않게(링크가 있는 토스트만 라우터가 필요해요).
function ToastAction({ action, onDone }) {
	const navigate = useNavigate()
	return (
		<button
			type="button"
			className="toast-action"
			onClick={() => {
				onDone()
				navigate(action.to)
			}}
		>
			{action.label}
		</button>
	)
}
