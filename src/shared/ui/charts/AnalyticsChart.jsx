import { useEffect, useRef } from "react"
import {
	Chart,
	LineController,
	LineElement,
	PointElement,
	BarController,
	BarElement,
	DoughnutController,
	ArcElement,
	CategoryScale,
	LinearScale,
	Filler,
	Tooltip,
} from "chart.js"
import { barDepth, withDepth } from "./barDepth"
Chart.register(
	LineController,
	LineElement,
	PointElement,
	BarController,
	BarElement,
	DoughnutController,
	ArcElement,
	CategoryScale,
	LinearScale,
	Filler,
	Tooltip,
)

export default function AnalyticsChart({
	type = "bar",
	data,
	label,
	replay = 0,
	dark = false,
	ratio = false,
	horizontal = false,
}) {
	const canvas = useRef(null)
	useEffect(() => {
		if (!canvas.current || typeof CanvasRenderingContext2D === "undefined") return
		const style = getComputedStyle(canvas.current)
		const resolve = (value) =>
			typeof value === "string" && value.startsWith("--")
				? style.getPropertyValue(value).trim()
				: value
		const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
		const chart = new Chart(canvas.current, {
			type,
			data: {
				...data,
				datasets: data.datasets.map((d) => {
					const fill = Array.isArray(d.backgroundColor)
						? d.backgroundColor.map(resolve)
						: resolve(d.backgroundColor)
					return {
						...d,
						borderColor: resolve(d.borderColor),
						// 가로 막대는 그라디언트 + 트랙·그림자·광택(barDepth)으로 입체감
						backgroundColor: horizontal ? withDepth(fill) : fill,
					}
				}),
			},
			plugins: horizontal
				? [
						barDepth({
							track: resolve("--color-soft"),
							text: resolve("--color-text"),
							format: (v) => (ratio ? Number(v).toFixed(2) : String(v)),
						}),
					]
				: [],
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: motion.matches ? false : { duration: 1100, easing: "easeOutQuart" },
				interaction: { mode: type === "doughnut" ? "nearest" : "index", intersect: false },
				cutout: "78%",
				layout: { padding: horizontal ? { top: 8, bottom: 8, left: 8, right: 16 } : 8 },
				plugins: {
					legend: { display: false },
					tooltip: { backgroundColor: "#00236e", padding: 13, cornerRadius: 12 },
				},
				// horizontal 이면 막대가 가로 — 이름 축이 y, 값 축이 x (SCRUM-285)
				indexAxis: horizontal ? "y" : "x",
				scales:
					type === "doughnut"
						? {}
						: {
								[horizontal ? "y" : "x"]: {
									grid: { display: false },
									border: { display: false },
									ticks: {
										color: style.getPropertyValue("--color-muted"),
										font: { size: 10 },
										maxRotation: horizontal ? 0 : 30,
									},
								},
								[horizontal ? "x" : "y"]: {
									beginAtZero: true,
									...(ratio ? { max: 1 } : {}),
									border: { display: false },
									grid: horizontal
										? { display: false }
										: { color: style.getPropertyValue("--color-border") },
									ticks: {
										color: style.getPropertyValue("--color-muted"),
										maxTicksLimit: 5,
										precision: ratio ? 2 : 0,
										font: { size: 10 },
									},
								},
							},
				elements: {
					line: { tension: 0.4, borderWidth: 3 },
					point: { radius: 0, hoverRadius: 5 },
					bar: { borderRadius: 7, borderSkipped: false },
					arc: { borderWidth: 0, borderRadius: 4, spacing: 3 },
				},
			},
		})
		const reduce = () => {
			chart.options.animation = motion.matches ? false : { duration: 1100 }
			chart.stop()
			chart.update("none")
		}
		motion.addEventListener("change", reduce)
		return () => {
			motion.removeEventListener("change", reduce)
			chart.destroy()
		}
	}, [type, data, replay, dark, ratio, horizontal])
	return (
		<canvas ref={canvas} role="img" aria-label={label}>
			{label}
		</canvas>
	)
}
