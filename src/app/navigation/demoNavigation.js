export const demoNavigation = [
	{ id: "overview", path: "overview", label: "업무 개요", icon: "grid" },
	{
		id: "batches",
		path: "admin/batches",
		label: "데이터·배치 운영",
		icon: "database",
		roles: ["ADMIN"],
	},
	{ id: "alerts", path: "admin/alerts", label: "경보 점검", icon: "alert", roles: ["ADMIN"] },
	{ id: "rules", path: "admin/rules", label: "탐지 룰", icon: "rules", roles: ["ADMIN"] },
	{ id: "cases", path: "cases", label: "조사 케이스", icon: "case" },
	{ id: "str", path: "str", label: "STR 보고서", icon: "document" },
	// 승인함 목록은 관리자도 열람(GET /approvals는 ADMIN·APPROVER, 권한 18번 · NFR-AUTH-03). 승인·반려는 책임자만
	{
		id: "approvals",
		path: "approvals",
		label: "승인함",
		icon: "approval",
		roles: ["ADMIN", "APPROVER"],
	},
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
