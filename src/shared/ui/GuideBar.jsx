import { useMemo, useState } from "react"
import Modal from "./dashboard/Modal"
import dajabaIcon from "../assets/dajaba-icon.svg"
import { GuideContext } from "./useGuide"

// 역할 기본 문구. 업무 페이지는 useGuide로 현재 단계와 다음 행동을 더 구체적으로 덮어써요(SCRUM-330).
const ROLE_DEFAULT = {
	ADMIN: "데이터를 적재하고 케이스를 만든 뒤 담당 조사역을 배정해 주세요.",
	INVESTIGATOR: "배정된 케이스부터 근거를 확인해 주세요.",
	APPROVER: "승인 요청된 보고서는 승인함에서 확인할 수 있어요.",
}

// [전체 흐름] 창 — 역할마다 한 줄 타임라인(11/18 시안 B). 줄의 마지막 단계가 다음 역할로 넘기는 지점이에요.
const FLOW = [
	{
		no: 1,
		role: "관리자",
		steps: [
			["원천 적재"],
			["룰 스캔"],
			["점수 산출", "일부 실패 확인"],
			["케이스 생성"],
			["조사역 배정"],
		],
	},
	{
		no: 2,
		role: "조사역",
		steps: [
			["케이스 상세"],
			["근거·점수 이유·메모"],
			["에스컬레이션", "사유 입력"],
			["초안 생성"],
		],
	},
	{
		no: 3,
		role: "STR 작성·검증",
		steps: [
			["저장본 검증"],
			["일자 불일치 확인"],
			["수정"],
			["변경 저장"],
			["재검증"],
			["VI부 유형·지점 정도 선택"],
			["승인 요청"],
		],
	},
	{
		no: 4,
		role: "승인자",
		steps: [
			["승인함"],
			["검토"],
			["본점 정도 선택"],
			["승인"],
			["제출 전 PDF"],
			["모의 제출"],
			["확정본"],
		],
		note: "III부에는 직접 거래만, 자금 흐름 경로에는 전체 단계를 표시합니다. 경유 금액은 입출금 집계에서 제외합니다.",
	},
]

const BRANCHES = [
	["보완 요청", "조사역이 수정 · 저장 · 재검증"],
	["보고 안 함", "조사역이 사유를 남기고 종료"],
	["조사 단계 오탐", "사유를 남기고 종료"],
]

export default function GuideBar({ role, children }) {
	const [override, setOverride] = useState(null)
	const [open, setOpen] = useState(false)
	const value = useMemo(() => ({ set: setOverride }), [])
	const text = override ?? ROLE_DEFAULT[role] ?? ""
	return (
		<GuideContext.Provider value={value}>
			<div
				className="guide-bar"
				role="status"
				aria-label="다음 할 일 안내"
				aria-live="polite"
			>
				<span className="guide-bar-icon">
					<img src={dajabaIcon} alt="" aria-hidden="true" width={20} height={20} />
				</span>
				<span className="guide-bar-text">{text}</span>
				<button type="button" className="guide-bar-full" onClick={() => setOpen(true)}>
					전체 흐름
				</button>
			</div>
			{children}
			{open && (
				<Modal
					className="modal-wide guide-modal"
					title="한 건의 업무를 끝까지 따라가는 방법"
					onClose={() => setOpen(false)}
					footer={
						<button type="button" className="primary" onClick={() => setOpen(false)}>
							확인
						</button>
					}
				>
					<ol className="guide-flow">
						{FLOW.map((lane) => (
							<li key={lane.role} className="guide-lane">
								<h3 aria-label={`${lane.no}. ${lane.role}`}>
									<b aria-hidden="true">{lane.no}</b>
									{lane.role}
								</h3>
								<ol
									className="guide-track"
									style={{ "--steps": lane.steps.length }}
								>
									{lane.steps.map(([step, sub]) => (
										<li key={step}>
											<span>{step}</span>
											{sub && <small>{sub}</small>}
										</li>
									))}
								</ol>
								{lane.note && <p className="guide-note">{lane.note}</p>}
							</li>
						))}
					</ol>
					<section className="guide-branches" aria-labelledby="guide-branches-title">
						<h3 id="guide-branches-title">다른 갈래</h3>
						<dl>
							{BRANCHES.map(([when, then]) => (
								<div key={when}>
									<dt>{when}</dt>
									<dd>{then}</dd>
								</div>
							))}
						</dl>
					</section>
				</Modal>
			)}
		</GuideContext.Provider>
	)
}
