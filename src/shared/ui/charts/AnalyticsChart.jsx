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
				datasets: data.datasets.map(({ gradientTo, ...d }) => {
					const fill = Array.isArray(d.backgroundColor)
						? d.backgroundColor.map(resolve)
						: resolve(d.backgroundColor)
					const colorAt = (i) => (Array.isArray(fill) ? fill[i] : fill)
					const end = resolve(gradientTo)
					return {
						...d,
						borderColor: resolve(d.borderColor),
						// gradientTo 가 있으면 값 축 방향으로 원래 색 → gradientTo 색 그라데이션.
						backgroundColor: end
							? (ctx) => {
									const { ctx: c, chartArea: area } = ctx.chart
									if (!area) return colorAt(ctx.dataIndex)
									const g = horizontal
										? c.createLinearGradient(area.left, 0, area.right, 0)
										: c.createLinearGradient(0, area.bottom, 0, area.top)
									g.addColorStop(0, colorAt(ctx.dataIndex))
									g.addColorStop(1, end)
									return g
								}
							: fill,
					}
				}),
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
	}, [type, data, replay, dark, ratio, horizontal])
	return (
		<canvas ref={canvas} role="img" aria-label={label}>
			{label}
		</canvas>
	)
}
