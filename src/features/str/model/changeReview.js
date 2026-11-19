// 비교 기준 — 반려 당시(있으면 먼저) · AI 원문(수정본 1) · 직전 수정본. 지금 수정본과 같은 번호는 빼요.
export function baseOptions(currentRevisionNo, rejectionRevisionNo) {
	if (!currentRevisionNo || currentRevisionNo <= 1) return []
	const options = []
	const add = (revisionNo, label) => {
		if (revisionNo == null || revisionNo < 1 || revisionNo >= currentRevisionNo) return
		if (options.some((option) => option.revisionNo === revisionNo)) return
		options.push({ revisionNo, label })
	}
	add(rejectionRevisionNo, `반려 당시 (수정본 ${rejectionRevisionNo}번)`)
	add(1, "AI 원문 (수정본 1번)")
	add(currentRevisionNo - 1, `직전 수정본 (수정본 ${currentRevisionNo - 1}번)`)
	return options
}
