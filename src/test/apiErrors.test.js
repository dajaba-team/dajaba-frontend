import { describe, expect, it } from "vitest"
import { getErrorMessage, isVersionConflict } from "../shared/api/apiClient"

const failure = (status, code) => ({ response: { status, data: { error: { code } } } })

describe("서버 실패 안내", () => {
	it("CSRF 실패와 권한 부족을 구분한다", () => {
		expect(getErrorMessage(failure(403, "CSRF_INVALID"))).toContain("보안 토큰")
		expect(getErrorMessage(failure(403, "FORBIDDEN"))).toContain("실행 권한")
	})
	it("일반 업무 409를 버전 충돌로 취급하지 않는다", () => {
		expect(isVersionConflict(failure(409, "INVALID_TRANSITION"))).toBe(false)
		expect(isVersionConflict(failure(409, "CONCURRENT_UPDATE"))).toBe(true)
		expect(getErrorMessage(failure(409, "SELF_APPROVAL"))).toContain("본인이 담당")
	})
	it("응답 유실 시 저장 실패를 단정하거나 자동 재시도를 유도하지 않는다", () => {
		expect(getErrorMessage({ code: "ETIMEDOUT" })).toContain("최신 내용을 확인")
	})
})
