import { formatSystemMinute as formatSystemTime } from "../caseTime"
import { CLOSE_REASON_LABELS, REJECTION_LABELS, labelOf } from "../labels"
import { formatScore } from "../../../shared/format/score"
import DlRankText from "./DlRankText"

// 케이스·경보 정보(SCRUM-369) — 예전 「케이스 개요」·「경보 정보」 두 카드를 하나로. 점수는 판단 요약으로 올라갔어요.
export default function CaseInfoCard({ detail }) {
	const alert = detail.alert
	return (
		<section
			className="case-panel case-summary case-info-card"
			aria-labelledby="case-info-title"
		>
			<h2 id="case-info-title">케이스·경보 정보</h2>
			<dl>
				<dt>계좌</dt>
				<dd>{detail.accountNo}</dd>
				{alert ? (
					<>
						<dt>경보 번호</dt>
						<dd>{alert.alertNo}</dd>
						<dt>탐지 규칙</dt>
						<dd>{alert.ruleId}</dd>
						<dt>배치 기준일</dt>
						<dd>{alert.batchDate}</dd>
						<dt>묶인 거래</dt>
						<dd>{alert.transactionCount}건</dd>
						{/* ML+DL 조사 순위(SCRUM-420) — 배치 기준일 하루치 경보 안에서의 순위. DL 점수는 있을 때만 */}
						<dt>조사 순위</dt>
						<dd>
							<DlRankText rank={detail.dlRank} />
						</dd>
						{detail.dlRank?.status === "AVAILABLE" && detail.dlRank.dlScore != null && (
							<>
								<dt>DL 점수</dt>
								<dd>{formatScore(detail.dlRank.dlScore)}</dd>
							</>
						)}
					</>
				) : (
					<>
						<dt>경보</dt>
						<dd>경보 정보 없음</dd>
					</>
				)}
				<dt>생성</dt>
				<dd>{formatSystemTime(detail.createdAt)}</dd>
				<dt>버전</dt>
				<dd>{detail.version}</dd>
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
	)
}
