import { useId } from "react"
import { Link } from "react-router"

// 업무 대시보드 머리말 + 역할별 이동 카드(SCRUM-280, SCRUM-286 시안 B).
// 제목·설명 아래에 폭을 꽉 채운 이동 카드를 두고, 전신 곰이 카드 안에서 살짝 올라와 버튼을 안내해요.
// 빵부스러기·하늘색 바깥 박스·안내 문장·바로가기 줄은 뺐어요(SCRUM-345 — 메뉴와 겹치는 것 정리).
const ROLE_COPY = {
	INVESTIGATOR: {
		title: "조사역 대시보드",
		description: "내게 배정된 건과 보완할 초안을 먼저 확인하세요.",
		cta: "내 담당 케이스 보기",
		sub: "배정 케이스 · 근거 거래 확인",
		to: "/cases?mine=1",
	},
	APPROVER: {
		title: "승인자 대시보드",
		description: "요청이 오래된 보고서부터 검토하고, 승인한 건의 모의 제출을 이어가세요.",
		cta: "승인함 열기",
		sub: "검토 요청 · 모의 제출",
		to: "/approvals",
	},
	ADMIN: {
		title: "관리자 대시보드",
		description: "배치 운영, 조사 관리, 승인 등의 업무 현황을 한눈에 확인하세요.",
		cta: "데이터·배치 운영 열기",
		sub: "배치 결과 확인 · 담당 배정",
		to: "/admin/batches",
	},
}

export default function RoleHero({ role }) {
	const copy = ROLE_COPY[role] ?? ROLE_COPY.INVESTIGATOR
	const subId = useId()
	return (
		<>
			<header className="role-heading">
				<h1>{copy.title}</h1>
				<p>{copy.description}</p>
			</header>
			{/* 링크 이름은 버튼 문구만, 작은 안내 문구는 설명으로 읽혀요(PR #62 리뷰). */}
			<Link
				className="role-band-cta"
				to={copy.to}
				aria-label={copy.cta}
				aria-describedby={subId}
			>
				<span className="bear-full" aria-hidden="true" />
				<small id={subId}>{copy.sub}</small>
				<strong>
					{copy.cta}
					<span className="cta-arrow" aria-hidden="true">
						→
					</span>
				</strong>
			</Link>
		</>
	)
}
