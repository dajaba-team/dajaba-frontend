// 업무 알림 화면 규칙 — 순수 함수 (「비동기 작업 알림 설계 문서」 6.5·7.5·7.8절, SCRUM-334).

/** BE total은 99에서 멈춰요 — 99면 "99+"(진희님 11/22). 0이면 숫자를 안 보여요(null). */
export const NOTIFICATION_TOTAL_CAP = 99
export function badgeLabel(total) {
	if (!total || total < 1) return null
	return total >= NOTIFICATION_TOTAL_CAP ? `${NOTIFICATION_TOTAL_CAP}+` : String(total)
}

/**
 * 목록 아래 "이전 알림 n건 더 있음"(BE cases.md 「업무 알림 조회」). total이 받은 줄 수보다 클 때만.
 * total이 99에서 멈췄으면 실제로는 더 많을 수 있어 "n건 이상". 커서가 없어 더 불러오진 않아요.
 */
export function moreLabel(total, shown) {
	const rest = (total ?? 0) - (shown ?? 0)
	if (rest < 1) return null
	return total >= NOTIFICATION_TOTAL_CAP
		? `이전 알림 ${rest}건 이상 더 있음`
		: `이전 알림 ${rest}건 더 있음`
}

const REJECTION_WORDS = { NEED_REVISION: "보완 요청", NOT_REPORTABLE: "보고 안 함" }

/** 목록 한 줄 문구 (설계 7.8 예시). 모르는 type은 케이스 번호 + "새 알림". */
export function notificationText({ type, caseNo, reasonCode }) {
	const no = caseNo ?? "케이스"
	switch (type) {
		case "CASE_ASSIGNED":
			return `${no}이 배정됐어요`
		case "CASE_REASSIGNED_TO_ME":
			return `${no}을 넘겨받았어요`
		case "CASE_REASSIGNED_AWAY":
			return `${no} 담당이 다른 분으로 바뀌었어요`
		case "APPROVAL_REQUESTED":
			return `${no} 승인 요청이 왔어요`
		case "STR_APPROVED":
			return `${no} STR이 승인됐어요`
		case "STR_REJECTED":
			return REJECTION_WORDS[reasonCode]
				? `${no} STR이 반려됐어요 · ${REJECTION_WORDS[reasonCode]}`
				: `${no} STR이 반려됐어요`
		case "STR_REPORTED":
			return `${no} STR이 제출됐어요`
		default:
			return `${no} 새 알림`
	}
}

/** 눌렀을 때 갈 곳 (설계 6.5 표 "누르면"). 실제 경로는 라우터 기준. */
export function notificationPath({ type, caseNo }) {
	const caseDetail = caseNo ? `/cases/${encodeURIComponent(caseNo)}` : "/cases"
	switch (type) {
		case "CASE_ASSIGNED":
		case "CASE_REASSIGNED_TO_ME":
			return caseDetail
		case "CASE_REASSIGNED_AWAY":
			return "/cases"
		// 이미 처리된 요청이면 승인함에 없어요 — 거기서 판단(설계 9 #42)
		case "APPROVAL_REQUESTED":
			return "/approvals"
		case "STR_APPROVED":
		case "STR_REJECTED":
		case "STR_REPORTED":
			return caseNo ? `${caseDetail}/str` : "/cases"
		default:
			return caseDetail
	}
}

/** 마지막으로 본 시각 저장 키 — 로그인 아이디별(설계 7.8). 값은 응답 server_time 그대로. */
export const seenKey = (loginId) => `aml.notifications.seen.${loginId}`
