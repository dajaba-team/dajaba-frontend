import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "./app/App"
import { createQueryClient } from "./app/queryClient"
import "./index.css"

async function bootstrap() {
	if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === "true") {
		const { worker } = await import("./mocks/browser")
		await worker.start({ onUnhandledRequest: "bypass" })
	}
	// data router — 미저장 메모가 있을 때 useBlocker로 뒤로 가기까지 막으려고(EX-15).
	// 화면 경로는 그대로 App 안의 <Routes>가 정해요.
	const router = createBrowserRouter([{ path: "*", element: <App /> }])
	createRoot(document.getElementById("root")).render(
		<StrictMode>
			<QueryClientProvider client={createQueryClient()}>
				<RouterProvider router={router} />
			</QueryClientProvider>
		</StrictMode>,
	)
}
bootstrap().catch(() => {
	document.getElementById("root").textContent =
		"앱을 시작하지 못했습니다. 개발 서버와 환경 설정을 확인해 주세요."
})
