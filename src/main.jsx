import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "./app/App"
import { createQueryClient } from "./app/queryClient"
import { GlobalStyle } from "./shared/styles/GlobalStyle"

async function bootstrap() {
	if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === "true") {
		const { worker } = await import("./mocks/browser")
		await worker.start({ onUnhandledRequest: "bypass" })
	}
	createRoot(document.getElementById("root")).render(
		<StrictMode>
			<QueryClientProvider client={createQueryClient()}>
				<BrowserRouter>
					<GlobalStyle />
					<App />
				</BrowserRouter>
			</QueryClientProvider>
		</StrictMode>,
	)
}
bootstrap().catch(() => {
	document.getElementById("root").textContent =
		"앱을 시작하지 못했습니다. 개발 서버와 환경 설정을 확인해 주세요."
})
