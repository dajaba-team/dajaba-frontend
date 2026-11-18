// 가로 막대 입체 효과 (SCRUM-285) — Chart.js 플러그인.
// 1) 막대 뒤 0~최대 트랙  2) 막대 아래 은은한 그림자  3) 위쪽 절반 광택  4) 끝에 값 표시
// 막대 색 자체는 withDepth 가 왼쪽 옅게 → 오른쪽 진하게 그라디언트로 바꿔요.

const withAlpha = (color, alpha) =>
	/^#[0-9a-f]{6}$/i.test(color)
		? color +
			Math.round(alpha * 255)
				.toString(16)
				.padStart(2, "0")
		: color

function roundRect(ctx, x, y, w, h, r) {
	ctx.beginPath()
	ctx.roundRect(x, y, Math.max(w, 0), h, Math.min(r, h / 2, Math.max(w, 0) / 2))
}

// 막대 색(문자열 또는 배열)을 차트 폭에 맞춘 그라디언트로
export function withDepth(color) {
	return (context) => {
		const base = Array.isArray(color) ? color[context.dataIndex] : color
		const { chart } = context
		if (!chart.chartArea) return base
		const { left, right } = chart.chartArea
		const gradient = chart.ctx.createLinearGradient(left, 0, right, 0)
		gradient.addColorStop(0, withAlpha(base, 0.55))
		gradient.addColorStop(1, base)
		return gradient
	}
}

export function barDepth({ track, text, format }) {
	return {
		id: "barDepth",
		beforeDatasetsDraw(chart) {
			const { ctx, chartArea } = chart
			const bars = chart.getDatasetMeta(0).data
			ctx.save()
			ctx.fillStyle = track
			for (const bar of bars) {
				roundRect(
					ctx,
					chartArea.left,
					bar.y - bar.height / 2,
					chartArea.width,
					bar.height,
					999,
				)
				ctx.fill()
			}
			ctx.restore()
			ctx.save()
			ctx.shadowColor = "rgb(0 35 110 / 22%)"
			ctx.shadowBlur = 10
			ctx.shadowOffsetY = 4
		},
		afterDatasetsDraw(chart) {
			const { ctx, chartArea } = chart
			ctx.restore()
			const values = chart.data.datasets[0].data
			chart.getDatasetMeta(0).data.forEach((bar, i) => {
				const top = bar.y - bar.height / 2
				const width = bar.x - bar.base
				// 위쪽 절반 광택
				const gloss = ctx.createLinearGradient(0, top, 0, bar.y)
				gloss.addColorStop(0, "rgb(255 255 255 / 38%)")
				gloss.addColorStop(1, "rgb(255 255 255 / 0%)")
				ctx.save()
				ctx.fillStyle = gloss
				roundRect(ctx, bar.base + 2, top + 1.5, width - 4, bar.height / 2, 999)
				ctx.fill()
				// 값 — 막대 끝 바로 뒤, 자리가 없으면 막대 안쪽에 흰 글씨
				const label = format(values[i])
				ctx.font = "600 11px Pretendard, system-ui, sans-serif"
				ctx.textBaseline = "middle"
				const inside = bar.x + ctx.measureText(label).width + 12 > chartArea.right
				ctx.fillStyle = inside ? "#fff" : text
				ctx.textAlign = inside ? "right" : "left"
				ctx.fillText(label, inside ? bar.x - 8 : bar.x + 8, bar.y)
				ctx.restore()
			})
		},
	}
}
