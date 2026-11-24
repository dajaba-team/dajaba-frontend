import { formatSystemTime } from "../../../shared/format/time"
import { ruleLabel } from "../../../shared/format/rule"

// 케이스·경보 정보(SCRUM-369). 점수·반려·종료 사유는 판단 요약에 있어요.
// version 은 동시 수정 검사용 내부 값이라 보여 주지 않아요.
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
						<dd>{ruleLabel(alert.ruleId)}</dd>
						<dt>탐지 기준일</dt>
						<dd>{alert.batchDate}</dd>
						<dt>관련 거래</dt>
						<dd>{alert.transactionCount}건</dd>
					</>
				) : (
					<>
						<dt>경보</dt>
						<dd>경보 정보 없음</dd>
					</>
				)}
				<dt>생성</dt>
				<dd>{formatSystemTime(detail.createdAt)}</dd>
				{detail.updatedAt && (
					<>
						<dt>최근 변경</dt>
						<dd>{formatSystemTime(detail.updatedAt)}</dd>
					</>
				)}
			</dl>
		</section>
	)
}
