import { useCallback, useEffect, useRef, useState } from "react"
import { ToastContext } from "./ToastContext"

// 한 번에 하나만. 새 알림이 오면 이전을 교체하고 duration 뒤에 스스로 사라집니다.
export default function ToastProvider({ children, duration = 5000 }) {
	const [toast, setToast] = useState(null)
	const timerRef = useRef(null)
	const counterRef = useRef(0)

	useEffect(() => () => clearTimeout(timerRef.current), [])

	const show = useCallback(
		(next) => {
			clearTimeout(timerRef.current)
			counterRef.current += 1
			const id = counterRef.current
			setToast({ id, tone: next?.tone || "info", text: next?.text || "" })
			timerRef.current = setTimeout(() => {
				setToast((current) => (current && current.id === id ? null : current))
			}, duration)
		},
		[duration],
	)

	const dismiss = useCallback(() => {
		clearTimeout(timerRef.current)
		setToast(null)
	}, [])

	return (
		<ToastContext.Provider value={{ show, dismiss }}>
			{children}
			{toast && (
				<div className="toast-area">
					<div
						key={toast.id}
						className={`toast is-${toast.tone}`}
						role={toast.tone === "error" ? "alert" : "status"}
						aria-live={toast.tone === "error" ? "assertive" : "polite"}
					>
						{toast.text}
					</div>
				</div>
			)}
		</ToastContext.Provider>
	)
}
