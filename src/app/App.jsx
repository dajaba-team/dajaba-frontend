import AppRouter from "./router"
import ToastProvider from "../shared/ui/toast/ToastProvider"

export default function App() {
	return (
		<ToastProvider>
			<AppRouter />
		</ToastProvider>
	)
}
