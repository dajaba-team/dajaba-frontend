import { Link, useParams } from "react-router"
import "../styles/cases.css"
import { useCaseDetail } from "../hooks/useCases"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemTime } from "../../../shared/format/time"
import CaseMemoEditor from "../components/CaseMemoEditor"
import CaseActions from "../components/CaseActions"
import {
	CLOSE_REASON_LABELS,
	HISTORY_LABELS,
	REJECTION_LABELS,
	STATUS_LABELS,
	labelOf,
} from "../labels"

// 케이스 상세 — 계약서 C2 `GET /cases/{case_no}`. 열람 기록은 서버가 남겨요.
// 점수·경보·근거 거래·AI 요약은 서버가 아직 null로 줘요(SCRUM-152 등) — 칸이 채워지면 여기에 붙여요.
export default function CaseDetailPage() {
	const { caseNo } = useParams()
	const query = useCaseDetail(caseNo)
	const detail = query.data
	return (
		<>
			<Link to="/cases">← 케이스 목록</Link>
			<AsyncState query={query} />
			{detail && (
				<>
					<header className="case-page-heading">
						<h1>{detail.caseNo}</h1>
						<p>
							<span className="case-status">
								{labelOf(STATUS_LABELS, detail.status)}
							</span>{" "}
							담당자 {detail.assignee?.displayName || "미배정"} · 버전{" "}
							{detail.version}
						</p>
					</header>
					<section className="case-panel case-summary" aria-label="케이스 정보">
						<dl>
							<dt>계좌</dt>
							<dd>{detail.accountNo}</dd>
							<dt>조사 우선순위 점수</dt>
							<dd>{detail.score ?? "산출 정보 없음"}</dd>
							<dt>생성</dt>
							<dd>{formatSystemTime(detail.createdAt)}</dd>
							{detail.rejectionReasonCode && (
								<>
									<dt>반려</dt>
									<dd>{labelOf(REJECTION_LABELS, detail.rejectionReasonCode)}</dd>
								</>
							)}
							{detail.closeReason && (
								<>
									<dt>종료 사유</dt>
									<dd>{labelOf(CLOSE_REASON_LABELS, detail.closeReason)}</dd>
								</>
							)}
						</dl>
					</section>
					<CaseActions detail={detail} />
					{detail.availableActions.includes("UPDATE_NOTES") ? (
						<CaseMemoEditor
							key={detail.caseNo}
							detail={detail}
							onRefresh={() => query.refetch()}
						/>
					) : (
						<section>
							<h2>조사 메모</h2>
							<p className="preserve-lines">
								{detail.investigatorNotes || "메모 없음"}
							</p>
							<p>현재 케이스는 읽기 전용입니다.</p>
						</section>
					)}
					<section aria-labelledby="history-title">
						<h2 id="history-title">최근 이력</h2>
						{detail.history.length ? (
							<ol className="case-history">
								{detail.history.map((entry, index) => (
									<li key={`${entry.createdAt}-${index}`}>
										<strong>{labelOf(HISTORY_LABELS, entry.action)}</strong>{" "}
										{entry.fromStatus &&
											`${labelOf(STATUS_LABELS, entry.fromStatus)} → `}
										{labelOf(STATUS_LABELS, entry.toStatus)} · {entry.createdBy}{" "}
										· {formatSystemTime(entry.createdAt)}
										{entry.comment && (
											<p className="preserve-lines">{entry.comment}</p>
										)}
									</li>
								))}
							</ol>
						) : (
							<p>이력이 없습니다.</p>
						)}
					</section>
					{detail.currentDraftNo && (
						<Link to={`/cases/${encodeURIComponent(detail.caseNo)}/str`}>
							STR 화면으로 이동 →
						</Link>
					)}
				</>
			)}
		</>
	)
}
