import { useEffect, useId, useRef } from "react"
import Icon from "./Icon"

export default function Modal({ title, children, onClose, footer }) {
	const titleId = useId()
	const dialog = useRef(null)
	const close = useRef(onClose)
	useEffect(() => {
		close.current = onClose
	}, [onClose])
	useEffect(() => {
		const previous = document.activeElement
		const container = dialog.current
		const focusable = () => [
			...container.querySelectorAll(
				'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
			),
		]
		const initial = container.querySelector("[autofocus]") || focusable()[0] || container
		initial.focus()
		const handleKey = (event) => {
			if (event.key === "Escape") {
				event.preventDefault()
				close.current()
				return
			}
			if (event.key !== "Tab") return
			const items = focusable()
			if (!items.length) {
				event.preventDefault()
				container.focus()
				return
			}
			const first = items[0],
				last = items[items.length - 1]
			if (
				event.shiftKey &&
				(document.activeElement === first || document.activeElement === container)
			) {
				event.preventDefault()
				last.focus()
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault()
				first.focus()
			}
		}
		// 모달 안에 키보드 포커스를 유지하고 닫은 뒤 원래 조작 요소로 돌려줍니다.
		container.addEventListener("keydown", handleKey)
		return () => {
			container.removeEventListener("keydown", handleKey)
			previous?.focus()
		}
	}, [])
	return (
		<div
			className="modal-backdrop"
			role="presentation"
			onMouseDown={(event) => event.target === event.currentTarget && onClose()}
		>
			<section
				className="modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				ref={dialog}
				tabIndex={-1}
			>
				<header>
					<h2 id={titleId}>{title}</h2>
					<button className="icon-button" onClick={onClose} aria-label="닫기">
						<Icon name="close" />
					</button>
				</header>
				<div className="modal-body">{children}</div>
				{footer && <footer>{footer}</footer>}
			</section>
		</div>
	)
}
