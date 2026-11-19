import { describe, expect, it } from "vitest"
import {
	getErrorMessage,
	getInvalidParameter,
	isAiFailure,
	isVersionConflict,
} from "../shared/api/apiClient"

const failure = (status, code, message, details = {}) => ({
	response: { status, data: { error: { code, message, details } } },
})

describe("서버 실패 안내", () => {
	it("CSRF 실패와 권한 부족을 구분한다", () => {
		expect(getErrorMessage(failure(403, "CSRF_INVALID"))).toContain("보안 토큰")
		expect(getErrorMessage(failure(403, "FORBIDDEN"))).toContain("실행 권한")
	})
	it("로그인 실패는 세션 만료와 다르게 한 문구로 안내한다", () => {
		expect(
			getErrorMessage(failure(401, "LOGIN_FAILED", "아이디 또는 비밀번호가 맞지 않습니다")),
		).toBe("아이디 또는 비밀번호가 맞지 않아요.")
		expect(getErrorMessage(failure(401, "UNAUTHENTICATED"))).toBe("로그인이 필요합니다.")
	})
	it("일반 업무 409를 버전 충돌로 취급하지 않는다", () => {
		expect(isVersionConflict(failure(409, "INVALID_TRANSITION"))).toBe(false)
		expect(isVersionConflict(failure(409, "CONCURRENT_UPDATE"))).toBe(true)
		expect(getErrorMessage(failure(409, "SELF_APPROVAL"))).toContain("본인이 담당")
		expect(getErrorMessage(failure(403, "NOT_ASSIGNEE", "server"))).toContain("담당자만")
	})
	it("초안 생성 중 409는 AI 장애와 다르게 안내한다", () => {
		expect(getErrorMessage(failure(409, "DRAFT_IN_PROGRESS"))).toContain("초안을 만드는 중")
	})
	it("코드별 문구가 없으면 서버 문구를 먼저 보여 준다", () => {
		expect(getErrorMessage(failure(404, "USER_NOT_FOUND", "사용자가 없습니다"))).toBe(
			"사용자가 없습니다",
		)
		expect(getErrorMessage(failure(403, "FORBIDDEN"))).toBe("실행 권한이 없어요.")
		expect(getErrorMessage(failure(403, "CSRF_INVALID", "csrf"))).toContain("보안 토큰")
	})
	it("주소가 없는 404는 대상 없음과 다르게 안내한다", () => {
		expect(getErrorMessage(failure(404, "NOT_FOUND", "요청한 주소가 없습니다"))).toBe(
			"아직 서버에 없는 기능이에요.",
		)
		expect(getErrorMessage(failure(404, "CASE_NOT_FOUND", "케이스가 없습니다"))).toBe(
			"케이스가 없습니다",
		)
	})
	it("응답 유실 시 저장 실패를 단정하거나 자동 재시도를 유도하지 않는다", () => {
		expect(getErrorMessage({ code: "ETIMEDOUT" })).toContain("최신 내용을 확인")
	})
	it("계정 관리의 본인·SYSTEM 계정 변경은 '이 계정은 바꿀 수 없어요' (SCRUM-318)", () => {
		expect(
			getErrorMessage(
				failure(409, "ACCOUNT_CHANGE_NOT_ALLOWED", "바꿀 수 없는 계정입니다", {
					reason: "SELF",
				}),
			),
		).toBe("이 계정은 바꿀 수 없어요.")
	})
	it("405 METHOD_NOT_ALLOWED 는 일반 실패 안내", () => {
		expect(getErrorMessage(failure(405, "METHOD_NOT_ALLOWED", "Method Not Allowed"))).toBe(
			"요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
		)
	})
})

describe("AI 연동 실패 502 — 서버 문구보다 화면 문구 (계약서 3절, SCRUM-318)", () => {
	it.each([
		"AI_UNAVAILABLE",
		"AI_BAD_RESPONSE",
		"AI_DRAFT_NOT_FOUND",
		"AI_INVALID_REQUEST",
		"AI_UNAUTHENTICATED",
		"LLM_UNAVAILABLE",
		"MODEL_UNAVAILABLE",
	])("%s 는 'AI 요청을 처리하지 못했어요'", (code) => {
		const error = failure(502, code, "server text")
		expect(isAiFailure(error)).toBe(true)
		expect(getErrorMessage(error)).toBe(
			"AI 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
		)
	})
	it("AI_TIMEOUT 은 응답이 늦었다고 따로 알린다", () => {
		expect(getErrorMessage(failure(502, "AI_TIMEOUT", "server text"))).toBe(
			"AI 응답이 늦어 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
		)
	})
	it("AI_ 가 붙은 401·400·404 는 로그인·입력 오류로 다루지 않는다 — 백엔드 자체 코드와 다름", () => {
		expect(getErrorMessage(failure(502, "AI_UNAUTHENTICATED"))).not.toContain("로그인")
		expect(getErrorMessage(failure(502, "AI_INVALID_REQUEST"))).not.toContain("입력 값")
		expect(isAiFailure(failure(401, "UNAUTHENTICATED"))).toBe(false)
		expect(isAiFailure(failure(404, "DRAFT_NOT_FOUND"))).toBe(false)
	})
	it("요약 코드 검사 실패(502 SUMMARY_CODE_CHECK_FAILED)는 그 문구가 먼저", () => {
		expect(getErrorMessage(failure(502, "SUMMARY_CODE_CHECK_FAILED", "x"))).toContain(
			"원본 데이터 검사를 통과하지 못해",
		)
	})
})

describe("400 쿼리·경로 파라미터 오류 details.parameter (BE #76, SCRUM-318)", () => {
	it("파라미터 이름을 화면 이름으로 바꿔 알려 준다", () => {
		const error = failure(400, "INVALID_REQUEST", "요청 파라미터가 올바르지 않습니다", {
			parameter: "from",
		})
		expect(getInvalidParameter(error)).toBe("from")
		expect(getErrorMessage(error)).toBe("시작일 값이 올바르지 않아요. 조건을 확인해 주세요.")
	})
	it("모르는 이름은 '검색 조건', parameter 가 없으면 기존 입력 안내", () => {
		expect(getErrorMessage(failure(400, "INVALID_REQUEST", "x", { parameter: "weird" }))).toBe(
			"검색 조건 값이 올바르지 않아요. 조건을 확인해 주세요.",
		)
		expect(getInvalidParameter(failure(400, "INVALID_REQUEST", "x", { note: "n" }))).toBeNull()
		expect(getErrorMessage(failure(400, "INVALID_REQUEST", "x", { note: "n" }))).toBe(
			"입력 값이 올바른지 확인해 주세요.",
		)
	})
})
