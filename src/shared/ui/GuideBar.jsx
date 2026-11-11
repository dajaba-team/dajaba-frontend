import { useMemo, useState } from "react"
import Modal from "./dashboard/Modal"
import { GuideContext } from "./useGuide"

// 역할 기본 문구는 〔초안〕입니다. UI/UX v1.4 COM-02에 역할별 GuideBar 문구가 없어서
// 흐름 데모 nextTask()의 톤을 참고해 뽑았어요. 확정되면 〔초안〕 표시를 뗍니다.
const ROLE_DEFAULT = {
	ADMIN: "데이터를 적재하고 케이스를 만든 뒤 담당 조사역을 배정해 주세요.",
	INVESTIGATOR: "배정된 케이스부터 근거를 확인해 주세요.",
	APPROVER: "승인 요청된 보고서는 승인함에서 확인할 수 있어요.",
}

export default function GuideBar({ role, children }) {
	const [override, setOverride] = useState(null)
	const [open, setOpen] = useState(false)
	const value = useMemo(() => ({ set: setOverride }), [])
	const text = override ?? ROLE_DEFAULT[role] ?? ""
	return (
		<GuideContext.Provider value={value}>
			<div
				className="guide-bar"
				role="status"
				aria-label="다음 할 일 안내"
				aria-live="polite"
			>
				<span className="guide-bar-text">{text}</span>
				<button type="button" className="guide-bar-full" onClick={() => setOpen(true)}>
					전체 흐름
				</button>
			</div>
			{children}
			{open && (
				<Modal
					title="한 건의 업무를 끝까지 따라가는 방법"
					onClose={() => setOpen(false)}
					footer={
						<button type="button" className="primary" onClick={() => setOpen(false)}>
							확인
						</button>
					}
				>
					<div className="guide-flow">
						<section>
							<h3>1. 관리자</h3>
							<p>
								원천 적재 → 룰 스캔 → 점수 산출(일부 실패 확인) → 케이스 생성 →
								조사역 배정
							</p>
						</section>
						<section>
							<h3>2. 조사역</h3>
							<p>
								케이스 상세 → 근거·점수 이유·메모 → 에스컬레이션(사유) → 초안 생성
							</p>
						</section>
						<section>
							<h3>3. STR 작성·검증</h3>
							<p>
								저장본 검증 → 일자 불일치 확인 → 수정 → 변경 저장 → 재검증 → VI부
								유형·지점 정도 선택 → 승인 요청
							</p>
						</section>
						<section>
							<h3>4. 승인자</h3>
							<p>
								승인함 → 검토 → 본점 정도 선택 → 승인 → 제출 전 PDF → 모의 제출 →
								확정본
							</p>
							<p className="small">
								III부에는 직접 거래만, 자금 흐름 경로에는 전체 단계를 표시합니다.
								경유 금액은 입출금 집계에서 제외합니다.
							</p>
						</section>
						<section>
							<h3>다른 갈래</h3>
							<p>
								보완 요청 → 조사역 수정·저장·재검증 / 보고 안 함 → 조사역 사유 종료
								/ 조사 단계 오탐 → 사유 종료
							</p>
						</section>
					</div>
				</Modal>
			)}
		</GuideContext.Provider>
	)
}
