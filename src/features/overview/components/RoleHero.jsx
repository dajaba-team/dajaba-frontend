import { useState } from "react"
import { Link } from "react-router"

// 업무 대시보드 머리말 + 역할별 시작 타일(SCRUM-280, 팀 검토 시안의 bear-start).
// 안내 문장은 처음 한 번 보여 주고 [안내 접기]로 숨겨요. 숨김은 이 브라우저에만 기억해요.
const ROLE_COPY = {
	INVESTIGATOR: {
		title: "조사역 대시보드",
		description: "내게 배정된 건과 보완할 초안을 먼저 확인하세요.",
		eyebrow: "조사역",
		heading: "오늘 확인할 조사 업무",
		hint: "케이스를 열고 점수가 오른 이유와 근거 거래부터 확인해 보세요.",
		cta: "내 담당 케이스 보기",
		to: "/cases?mine=1",
	},
	APPROVER: {
		title: "승인자 대시보드",
		description: "요청이 오래된 보고서부터 검토하고, 승인한 건의 모의 제출을 이어가세요.",
		eyebrow: "승인자",
		heading: "오늘의 검토와 제출 현황",
		hint: "오래 기다린 요청부터 열어보세요. 재요청 건은 지난 보완 요청과 바뀐 문장을 함께 볼 수 있어요.",
		cta: "승인함 열기",
		to: "/approvals",
	},
	ADMIN: {
		title: "관리자 대시보드",
		description: "배치 결과를 확인하고 미배정 케이스를 조사역에게 연결하세요.",
		eyebrow: "운영 관리자",
		heading: "오늘의 배치와 배정 현황",
		hint: "배치 결과에서 실패한 작업을 확인하세요. 새로 생성된 케이스에는 담당 조사역을 배정해 주세요.",
		cta: "데이터·배치 운영 열기",
		to: "/admin/batches",
	},
}

const hintKey = (loginId) => `dajaba.intro.v1.${loginId}`

function readHidden(loginId) {
	try {
		return localStorage.getItem(hintKey(loginId)) === "hidden"
	} catch {
		return false
	}
}

export default function RoleHero({ role, loginId }) {
	const copy = ROLE_COPY[role] ?? ROLE_COPY.INVESTIGATOR
	const [hintHidden, setHintHidden] = useState(() => readHidden(loginId))
	function hideHint() {
		setHintHidden(true)
		try {
			localStorage.setItem(hintKey(loginId), "hidden")
		} catch {
			// 저장소를 못 쓰면 이번 화면에서만 접어요.
		}
	}
	return (
		<>
			<header className="role-heading">
				<p className="crumbs">
					업무 공간 <span aria-hidden="true">/</span> 업무 대시보드
				</p>
				<h1>{copy.title}</h1>
				<p>{copy.description}</p>
			</header>
			<section className="role-band" aria-labelledby="role-band-title">
				<span className="bear-face" aria-hidden="true" />
				<div className="role-band-copy">
					<p className="ux-eyebrow">
						{copy.eyebrow} {loginId} · 업무 시작
					</p>
					<h2 id="role-band-title">{copy.heading}</h2>
					{!hintHidden && (
						<div className="bear-hint">
							<p>{copy.hint}</p>
							<button
								type="button"
								className="hide-hint"
								onClick={hideHint}
								aria-label="첫 이용 안내 닫기"
							>
								안내 접기
							</button>
						</div>
					)}
				</div>
				<Link className="role-band-cta" to={copy.to}>
					{copy.cta} <span aria-hidden="true">→</span>
				</Link>
			</section>
		</>
	)
}
