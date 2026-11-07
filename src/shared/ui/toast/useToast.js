import { useContext } from "react"
import { ToastContext } from "./ToastContext"

// 어느 화면에서든 `const { show } = useToast()`로 저장/실패 안내를 띄웁니다.
// show({ tone: "info" | "error", text }). 오류는 role="alert"로 자동 바뀝니다.
export function useToast() {
	const ctx = useContext(ToastContext)
	if (!ctx) throw new Error("useToast는 <ToastProvider> 안에서 써야 해요.")
	return ctx
}
