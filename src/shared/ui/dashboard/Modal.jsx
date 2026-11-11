import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import Icon from "./Icon"
import "./modal.css"

// 원래 조작 요소를 렌더 단계에서 잡아, 닫을 때 그 자리로 포커스를 돌려줘요.
// 처음 포커스: 본문에 입력칸이 있으면 첫 입력칸 → 없으면 [확인](.primary 켜졌을 때) → 그것도 아니면 footer 첫 조작 요소.
const FOCUSABLE =
	'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
const BODY_INPUT =
	'input:not(:disabled):not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select:not(:disabled), textarea:not(:disabled)'

export default function Modal({ title, children, onClose, footer }) {
	const titleId = useId()
	const dialog = useRef(null)
	// useState 의 초기값 함수는 첫 렌더 때 한 번만 돌아가요 — autoFocus 가 끼어들기 전 조작 요소를 잡아요.
	const [opener] = useState(() =>
		typeof document !== "undefined" ? document.activeElement : null,
	)
	const close = useRef(onClose)
	useEffect(() => {
		close.current = onClose
	}, [onClose])
	useLayoutEffect(() => {
		const container = dialog.current
		const focusables = (root) => (root ? [...root.querySelectorAll(FOCUSABLE)] : [])
		// 부른 쪽에서 autoFocus 로 이미 모달 안 어딘가에 포커스를 뒀으면 그대로 둬요.
		if (!container.contains(document.activeElement)) {
			const body = container.querySelector(".modal-body")
			const foot = container.querySelector(":scope > footer")
			const input = body?.querySelector(BODY_INPUT)
			const primary = foot?.querySelector("button.primary:not(:disabled)")
			const initial =
				input ?? primary ?? focusables(foot)[0] ?? focusables(container)[0] ?? container
			initial.focus()
		}
		const handleKey = (event) => {
			if (event.key === "Escape") {
				event.preventDefault()
				close.current()
				return
			}
			if (event.key !== "Tab") return
			const items = focusables(container)
			if (!items.length) {
				event.preventDefault()
				container.focus()
				return
			}
			const first = items[0]
			const last = items[items.length - 1]
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
		container.addEventListener("keydown", handleKey)
		return () => {
			container.removeEventListener("keydown", handleKey)
			opener?.focus?.()
		}
	}, [opener])
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
