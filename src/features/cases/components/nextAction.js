// 판단 요약의 "다음 처리" 주 버튼 하나(SCRUM-369·372).
// 서버가 준 available_actions 를 화면이 정한 고정 순서로 훑어서 첫 번째만 골라요 — 역할·상태로 계산하지 않아요(규칙 3).
// 순서: 보고서 열기(초안이 있을 때) > STR 초안 생성 > 에스컬레이션 > 담당자 배정 > 담당자 변경. 종료는 주 버튼이 되지 않아요.
export const NEXT_ACTION_ORDER = [
	{ key: "generate_draft", action: "GENERATE_DRAFT", label: "STR 초안 생성" },
	{ key: "escalate", action: "ESCALATE", label: "에스컬레이션" },
	{ key: "assign", action: "ASSIGN", label: "담당자 배정" },
	{ key: "reassign", action: "REASSIGN", label: "담당자 변경" },
]

export function nextActionOf(detail) {
	if (!detail) return null
	if (detail.currentDraftNo) return { key: "open_report", label: "보고서 열기" }
	const actions = detail.availableActions ?? []
	return NEXT_ACTION_ORDER.find(({ action }) => actions.includes(action)) ?? null
}
