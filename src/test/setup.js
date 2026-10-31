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
