import { describe, expect, it } from "vitest"
import { http, HttpResponse } from "msw"
import { connectionApi } from "../features/connection/api/connectionApi"
import { server } from "../mocks/server"

describe("연동 확인 호출", () => {
	it("로그인이 실패해도 결과에 요청 본문(비밀번호)을 남기지 않는다", async () => {
		const result = await connectionApi.login("inv01", "secret-password-123")
		expect(result).toMatchObject({ ok: false, status: 401 })
		expect(result.data.error.code).toBe("LOGIN_FAILED")
		expect(result).not.toHaveProperty("error")
		expect(JSON.stringify(result)).not.toContain("secret-password-123")
	})
	it("응답이 없는 실패도 상태 없이 오류 이름·코드만 남긴다", async () => {
		server.use(http.get("*/actuator/health", () => HttpResponse.error(), { once: true }))
		const result = await connectionApi.health()
		expect(result).toMatchObject({ ok: false, status: null, data: null })
		expect(Object.keys(result.failure)).toEqual(["name", "code"])
	})
})
