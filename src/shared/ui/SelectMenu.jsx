import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import "./selectMenu.css"

// 네이티브 <select> 대신 쓰는 펼침 목록. macOS 기본 팝업은 고른 항목을 버튼 위에 겹쳐 띄워서
// 글자가 가려져요 — 이 목록은 항상 버튼 바로 아래에 열려요(select-only combobox 패턴, WAI-ARIA APG).
// options: [[value, label], ...]. 버튼이라 <label> 로 감싸면 그 글자가 접근 가능한 이름이 돼요.
export default function SelectMenu({ value, options, onChange, className = "", ...buttonProps }) {
	const listId = useId()
	const buttonRef = useRef(null)
	const listRef = useRef(null)
	const [open, setOpen] = useState(false)
	const [active, setActive] = useState(0)
	const [position, setPosition] = useState(null)
	const selectedIndex = Math.max(
		0,
		options.findIndex(([optionValue]) => optionValue === value),
	)
	const selectedLabel = options[selectedIndex]?.[1] ?? ""

	function openList(index = selectedIndex) {
		setActive(index)
		setOpen(true)
	}
	function close({ focus = true } = {}) {
		setOpen(false)
		if (focus) buttonRef.current?.focus()
	}
	function choose(index) {
		const [next] = options[index]
		close()
		if (next !== value) onChange(next)
	}

	// 패널(overflow: hidden) 밖으로도 보이게 화면 기준(fixed)으로 버튼 아래에 붙여요.
	useLayoutEffect(() => {
		if (!open) return
		const rect = buttonRef.current.getBoundingClientRect()
		setPosition({ top: rect.bottom + 6, left: rect.left, minWidth: rect.width })
		listRef.current?.focus()
	}, [open])

	// 바깥을 누르거나 화면이 움직이면 닫아요(목록이 버튼에서 떨어져 보이지 않게).
	useEffect(() => {
		if (!open) return
		const onPointerDown = (event) => {
			if (
				!listRef.current?.contains(event.target) &&
				!buttonRef.current?.contains(event.target)
			)
				close({ focus: false })
		}
		const onMove = (event) => {
			if (listRef.current?.contains(event.target)) return
			close({ focus: false })
		}
		document.addEventListener("pointerdown", onPointerDown)
		window.addEventListener("scroll", onMove, true)
		window.addEventListener("resize", onMove)
		return () => {
			document.removeEventListener("pointerdown", onPointerDown)
			window.removeEventListener("scroll", onMove, true)
			window.removeEventListener("resize", onMove)
		}
	}, [open])

	function onButtonKeyDown(event) {
		if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
			event.preventDefault()
			openList()
		}
	}
	function onListKeyDown(event) {
		const last = options.length - 1
		const moves = {
			ArrowDown: Math.min(active + 1, last),
			ArrowUp: Math.max(active - 1, 0),
			Home: 0,
			End: last,
		}
		if (event.key in moves) {
			event.preventDefault()
			setActive(moves[event.key])
		} else if (event.key === "Enter" || event.key === " ") {
			event.preventDefault()
			choose(active)
		} else if (event.key === "Escape") {
			event.preventDefault()
			close()
		} else if (event.key === "Tab") {
			close({ focus: false })
		}
	}

	return (
		<>
			<button
				{...buttonProps}
				ref={buttonRef}
				type="button"
				className={`select-menu-trigger ${className}`.trim()}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={open ? listId : undefined}
				data-value={value}
				onClick={() => (open ? close() : openList())}
				onKeyDown={onButtonKeyDown}
			>
				<span>{selectedLabel}</span>
				<svg className="select-menu-chevron" viewBox="0 0 16 16" aria-hidden="true">
					<path d="M4 6l4 4 4-4" />
				</svg>
			</button>
			{open && (
				<ul
					ref={listRef}
					id={listId}
					role="listbox"
					tabIndex={-1}
					className="select-menu-list"
					aria-label={buttonProps["aria-label"]}
					aria-activedescendant={`${listId}-${active}`}
					style={position ?? { visibility: "hidden" }}
					onKeyDown={onListKeyDown}
				>
					{options.map(([optionValue, label], index) => (
						<li
							key={optionValue}
							id={`${listId}-${index}`}
							role="option"
							aria-selected={index === selectedIndex}
							data-active={index === active || undefined}
							onPointerEnter={() => setActive(index)}
							onClick={() => choose(index)}
						>
							<span>{label}</span>
							{index === selectedIndex && (
								<svg
									className="select-menu-check"
									viewBox="0 0 16 16"
									aria-hidden="true"
								>
									<path d="M3.5 8.5l3 3 6-7" />
								</svg>
							)}
						</li>
					))}
				</ul>
			)}
		</>
	)
}
