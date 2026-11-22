// 업무 알림 MSW — BE GET /notifications(SCRUM-355 #169)와 같은 모양.
// 모양·규칙은 「비동기 작업 알림 설계 문서」 6.5절 + 11/22 진희님 슬랙 확인:
//   - total은 since 뒤 전체 건수, 99에서 멈춤(화면은 99면 "99+")
//   - since는 Z로 끝나는 UTC만(+09:00 등은 400). 없으면 7일 전부터, 30일보다 오래되면 30일 전으로 맞춤
//   - size 1~50, 기본 20, 최신순
//   - 관리자는 늘 { items: [], total: 0 }
//   - draft_no는 APPROVAL_REQUESTED·STR_APPROVED·STR_REJECTED·STR_REPORTED에만, 케이스 알림 3종은 null
//   - reason_code는 STR_REJECTED일 때만
//   - 자기가 한 일(actor = 나)은 안 나옴. 반려 코멘트·메모·계좌·금액·DB id 없음
// 실제 BE는 case_history를 읽어 만들지만, MSW는 받는 사람(recipient)을 붙인 시드로 흉내 내요.
// recipient·minutes_ago는 MSW 내부 판단용이라 응답에 넣지 않아요.

export const NOTIFICATION_TOTAL_CAP = 99
const DEFAULT_SIZE = 20
const MAX_SIZE = 50
const DEFAULT_DAYS = 7
const MAX_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000
const UTC_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/

const DRAFT_TYPES = new Set(["APPROVAL_REQUESTED", "STR_APPROVED", "STR_REJECTED", "STR_REPORTED"])

const person = (loginId) => ({ login_id: loginId, display_name: `예시 ${loginId}` })

// minutes_ago: 지금 기준 몇 분 전. 7일(10,080분)·30일(43,200분) 경계를 넘는 행도 하나씩.
function seedNotifications() {
	return [
		{
			recipient: "inv01",
			type: "STR_REJECTED",
			case_no: "CASE-2022-001001",
			draft_no: "DRF-000124",
			reason_code: "NEED_REVISION",
			actor: person("apr01"),
			minutes_ago: 5,
		},
		{
			recipient: "inv01",
			type: "CASE_ASSIGNED",
			case_no: "CASE-2022-001004",
			actor: person("admin"),
			minutes_ago: 40,
		},
		{
			recipient: "inv01",
			type: "CASE_REASSIGNED_TO_ME",
			case_no: "CASE-2022-001001",
			actor: person("admin"),
			minutes_ago: 180,
		},
		{
			recipient: "inv01",
			type: "STR_APPROVED",
			case_no: "CASE-2022-001003",
			draft_no: "DRF-000098",
			actor: person("apr01"),
			minutes_ago: 60 * 26,
		},
		{
			recipient: "inv01",
			type: "STR_REPORTED",
			case_no: "CASE-2022-001003",
			draft_no: "DRF-000098",
			actor: person("apr01"),
			minutes_ago: 60 * 25,
		},
		{
			recipient: "inv01",
			type: "CASE_REASSIGNED_AWAY",
			case_no: "CASE-2022-001002",
			actor: person("admin"),
			minutes_ago: 60 * 24 * 3,
		},
		// 자기가 한 일 — 안 나와야 해요(설계 6.5 "자기가 한 일은 알리지 않아요")
		{
			recipient: "inv01",
			type: "CASE_ASSIGNED",
			case_no: "CASE-2022-001004",
			actor: person("inv01"),
			minutes_ago: 20,
		},
		// 8일 전 — since 없이 부르면(최근 7일) 안 나오고, since를 더 앞으로 주면 나와요
		{
			recipient: "inv01",
			type: "CASE_ASSIGNED",
			case_no: "CASE-2022-001003",
			actor: person("admin"),
			minutes_ago: 60 * 24 * 8,
		},
		// 31일 전 — 30일 넘은 since는 30일 전으로 맞춰서 늘 안 나와요
		{
			recipient: "inv01",
			type: "CASE_ASSIGNED",
			case_no: "CASE-2022-001002",
			actor: person("admin"),
			minutes_ago: 60 * 24 * 31,
		},
		{
			recipient: "apr01",
			type: "APPROVAL_REQUESTED",
			case_no: "CASE-2022-001001",
			draft_no: "DRF-000124",
			actor: person("inv01"),
			minutes_ago: 15,
		},
	]
}

let notifications = seedNotifications()

export function resetNotifications() {
	notifications = seedNotifications()
}

/** 테스트용 — 알림 행을 더해요(99+ 확인 등). 행 모양은 시드와 같아요. */
export function addNotifications(rows) {
	notifications = [...notifications, ...rows]
}

const badRequest = (details) => ({
	status: 400,
	body: { error: { code: "INVALID_REQUEST", message: "잘못된 요청입니다", details } },
})

// 응답 한 줄 — 종류별로 draft_no·reason_code를 비워요(BE 규칙을 MSW도 지켜요).
function toItem(row, now) {
	return {
		type: row.type,
		case_no: row.case_no,
		draft_no: DRAFT_TYPES.has(row.type) ? (row.draft_no ?? null) : null,
		reason_code: row.type === "STR_REJECTED" ? (row.reason_code ?? null) : null,
		actor: row.actor,
		at: new Date(now - row.minutes_ago * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z"),
	}
}

/** GET /api/v1/notifications?since=&size= → 200 { items, total, server_time } */
export function listNotifications(viewer, url) {
	const params = url.searchParams
	const sinceRaw = params.get("since")
	const sizeRaw = params.get("size")
	if (sinceRaw != null && (!UTC_Z.test(sinceRaw) || Number.isNaN(Date.parse(sinceRaw))))
		return badRequest({ parameter: "since" })
	const size = sizeRaw == null ? DEFAULT_SIZE : Number(sizeRaw)
	if (!Number.isInteger(size) || size < 1 || size > MAX_SIZE)
		return badRequest({ parameter: "size" })

	const now = Date.now()
	// 실서버처럼 초를 버린 현재 시각에서 5초를 빼, 조회 직후 커밋된 이력을 다음 조회에서 받게 해요.
	const serverTime = new Date(Math.floor(now / 1000) * 1000 - 5_000)
		.toISOString()
		.replace(/\.\d{3}Z$/, "Z")
	if (viewer.role === "ADMIN")
		return { status: 200, body: { items: [], total: 0, server_time: serverTime } }

	const floor = now - MAX_DAYS * DAY_MS
	const since =
		sinceRaw == null ? now - DEFAULT_DAYS * DAY_MS : Math.max(Date.parse(sinceRaw), floor)
	const mine = notifications
		.filter(
			(row) => row.recipient === viewer.login_id && row.actor?.login_id !== viewer.login_id,
		)
		.map((row) => toItem(row, now))
		.filter((item) => Date.parse(item.at) > since)
		.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
	return {
		status: 200,
		body: {
			items: mine.slice(0, size),
			total: Math.min(mine.length, NOTIFICATION_TOTAL_CAP),
			server_time: serverTime,
		},
	}
}
