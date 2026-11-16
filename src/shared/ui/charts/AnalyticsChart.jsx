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
				datasets: data.datasets.map((d) => ({
					...d,
					borderColor: resolve(d.borderColor),
					backgroundColor: Array.isArray(d.backgroundColor)
						? d.backgroundColor.map(resolve)
						: resolve(d.backgroundColor),
				})),
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: motion.matches ? false : { duration: 1100, easing: "easeOutQuart" },
				interaction: { mode: type === "doughnut" ? "nearest" : "index", intersect: false },
				cutout: "78%",
				layout: { padding: 8 },
				plugins: {
					legend: { display: false },
					tooltip: { backgroundColor: "#00236e", padding: 13, cornerRadius: 12 },
				},
				scales:
					type === "doughnut"
						? {}
						: {
								x: {
									grid: { display: false },
									border: { display: false },
									ticks: {
										color: style.getPropertyValue("--color-muted"),
										font: { size: 10 },
										maxRotation: 30,
									},
								},
								y: {
									beginAtZero: true,
									...(ratio ? { max: 1 } : {}),
									border: { display: false },
									grid: { color: style.getPropertyValue("--color-border") },
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
	}, [type, data, replay, dark, ratio])
	return (
		<canvas ref={canvas} role="img" aria-label={label}>
			{label}
		</canvas>
	)
}
