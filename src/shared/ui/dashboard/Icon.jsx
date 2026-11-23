const iconPaths = {
	grid: (
		<>
			<rect x="3" y="3" width="7" height="7" rx="1" />
			<rect x="14" y="3" width="7" height="7" rx="1" />
			<rect x="3" y="14" width="7" height="7" rx="1" />
			<rect x="14" y="14" width="7" height="7" rx="1" />
		</>
	),
	database: (
		<>
			<ellipse cx="12" cy="5" rx="8" ry="3" />
			<path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
		</>
	),
	alert: (
		<>
			<path d="M12 9v4M12 17h.01" />
			<path d="M10.3 3.5 2.7 17a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 3.5a2 2 0 0 0-3.4 0Z" />
		</>
	),
	rules: (
		<>
			<path d="M4 6h16M7 12h10M10 18h4" />
			<circle cx="8" cy="6" r="2" />
			<circle cx="15" cy="12" r="2" />
			<circle cx="12" cy="18" r="2" />
		</>
	),
	case: (
		<>
			<rect x="3" y="7" width="18" height="13" rx="2" />
			<path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
		</>
	),
	document: (
		<>
			<path d="M6 2h9l4 4v16H6zM14 2v5h5M9 12h6M9 16h6" />
		</>
	),
	approval: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="m8 12 2.5 2.5L16 9" />
		</>
	),
	chart: (
		<>
			<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
		</>
	),
	audit: (
		<>
			<path d="M5 3h14v18H5zM9 8h6M9 12h6M9 16h4" />
		</>
	),
	sun: (
		<>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2" />
		</>
	),
	moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
	close: <path d="m6 6 12 12M18 6 6 18" />,
	arrow: <path d="M5 12h14m-4-4 4 4-4 4" />,
	sparkle: (
		<path d="m12 3 1.2 3.5a6.5 6.5 0 0 0 4.3 4.3L21 12l-3.5 1.2a6.5 6.5 0 0 0-4.3 4.3L12 21l-1.2-3.5a6.5 6.5 0 0 0-4.3-4.3L3 12l3.5-1.2a6.5 6.5 0 0 0 4.3-4.3Z" />
	),
	check: <path d="m5 12 4 4L19 6" />,
	eye: (
		<>
			<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
			<circle cx="12" cy="12" r="3" />
		</>
	),
	eyeOff: (
		<>
			<path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.4 3.3M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
			<path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
		</>
	),
	warning: (
		<>
			<path d="M12 9v4M12 17h.01" />
			<path d="M10.3 3.5 2.7 17a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 3.5a2 2 0 0 0-3.4 0Z" />
		</>
	),
	clock: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 7v5l3 2" />
		</>
	),
	user: (
		<>
			<circle cx="12" cy="8" r="4" />
			<path d="M4 21a8 8 0 0 1 16 0" />
		</>
	),
	search: (
		<>
			<circle cx="11" cy="11" r="7" />
			<path d="m20 20-4-4" />
		</>
	),
	refresh: (
		<>
			<path d="M20 7v5h-5M4 17v-5h5" />
			<path d="M18.5 9A7 7 0 0 0 6 6l-2 3M5.5 15A7 7 0 0 0 18 18l2-3" />
		</>
	),
	lock: (
		<>
			<rect x="5" y="10" width="14" height="11" rx="2" />
			<path d="M8 10V7a4 4 0 0 1 8 0v3" />
		</>
	),
	copy: (
		<>
			<rect x="8" y="8" width="12" height="12" rx="2" />
			<path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
		</>
	),
	plus: <path d="M12 5v14M5 12h14" />,
	// 위 띠 역할 칩·시연 도구(SCRUM-280 시안)
	help: (
		<>
			<circle cx="12" cy="12" r="9.5" />
			<path d="M9.2 9.2a2.9 2.9 0 1 1 3.9 2.7c-.7.3-1.1.8-1.1 1.6v.4M12 16.8v.2" />
		</>
	),
	// 대시보드 KPI 카드 제목 옆 안내(SCRUM-345)
	info: (
		<>
			<circle cx="12" cy="12" r="9.5" />
			<path d="M12 11v5.5M12 7.6v.2" />
		</>
	),
	chevron: <path d="m6 9 6 6 6-6" />,
	minus: <path d="M5 12h14" />,
	// 사이드바 접기·펼치기(SCRUM-327)
	chevronsLeft: <path d="m12 6-6 6 6 6m6-12-6 6 6 6" />,
	chevronsRight: <path d="m6 6 6 6-6 6m6-12 6 6-6 6" />,
	// 업무 알림 종(SCRUM-334)
	bell: (
		<>
			<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
			<path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
		</>
	),
}
export default function Icon({ name, size = 18 }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{iconPaths[name]}
		</svg>
	)
}
