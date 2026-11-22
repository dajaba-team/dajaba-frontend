const has = (actions, action) => Array.isArray(actions) && actions.includes(action)

export function caseListWorkflowGuide(role) {
	if (role !== "INVESTIGATOR") return null
	return "1. 케이스 확인 — 내 담당 케이스를 열어 점수 이유와 근거 거래를 확인하세요."
}

export function caseDetailWorkflowGuide(detail, role) {
	if (!detail || role !== "INVESTIGATOR") return null
	const actions = detail.availableActions
	if (has(actions, "ESCALATE"))
		return "2. 조사 — 근거와 메모를 확인하세요. 의심되면 사유를 남겨 에스컬레이션하고, 오탐이면 종료하세요."
	if (has(actions, "GENERATE_DRAFT"))
		return "3. STR 작성 — 조사 내용을 확인한 뒤 STR 초안을 생성하세요."
	if (detail.currentDraftNo)
		return "3. STR 작성 — 현재 초안을 열어 내용을 보완하고 저장·검증을 이어가세요."
	return "현재 상태와 처리 이력을 확인하세요. 가능한 다음 작업은 처리 작업 영역에 표시됩니다."
}

export function strWorkflowGuide({ draft, detail, role }) {
	if (!detail) return null
	if (role === "APPROVER") {
		if (has(draft?.availableActions, "APPROVE") || has(draft?.availableActions, "REJECT"))
			return "2. 승인 결정 — 본문과 검증 결과를 확인한 뒤 승인하거나, 사유를 선택해 반려하세요."
		return "승인 검토 — 이 보고서는 읽기 전용입니다. 상태와 검증 결과를 확인하세요."
	}
	if (role !== "INVESTIGATOR") return null
	if (!draft)
		return has(detail.availableActions, "GENERATE_DRAFT")
			? "3. STR 작성 — STR 초안을 생성해 조사 내용을 보고서로 정리하세요."
			: "STR 상태를 확인하세요. 지금 생성할 수 없으면 케이스 상세에서 선행 작업을 확인하세요."
	if (detail.status === "PENDING_APPROVAL")
		return "5. 승인 대기 — 보고서를 수정할 수 없습니다. 승인자의 결정을 기다리세요."
	if (detail.status === "REJECTED")
		return "3. 보완 — 반려 사유에 맞게 본문을 수정·저장한 뒤 다시 검증하고 승인 요청하세요."
	if (draft.verification?.isCurrent && draft.verification?.passed)
		return "4. 승인 요청 — 의심 유형과 지점 의심 정도를 확인한 뒤 승인 요청을 보내세요."
	if (has(draft.availableActions, "VERIFY"))
		return "4. 검증 — 수정한 내용을 저장하고 현재 저장본을 검증하세요. 통과하면 승인 요청할 수 있습니다."
	return "3. STR 작성 — 초안 내용을 확인하고 필요한 항목을 수정해 저장하세요."
}

export function approvalListWorkflowGuide(role, count) {
	if (role !== "APPROVER") return null
	if (count === 0) return "승인 대기 건이 없습니다. 새 요청이 오면 오래된 요청부터 검토하세요."
	return "1. 승인 요청 확인 — 오래 기다린 보고서부터 열어 본문과 검증 결과를 검토하세요."
}
