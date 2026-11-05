import { Link, useParams } from "react-router"
import { useCaseDetail } from "../../cases/hooks/useCases"
import { useStrDraft } from "../hooks/useStrDraft"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemTime } from "../../../shared/format/time"
import StrNarrative from "../components/StrNarrative"
import "../styles/str.css"

// 케이스 → 지금 초안 번호(current_draft_no) → 초안 조회(STR 명세 2번) 순서로 불러와요.
// TODO(SCRUM-115): 〔확인 필요 — 케이스 상세 API〕 케이스 상세가 지금 초안 번호를 주는 필드 이름이 아직 없어요.
// MSW에는 `current_draft_no`로 두었고, 케이스 상세 API(SCRUM-102·106)를 정할 때 같이 확정해요.
export default function StrPage() {
	const { caseId } = useParams()
	const caseQuery = useCaseDetail(caseId)
	const draftNo = caseQuery.data?.current_draft_no ?? null
	const draftQuery = useStrDraft(draftNo)
	const draft = draftQuery.data
	return (
		<>
			<Link to={`/cases/${caseId}`}>← 케이스 상세</Link>
			<div className="str-page-heading">
				<h1>STR 초안</h1>
				{draft && (
					<p>
						{draft.draftNo} · 초안 {draft.status}
						{draft.caseStatus && ` · 케이스 ${draft.caseStatus}`}
						{draft.producedAt && ` · 생성 ${formatSystemTime(draft.producedAt)}`}
					</p>
				)}
			</div>
			<AsyncState query={caseQuery} />
			{caseQuery.data && !draftNo && <p>이 케이스에는 아직 STR 초안이 없어요.</p>}
			{draftNo && <AsyncState query={draftQuery} />}
			{draft && !draft.contentVisible && (
				<p role="note" className="str-restricted">
					본문은 담당 조사역과 승인자만 볼 수 있어요. 상태와 날짜만 보여 드려요.
				</p>
			)}
			{draft?.contentVisible && (
				<section className="str-panel" aria-labelledby="str-narrative-heading">
					<div className="str-panel-head">
						<h2 id="str-narrative-heading">서술부</h2>
						<p>
							{draft.narrative.length}개 항목 · 수정본 {draft.currentRevisionNo}번
							{draft.currentRevisionNo === 1 && " (AI 원문)"} ·{" "}
							{draft.generatorVersion}
						</p>
					</div>
					<StrNarrative narrative={draft.narrative} />
				</section>
			)}
		</>
	)
}
