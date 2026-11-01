import { Link, useParams } from "react-router"
import { useCaseDetail } from "../hooks/useCases"
import { AsyncState } from "../../../shared/ui/AsyncState"
import CaseMemoEditor from "../components/CaseMemoEditor"

export default function CaseDetailPage() {
	const { caseId } = useParams()
	const query = useCaseDetail(caseId)
	const detail = query.data
	return (
		<>
			<Link to="/cases">← 케이스 목록</Link>
			<AsyncState query={query} />
			{detail && (
				<>
					<h1>{detail.title}</h1>
					<p>
						{detail.status} · 담당자 {detail.assignee_name || "미배정"} · 버전{" "}
						{detail.case_version}
					</p>
					<h2>거래 근거</h2>
					<p>{detail.evidence}</p>
					{detail.allowed_actions.includes("SAVE_MEMO") ? (
						<CaseMemoEditor
							key={detail.id}
							detail={detail}
							onRefresh={() => query.refetch()}
						/>
					) : (
						<section>
							<h2>조사 메모</h2>
							<p>{detail.memo || "메모 없음"}</p>
							<p>현재 케이스는 읽기 전용입니다.</p>
						</section>
					)}
					<h2>변경 이력</h2>
					<ul>
						{detail.history.map((entry, index) => (
							<li key={index}>{entry}</li>
						))}
					</ul>
					<Link to={`/cases/${detail.id}/str`}>STR 화면으로 이동 →</Link>
				</>
			)}
		</>
	)
}
