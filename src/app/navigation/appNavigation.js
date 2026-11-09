// 역할별 메뉴 표. 팀원은 자기 화면 PR에서 ready: false → true로 켜고 router.jsx에 라우트 한 줄만 추가해요.
// 순서는 docs/04_auth_session.md §4 "메뉴 노출" + UI/UX v1.4 COM-01 기준.
// screenId는 설계서 페이지 식별자(ADM-01·CASE-01·APR-01 …)로 검색에 씁니다.

export const appNavigation = [
	{
		id: "batches",
		path: "/admin/batches",
		label: "데이터·배치 운영",
		screenId: "ADM-01",
		roles: ["ADMIN"],
		roleOrder: { ADMIN: 0 },
		ready: false,
	},
	{
		id: "alerts",
		path: "/admin/alerts",
		label: "경보 점검",
		screenId: "ADM-02",
		roles: ["ADMIN"],
		roleOrder: { ADMIN: 1 },
		ready: false,
	},
	{
		id: "cases",
		path: "/cases",
		label: "조사 케이스",
		screenId: "CASE-01",
		roles: ["INVESTIGATOR", "APPROVER", "ADMIN"],
		roleOrder: { INVESTIGATOR: 0, APPROVER: 1, ADMIN: 2 },
		ready: true,
	},
	{
		id: "approvals",
		path: "/approvals",
		label: "승인함",
		screenId: "APR-01",
		roles: ["APPROVER", "ADMIN"],
		roleOrder: { APPROVER: 0, ADMIN: 3 },
		ready: false,
	},
	{
		id: "rules",
		path: "/admin/rules",
		label: "탐지 룰",
		screenId: "ADM-04",
		roles: ["ADMIN"],
		roleOrder: { ADMIN: 4 },
		ready: false,
	},
	{
		id: "audit",
		path: "/admin/audit",
		label: "감사 기록",
		screenId: "ADM-05",
		roles: ["ADMIN"],
		roleOrder: { ADMIN: 5 },
		ready: false,
	},
	{
		id: "accounts",
		path: "/admin/accounts",
		label: "계정 관리",
		screenId: "ADM-03",
		roles: ["ADMIN"],
		roleOrder: { ADMIN: 6 },
		ready: false,
	},
]

export function menusForRole(role, nav = appNavigation) {
	return nav
		.filter((m) => m.roles.includes(role))
		.slice()
		.sort((a, b) => (a.roleOrder[role] ?? 0) - (b.roleOrder[role] ?? 0))
}

export function visibleMenus(role, nav = appNavigation) {
	return menusForRole(role, nav).filter((m) => m.ready)
}

// COM-01 역할별 첫 진입: 매핑된 화면이 ready:true면 그리로, 아니면 역할의 첫 ready 메뉴로.
const FIRST_SCREEN_BY_ROLE = {
	ADMIN: "ADM-01",
	INVESTIGATOR: "CASE-01",
	APPROVER: "APR-01",
}

export function homePathFor(role, nav = appNavigation) {
	const first = nav.find((m) => m.screenId === FIRST_SCREEN_BY_ROLE[role])
	if (first && first.ready && first.roles.includes(role)) return first.path
	const fallback = visibleMenus(role, nav)[0]
	return fallback ? fallback.path : "/cases"
}
