import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
	plugins: [react()],
	server: {
		proxy: {
			"/api": { target: "http://localhost:8080", changeOrigin: true },
			// 개발 전용 연동 확인 화면(/dev/connection)이 쓰는 health·API 문서
			"/actuator": { target: "http://localhost:8080", changeOrigin: true },
			"/v3/api-docs": { target: "http://localhost:8080", changeOrigin: true },
		},
	},
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test/setup.js"],
		clearMocks: true,
	},
})
