import { apiClient } from "../../../shared/api/apiClient"

// 업무 알림 조회 (「비동기 작업 알림 설계 문서」 6.5절, SCRUM-334·355).
// 〔임시: BE 아직 없음 — SCRUM-355 리뷰 중〕 MSW(`src/mocks/notifications.js`)가 같은 모양으로 답해요.
// 응답 { items[{type, case_no, draft_no, reason_code, actor{login_id, display_name}, at}], total, server_time }.
// 반려 코멘트·메모·계좌·금액·DB id는 응답에 없어요. 문구는 화면이 type으로 만들어요(model/notificationRules.js).

const UTC_Z = /Z$/

const toItem = (data) => ({
	type: data.type,
	caseNo: data.case_no ?? null,
	// APPROVAL_REQUESTED·STR_APPROVED·STR_REJECTED·STR_REPORTED에만 값, 케이스 알림 3종은 null
	draftNo: data.draft_no ?? null,
	// STR_REJECTED일 때만 NEED_REVISION·NOT_REPORTABLE
	reasonCode: data.reason_code ?? null,
	actor: data.actor
		? { loginId: data.actor.login_id ?? null, displayName: data.actor.display_name ?? null }
		: null,
	at: data.at ?? null,
})

export const notificationsApi = {
	/**
	 * GET /notifications?since=&size=. since는 Z로 끝나는 UTC만 받아요(+09:00은 BE가 400) — 다음 조회에는
	 * 응답 server_time을 그대로 넣어요. 화면 시계로 만든 값을 넣지 않게 Z가 아니면 보내지 않아요(최근 7일).
	 * total은 since 뒤 전체 건수인데 99에서 멈춰요.
	 */
	list: async ({ since = null, size } = {}, signal) => {
		const params = {}
		if (since && UTC_Z.test(since)) params.since = since
		if (size != null) params.size = size
		const { data } = await apiClient.get("/api/v1/notifications", { params, signal })
		return {
			items: (data.items ?? []).map(toItem),
			total: typeof data.total === "number" ? data.total : 0,
			serverTime: data.server_time ?? null,
		}
	},
}
