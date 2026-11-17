import { useEffect, useRef } from "react"
export default function CountUp({ value, replay = 0 }) {
	const node = useRef(null)
	const formatted = value.toLocaleString("ko-KR")
	useEffect(() => {
		const element = node.current
		const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)")
		if (!element || motion?.matches || !window.requestAnimationFrame) return
		let frame, start
		const finish = () => {
			cancelAnimationFrame(frame)
			element.textContent = value.toLocaleString("ko-KR")
		}
		const tick = (now) => {
			start ??= now
			const progress = Math.min((now - start) / 1100, 1)
			element.textContent = Math.round(value * (1 - (1 - progress) ** 4)).toLocaleString(
				"ko-KR",
			)
			if (progress < 1) frame = requestAnimationFrame(tick)
		}
		frame = requestAnimationFrame(tick)
		motion?.addEventListener("change", finish)
		return () => {
			cancelAnimationFrame(frame)
			motion?.removeEventListener("change", finish)
		}
	}, [value, replay])
	return (
		<b className="count-up" aria-label={formatted}>
			<span ref={node} aria-hidden="true">
				{formatted}
			</span>
		</b>
	)
}
