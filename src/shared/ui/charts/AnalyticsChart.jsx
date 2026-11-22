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
		// 눈금 글자는 --font-2xs 토큰(rem)을 px 로 — Chart.js 는 숫자 px 만 받아요(SCRUM-294).
		const tickSize =
			parseFloat(style.getPropertyValue("--font-2xs")) *
			parseFloat(getComputedStyle(document.documentElement).fontSize)
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
										font: { size: tickSize },
										maxRotation: horizontal ? 0 : 45,
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
										font: { size: tickSize },
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
