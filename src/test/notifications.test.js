import { describe, expect, it } from "vitest"
import { notificationsApi } from "../features/notifications/api/notificationsApi"
import {
	badgeLabel,
	moreLabel,
	notificationPath,
	notificationText,
} from "../features/notifications/model/notificationRules"
import { resetCases } from "../mocks/handlers"
import { addNotifications } from "../mocks/notifications"
import { apiClient, getErrorCode } from "../shared/api/apiClient"

// 업무 알림 GET /notifications — MSW 계약 (설계 6.5절 + 11/22 진희님 확인 다섯 가지, SCRUM-334·355)
const users = {
	inv01: { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" },
	apr01: { id: 3, login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" },
	admin: { id: 4, login_id: "admin", display_name: "예시 admin", role: "ADMIN" },
}
const UTC_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const DRAFT_TYPES = ["APPROVAL_REQUESTED", "STR_APPROVED", "STR_REJECTED", "STR_REPORTED"]
const daysAgo = (days) =>
	new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z")

async function captureError(work) {
	try {
		await work()
	} catch (error) {
		return error
	}
	throw new Error("요청이 실패해야 합니다")
}

const get = (params) => apiClient.get("/api/v1/notifications", { params })

describe("업무 알림 MSW — 응답 모양 (설계 6.5)", () => {
	it("조사역: since 없이 최근 7일, 최신순, 자기가 한 일은 빠지고, server_time은 Z", async () => {
		resetCases(users.inv01)
		const { data } = await get()
		expect(data.server_time).toMatch(UTC_Z)
		expect(data.items.map((item) => item.type)).toEqual([
			"STR_REJECTED",
			"CASE_ASSIGNED",
			"CASE_REASSIGNED_TO_ME",
			"STR_REPORTED",
			"STR_APPROVED",
			"CASE_REASSIGNED_AWAY",
		])
		expect(data.total).toBe(6)
		expect(data.items.every((item) => item.actor.login_id !== "inv01")).toBe(true)
		const times = data.items.map((item) => Date.parse(item.at))
		expect([...times].sort((a, b) => b - a)).toEqual(times)
		for (const item of data.items) expect(item.at).toMatch(UTC_Z)
	})
	it("draft_no는 STR 알림 4종에만, reason_code는 STR_REJECTED에만. 코멘트·DB id는 없다", async () => {
		resetCases(users.inv01)
		const { data } = await get()
		for (const item of data.items) {
			expect(Object.keys(item).sort()).toEqual(
				["actor", "at", "case_no", "draft_no", "reason_code", "type"].sort(),
			)
			if (DRAFT_TYPES.includes(item.type)) expect(item.draft_no).toMatch(/^DRF-\d{6}$/)
			else expect(item.draft_no).toBeNull()
			if (item.type === "STR_REJECTED") expect(item.reason_code).toBe("NEED_REVISION")
			else expect(item.reason_code).toBeNull()
		}
	})
	it("승인자는 승인 요청을 받고, 관리자는 늘 빈 목록(items: [], total: 0)", async () => {
		resetCases(users.apr01)
		const approver = (await get()).data
		expect(approver.items).toHaveLength(1)
		expect(approver.items[0]).toMatchObject({
			type: "APPROVAL_REQUESTED",
			case_no: "CASE-2022-001001",
			draft_no: "DRF-000124",
			reason_code: null,
		})
		resetCases(users.admin)
		const admin = (await get({ since: daysAgo(29) })).data
		expect(admin).toMatchObject({ items: [], total: 0 })
		expect(admin.server_time).toMatch(UTC_Z)
	})
	it("로그인 안 했으면 401", async () => {
		resetCases(null)
		const error = await captureError(() => get())
		expect(error.response.status).toBe(401)
	})
})

describe("업무 알림 MSW — since·size", () => {
	it("다음 조회 since에 server_time을 그대로 넣으면 새 알림만(지금은 0건)", async () => {
		resetCases(users.inv01)
		const first = await notificationsApi.list()
		expect(first.total).toBe(6)
		const next = await notificationsApi.list({ since: first.serverTime })
		expect(next).toMatchObject({ items: [], total: 0 })
	})
	it("server_time은 실서버처럼 초를 버린 현재 시각보다 5초 전이다", async () => {
		resetCases(users.inv01)
		const before = Date.now()
		const { data } = await get()
		const after = Date.now()
		expect(Date.parse(data.server_time)).toBeGreaterThanOrEqual(
			Math.floor(before / 1000) * 1000 - 5_000,
		)
		expect(Date.parse(data.server_time)).toBeLessThanOrEqual(
			Math.floor(after / 1000) * 1000 - 5_000,
		)
	})
	it("since가 7일보다 앞이면 그만큼, 30일보다 앞이면 30일 전으로 맞춘다", async () => {
		resetCases(users.inv01)
		expect((await get({ since: daysAgo(10) })).data.total).toBe(7)
		expect((await get({ since: daysAgo(60) })).data.total).toBe(7)
	})
	it.each(["2026-11-22T10:00:00+09:00", "2026-11-22T01:00:00", "2026-11-22", "어제"])(
		"since %s는 Z로 끝나는 UTC가 아니라 400 INVALID_REQUEST",
		async (since) => {
			resetCases(users.inv01)
			const error = await captureError(() => get({ since }))
			expect(error.response.status).toBe(400)
			expect(getErrorCode(error)).toBe("INVALID_REQUEST")
		},
	)
	it("API 모듈은 Z가 아닌 since를 보내지 않는다(화면 시계 값이 섞여도 400 대신 최근 7일)", async () => {
		resetCases(users.inv01)
		const result = await notificationsApi.list({ since: "2026-11-22T10:00:00+09:00" })
		expect(result.total).toBe(6)
	})
	it.each(["0", "51", "abc", "1.5"])("size %s는 400", async (size) => {
		resetCases(users.inv01)
		const error = await captureError(() => get({ size }))
		expect(error.response.status).toBe(400)
	})
	it("size는 목록만 자르고 total은 since 뒤 전체 건수", async () => {
		resetCases(users.inv01)
		const result = await notificationsApi.list({ size: 2 })
		expect(result.items).toHaveLength(2)
		expect(result.total).toBe(6)
	})
	it("total은 99에서 멈추고, 화면은 99면 99+로 보여 준다", async () => {
		resetCases(users.inv01)
		addNotifications(
			Array.from({ length: 120 }, (_, index) => ({
				recipient: "inv01",
				type: "CASE_ASSIGNED",
				case_no: "CASE-2022-001004",
				actor: { login_id: "admin", display_name: "예시 admin" },
				minutes_ago: 60 + index,
			})),
		)
		const result = await notificationsApi.list()
		expect(result.total).toBe(99)
		expect(result.items).toHaveLength(20)
		expect(badgeLabel(result.total)).toBe("99+")
	})
})

describe("업무 알림 화면 규칙", () => {
	it('이전 알림 n건 — total이 받은 줄보다 클 때만, 99에서 멈췄으면 "이상"', () => {
		expect(moreLabel(20, 20)).toBeNull()
		expect(moreLabel(0, 0)).toBeNull()
		expect(moreLabel(null, 0)).toBeNull()
		expect(moreLabel(56, 50)).toBe("이전 알림 6건 더 있음")
		expect(moreLabel(98, 50)).toBe("이전 알림 48건 더 있음")
		expect(moreLabel(99, 50)).toBe("이전 알림 49건 이상 더 있음")
	})
	it("API 모듈이 camelCase로 옮긴다", async () => {
		resetCases(users.inv01)
		const { items, serverTime } = await notificationsApi.list({ size: 1 })
		expect(serverTime).toMatch(UTC_Z)
		expect(items[0]).toEqual({
			type: "STR_REJECTED",
			caseNo: "CASE-2022-001001",
			draftNo: "DRF-000124",
			reasonCode: "NEED_REVISION",
			actor: { loginId: "apr01", displayName: "예시 apr01" },
			at: expect.stringMatching(UTC_Z),
		})
	})
	it("숫자 표시: 0은 숨김, 1~98은 그대로, 99는 99+", () => {
		expect(badgeLabel(0)).toBeNull()
		expect(badgeLabel(undefined)).toBeNull()
		expect(badgeLabel(1)).toBe("1")
		expect(badgeLabel(98)).toBe("98")
		expect(badgeLabel(99)).toBe("99+")
	})
	it.each([
		["CASE_ASSIGNED", null, "CASE-1이 배정됐어요", "/cases/CASE-1"],
		["CASE_REASSIGNED_TO_ME", null, "CASE-1을 넘겨받았어요", "/cases/CASE-1"],
		["CASE_REASSIGNED_AWAY", null, "CASE-1 담당이 다른 분으로 바뀌었어요", "/cases"],
		["APPROVAL_REQUESTED", null, "CASE-1 승인 요청이 왔어요", "/approvals"],
		["STR_APPROVED", null, "CASE-1 STR이 승인됐어요", "/cases/CASE-1/str"],
		[
			"STR_REJECTED",
			"NEED_REVISION",
			"CASE-1 STR이 반려됐어요 · 보완 요청",
			"/cases/CASE-1/str",
		],
		[
			"STR_REJECTED",
			"NOT_REPORTABLE",
			"CASE-1 STR이 반려됐어요 · 보고 안 함",
			"/cases/CASE-1/str",
		],
		["STR_REPORTED", null, "CASE-1 STR이 제출됐어요", "/cases/CASE-1/str"],
	])("%s(%s) → 문구·이동", (type, reasonCode, text, path) => {
		const item = { type, caseNo: "CASE-1", reasonCode }
		expect(notificationText(item)).toBe(text)
		expect(notificationPath(item)).toBe(path)
	})
})
