import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { DashboardDemoContext } from "../../shared/demo/DashboardDemoContext"
import { DashboardDemoApi } from "../../mocks/dashboard/dashboardDemoApi"
import { ApiError } from "../../mocks/dashboard/DemoApiError"
import { demoPath } from "../navigation/demoNavigation"

export default function DashboardDemoProvider({ children }) {
	// provider별 인스턴스를 써서 테스트·재진입이 이전 시연 상태를 공유하지 않습니다.
	const [api] = useState(() => new DashboardDemoApi())
	const [db, setDb] = useState(() => api.snapshot())
	const [role, setRole] = useState("ADMIN")
	const [dark, setDark] = useState(false)
	const [busy, setBusy] = useState(false)
	const [toast, setToast] = useState(null)
	const [scenarioVersion, setScenarioVersion] = useState(0)
	const inFlight = useRef(false)
	const mounted = useRef(true)
	const navigate = useNavigate()

	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])
	useEffect(() => {
		if (!toast) return
		const timer = window.setTimeout(() => setToast(null), 5000)
		return () => window.clearTimeout(timer)
	}, [toast])

	const go = (view) => navigate(demoPath(view, db.cases[0]?.case_no))
	const update = async (work, success) => {
		// state 갱신 전의 연속 클릭도 막기 위해 ref로 요청 진입을 직렬화합니다.
		if (inFlight.current) return false
		inFlight.current = true
		setBusy(true)
		try {
			const next = await work()
			if (mounted.current) {
				setDb(next)
				setToast({ tone: "success", text: success })
			}
			return true
		} catch (cause) {
			if (mounted.current)
				setToast({
					tone: "error",
					text:
						cause instanceof ApiError
							? `${cause.body.error.code} · ${cause.body.error.message}`
							: "요청을 처리하지 못했습니다.",
				})
			return false
		} finally {
			inFlight.current = false
			if (mounted.current) setBusy(false)
		}
	}
	const action = async (name, value) => {
		const operations = {
			note: [() => api.saveNote(role, value ?? ""), "조사 메모를 저장했습니다."],
			summary: [() => api.refreshSummary(role), "AI 조사 요약을 저장했습니다."],
			escalate: [
				() => api.escalate(role, value ?? ""),
				"상신했습니다. 초안 생성은 별도로 실행하세요.",
			],
			draft: [() => api.createDraft(role), "초안을 생성했습니다. 저장된 본문을 검증하세요."],
			revise: [
				() => api.revise(role, JSON.parse(value ?? "{}")),
				"변경한 단락을 저장했습니다.",
			],
			verify: [() => api.verify(role), "저장된 본문 검증을 완료했습니다."],
			submit: [() => api.submit(role), "승인 요청을 제출했습니다."],
			approve: [() => api.decide(role, "approve", ""), "승인하고 초안을 잠갔습니다."],
			reject: [() => api.decide(role, "reject", value ?? ""), "사유와 함께 반려했습니다."],
		}
		if (!operations[name]) return false
		const success = await update(...operations[name])
		if (success && name === "draft" && mounted.current) go("str")
		return success
	}
	const value = {
		db,
		role,
		dark,
		busy,
		toast,
		go,
		action,
		setDark,
		scenarioVersion,
		user: api.currentUser(role),
		changeRole: (next) => {
			if (inFlight.current || !["ADMIN", "INVESTIGATOR", "APPROVER"].includes(next)) return
			setRole(next)
			setToast(null)
			navigate(
				demoPath(
					next === "APPROVER"
						? "approvals"
						: next === "INVESTIGATOR"
							? "cases"
							: "overview",
				),
			)
		},
		openCase: () => navigate(demoPath("detail", db.cases[0]?.case_no)),
		assignCase: () => update(() => api.assign(role), "내게 배정했습니다."),
		runBatch: (type) =>
			update(
				() => api.runBatch(role, type, db.selected_date),
				"배치 시연 결과를 반영했습니다.",
			),
		updateRule: (rule, threshold, reason) =>
			update(
				() => api.updateRule(role, rule.rule_id, rule.version, threshold, reason),
				"새 룰 버전을 저장했습니다.",
			),
		onScenario: async (name) => {
			if (
				await update(
					() => api.scenario(name),
					name === "reset" ? "초기 상태로 복원했습니다." : "시연 상태를 적용했습니다.",
				)
			)
				setScenarioVersion((previous) => previous + 1)
		},
	}
	return <DashboardDemoContext.Provider value={value}>{children}</DashboardDemoContext.Provider>
}
