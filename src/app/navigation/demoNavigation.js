export const demoNavigation = [
	{ id: "overview", path: "overview", label: "업무 개요", icon: "grid" },
	{
		id: "batches",
		path: "admin/batches",
		label: "데이터·배치 운영",
		icon: "database",
		role: "ADMIN",
	},
	{ id: "alerts", path: "admin/alerts", label: "경보 점검", icon: "alert", role: "ADMIN" },
	{ id: "rules", path: "admin/rules", label: "탐지 룰", icon: "rules", role: "ADMIN" },
	{ id: "cases", path: "cases", label: "조사 케이스", icon: "case" },
	{ id: "str", path: "str", label: "STR 보고서", icon: "document" },
	{ id: "approvals", path: "approvals", label: "승인함", icon: "approval", role: "APPROVER" },
	{ id: "evaluation", path: "evaluation", label: "평가·재현", icon: "chart" },
	{ id: "audit", path: "audit", label: "감사 기록", icon: "audit" },
]

export function demoPath(view, caseId) {
	const encoded = encodeURIComponent(caseId || "CASE-2022-000057")
	if (view === "detail") return `/demo/cases/${encoded}`
	if (view === "str") return `/demo/cases/${encoded}/str`
	return `/demo/${demoNavigation.find((item) => item.id === view)?.path || "overview"}`
}

export function demoView(pathname) {
	if (/\/cases\/[^/]+\/str\/?$/.test(pathname)) return "str"
	if (pathname.startsWith("/demo/cases")) return "cases"
	return demoNavigation.find((item) => pathname === `/demo/${item.path}`)?.id
}
