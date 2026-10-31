import "@testing-library/jest-dom/vitest"
import { afterAll, afterEach, beforeAll } from "vitest"
import { cleanup } from "@testing-library/react"
import { server } from "../mocks/server"
import { resetCases } from "../mocks/handlers"
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
	cleanup()
	server.resetHandlers()
	resetCases()
})
afterAll(() => server.close())

import { apiClient } from "../shared/api/apiClient"
// jsdom의 XHR/CORS 모사 대신 MSW가 가로채는 표준 Fetch를 사용합니다.
apiClient.defaults.adapter = "fetch"
// Node의 fetch는 상대 경로를 풀지 못하므로 같은 출처 기본값("")을 jsdom 출처로 바꿉니다.
apiClient.defaults.baseURL = new URL(
	apiClient.defaults.baseURL,
	window.location.origin,
).href.replace(/\/$/, "")
