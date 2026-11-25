import { useEffect, useState } from "react"
import Modal from "../dashboard/Modal"
import { TUTORIAL_STEPS } from "./tutorialSteps"
import "./tutorial.css"

const LAST = TUTORIAL_STEPS.length - 1

// 사용 안내 창(SCRUM-428) — 한 단계씩 [이전]·[다음] 또는 ←·→ 키로 넘기고, 아래 점으로 지금 위치를 보여 줘요.
// 점을 누르면 그 단계로 바로 가요. 마지막 단계의 [시작하기]나 Esc·바깥 누르기로 닫아요.
export default function TutorialDialog({ onClose }) {
	const [index, setIndex] = useState(0)
	const step = TUTORIAL_STEPS[index]
	useEffect(() => {
		const onKey = (event) => {
			if (event.key === "ArrowRight") setIndex((i) => Math.min(i + 1, LAST))
			if (event.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0))
		}
		document.addEventListener("keydown", onKey)
		return () => document.removeEventListener("keydown", onKey)
	}, [])
	return (
		<Modal
			title="사용 안내"
			className="modal-wide tutorial-dialog"
			onClose={onClose}
			footer={
				<>
					<nav className="tutorial-dots" aria-label="안내 단계">
						{TUTORIAL_STEPS.map((item, i) => (
							<button
								key={item.id}
								type="button"
								className="tutorial-dot"
								aria-label={`${i + 1}단계 ${item.title}`}
								aria-current={i === index ? "step" : undefined}
								onClick={() => setIndex(i)}
							/>
						))}
					</nav>
					<div className="tutorial-nav">
						<button
							type="button"
							onClick={() => setIndex(index - 1)}
							disabled={index === 0}
						>
							이전
						</button>
						{index === LAST ? (
							<button type="button" className="primary" onClick={onClose}>
								시작하기
							</button>
						) : (
							<button
								type="button"
								className="primary"
								onClick={() => setIndex(index + 1)}
							>
								다음
							</button>
						)}
					</div>
				</>
			}
		>
			<p className="tutorial-count">
				{index + 1} / {TUTORIAL_STEPS.length} · {step.who}
			</p>
			<h3 className="tutorial-title">{step.title}</h3>
			<TutorialShot key={step.id} step={step} />
			<ul className="tutorial-points">
				{step.points.map((point) => (
					<li key={point}>{point}</li>
				))}
			</ul>
		</Modal>
	)
}

// 캡처가 아직 없으면 같은 크기의 빈 자리를 보여 줘요 — 창 높이가 단계마다 들쭉날쭉하지 않게.
function TutorialShot({ step }) {
	const [missing, setMissing] = useState(false)
	if (missing)
		return (
			<div className="tutorial-shot is-empty" role="img" aria-label={`${step.title} 화면`}>
				화면 이미지 준비 중
			</div>
		)
	return (
		<img
			className="tutorial-shot"
			src={step.image}
			alt={`${step.title} 화면`}
			onError={() => setMissing(true)}
		/>
	)
}
