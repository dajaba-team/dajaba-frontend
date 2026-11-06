import { Link, useParams } from "react-router"
import { useCaseDetail } from "../../cases/hooks/useCases"
import { useStrDraft } from "../hooks/useStrDraft"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemTime } from "../../../shared/format/time"
import StrNarrative from "../components/StrNarrative"
import "../styles/str.css"

// 케이스 → 지금 초안 번호(current_draft_no, 계약서 C2·Q14) → 초안 조회(STR 명세 2번) 순서로 불러와요.
export default function StrPage() {
	const { caseNo } = useParams()
	const caseQuery = useCaseDetail(caseNo)
	const draftNo = caseQuery.data?.currentDraftNo ?? null
	const draftQuery = useStrDraft(draftNo)
	const draft = draftQuery.data
	return (
		<>
			<Link to={`/cases/${encodeURIComponent(caseNo)}`}>← 케이스 상세</Link>
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
