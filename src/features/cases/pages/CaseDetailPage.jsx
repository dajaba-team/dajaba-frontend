import { useEffect, useState } from "react"
import { Link, useLocation, useParams } from "react-router"
import "../styles/cases.css"
import { useCaseDetail } from "../hooks/useCases"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { useSession } from "../../auth/hooks/useSession"
import CaseActions from "../components/CaseActions"
import CaseAskPanel from "../components/CaseAskPanel"
import bearFace from "../../../shared/assets/bear-face.png"
import CaseEvidenceCard from "../components/CaseEvidenceCard"
import CaseInfoCard from "../components/CaseInfoCard"
import CaseHistoryCard from "../components/CaseHistoryCard"
import CaseNotesCard from "../components/CaseNotesCard"
import CaseScoreReasons from "../components/CaseScoreReasons"
import CaseSummaryPanel from "../components/CaseSummaryPanel"
import CaseSummaryHeader from "../components/CaseSummaryHeader"
import { nextActionOf } from "../components/nextAction"
import { useGuide } from "../../../shared/ui/useGuide"
import { caseDetailWorkflowGuide } from "../../../shared/ui/workflowGuide"

// 케이스 상세 — 계약서 C2 `GET /cases/{case_no}`. 열람 기록은 서버가 남겨요.
// 조사 흐름대로 위에서 아래로 읽혀요:
//   ① 무엇인가 — 판단 요약(번호·점수·상태·사유·담당·[다음 처리]) + 개요 띠(계좌·규칙·탐지 기간·경보)
//   ② 왜 탐지됐나 — 점수 근거 → AI 요약
//   ③ 근거 확인 — 거래 분석(자금 흐름·근거 거래)
//   ④ 작업대 — 조사 메모 → 처리 작업
//   ⑤ 참고 — 이력(처리·메모)
// 마크업 순서 = 읽는 순서 = Tab 순서(SCRUM-373). 좁은 화면은 그대로 한 줄이라 근거 바로 뒤에 메모·처리가 와요.
// 넓은 화면(77.5rem~)은 왼쪽 ②③⑤, 오른쪽 작업대 — 작업대는 스크롤을 따라와서 근거를 보며 바로 메모·처리할 수 있어요.
// 채움 파랑 버튼은 판단 요약의 [다음 처리] 하나예요.

// 질문 채팅창 상태 — 열림·접힘(근거 보기)·근거 강조. 케이스가 바뀌면 key 로 새로 시작해요(SCRUM-303).
// 채팅창은 본문 위 오른쪽 아래에 떠 있어서 본문 배치를 바꾸지 않아요. 근거 거래를 보면 표를 가리지 않게 접어 두고,
// 오른쪽 아래 [질의 창 열기]로 다시 펼쳐요 — 쓰던 입력·지난 질문은 그대로예요.
function useAskPanel() {
	const [open, setOpen] = useState(false)
	const [collapsed, setCollapsed] = useState(false)
	const [highlight, setHighlight] = useState(null)
	useEffect(() => {
		if (!highlight) return
		const card = document.getElementById("case-evidence-card")
		card?.scrollIntoView?.({ block: "start", behavior: "smooth" })
		document.getElementById("ask-evidence-bar")?.focus({ preventScroll: true })
	}, [highlight])
	return {
		open,
		collapsed,
		highlight,
		openPanel: () => {
			setOpen(true)
			setCollapsed(false)
		},
		close: () => {
			setOpen(false)
			setCollapsed(false)
			setHighlight(null)
			document.getElementById("ask-open")?.focus({ preventScroll: true })
		},
		showEvidence: (record) => {
			setHighlight((prev) => ({
				questionNo: record.questionNo,
				ids: record.evidenceTransactionIds,
				seq: (prev?.seq ?? 0) + 1,
			}))
			setCollapsed(true)
		},
		clearHighlight: () => setHighlight(null),
		minimize: () => setCollapsed(true),
	}
}

function AskButton({ ask }) {
	const shown = ask.open && !ask.collapsed
	return (
		<button
			id="ask-open"
			type="button"
			className="case-ask-open"
			aria-expanded={shown}
			aria-controls={ask.open ? "ask-panel" : undefined}
			onClick={ask.openPanel}
		>
			<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
				<path d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 16 14h-6.2L6 17v-3H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5Z" />
				<path d="M7 9.25h6M7 11.25h3.5" />
			</svg>
			{ask.open && ask.collapsed ? "질의 창 열기" : "근거 질의"}
		</button>
	)
}

export default function CaseDetailPage() {
	const { caseNo } = useParams()
	return <CaseDetail key={caseNo} caseNo={caseNo} />
}

function CaseDetail({ caseNo }) {
	// 목록에서 들어왔으면 그때의 필터·정렬·페이지(주소 query)로 돌아가요 (SCRUM-181)
	const fromList = useLocation().state?.listSearch
	const listSearch = typeof fromList === "string" && fromList.startsWith("?") ? fromList : ""
	const query = useCaseDetail(caseNo)
	const detail = query.data
	const viewer = useSession().data
	useGuide(caseDetailWorkflowGuide(detail, viewer?.role))
	const ask = useAskPanel()
	// 판단 요약 [다음 처리] → 처리 작업 카드의 같은 폼을 열어요.
	const [actionRequest, setActionRequest] = useState(null)
	const requestAction = (key) => setActionRequest((prev) => ({ key, seq: (prev?.seq ?? 0) + 1 }))
	// 버튼·패널은 서버가 준 ASK_QUESTION 으로만 그려요. 역할·상태를 화면에서 계산하지 않아요.
	const canAsk = Boolean(detail?.availableActions?.includes("ASK_QUESTION"))
	const panelOpen = canAsk && ask.open
	return (
		<div className="case-detail">
			<div className="case-ask-main">
				<Link className="case-back-link" to={`/cases${listSearch}`}>
					← 케이스 목록
				</Link>
				<AsyncState query={query} />
				{detail && (
					<>
						<CaseSummaryHeader
							detail={detail}
							askButton={canAsk ? <AskButton ask={ask} /> : null}
							onAction={requestAction}
						/>
						<CaseInfoCard detail={detail} />
						<div className="case-detail-layout">
							<div className="case-detail-main">
								<CaseScoreReasons latestScore={detail.latestScore} />
								<CaseSummaryPanel detail={detail} />
								<CaseEvidenceCard
									detail={detail}
									highlight={panelOpen ? ask.highlight : null}
									onClearHighlight={ask.clearHighlight}
									onReopenAsk={
										panelOpen && ask.collapsed ? ask.openPanel : undefined
									}
								/>
							</div>
							<aside className="case-detail-aside" aria-label="조사 메모와 처리 작업">
								<CaseNotesCard detail={detail} onRefresh={() => query.refetch()} />
								<CaseActions
									detail={detail}
									request={actionRequest}
									primaryKey={nextActionOf(detail)?.key ?? null}
								/>
							</aside>
							<div className="case-detail-history">
								<CaseHistoryCard detail={detail} />
							</div>
						</div>
					</>
				)}
			</div>
			{panelOpen && (
				<div className="ask-float" id="ask-panel">
					{ask.collapsed && (
						<button type="button" className="ask-float-reopen" onClick={ask.openPanel}>
							<img src={bearFace} alt="" aria-hidden="true" />
							질의 창 열기
						</button>
					)}
					<CaseAskPanel
						caseNo={detail.caseNo}
						viewerName={viewer?.displayName ?? "나"}
						viewerLoginId={viewer?.loginId ?? null}
						highlightedNo={ask.highlight?.questionNo ?? null}
						onShowEvidence={ask.showEvidence}
						onClose={ask.close}
						onMinimize={ask.minimize}
						hidden={ask.collapsed}
					/>
				</div>
			)}
		</div>
	)
}
