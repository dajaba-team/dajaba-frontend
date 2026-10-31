import { useContext } from "react"
import { DashboardDemoContext } from "./DashboardDemoContext"

export function useDashboardDemo() {
	const context = useContext(DashboardDemoContext)
	if (!context) throw new Error("대시보드 시연 화면은 DemoProvider 안에서 사용해야 합니다.")
	return context
}
