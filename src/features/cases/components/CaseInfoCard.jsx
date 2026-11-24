import { formatDataTime, formatSystemTime } from "../../../shared/format/time"
import { ruleLabel } from "../../../shared/format/rule"

// 케이스 개요 띠 — 판단 요약 바로 아래, 본문을 읽기 전에 "무엇을 보고 있는지"를 한 줄로(계좌·경보·규칙·탐지 기간).
// 점수·상태·담당·반려/종료 사유는 판단 요약에 있어요. version 은 동시 수정 검사용 내부 값이라 보여 주지 않아요.
function Item({ label, children }) {
	return (
		<div>
			<dt>{label}</dt>
			<dd>{children}</dd>
		</div>
	)
}

export default function CaseInfoCard({ detail }) {
	const alert = detail.alert
	return (
		<section className="case-overview-strip" aria-labelledby="case-info-title">
			<h2 id="case-info-title" className="visually-hidden">
				케이스·경보 정보
			</h2>
			<dl>
				<Item label="계좌">{detail.accountNo}</Item>
				{alert ? (
					<>
						<Item label="탐지 규칙">{ruleLabel(alert.ruleId)}</Item>
						<Item label="탐지 기간">
							{formatDataTime(alert.windowStart)} ~ {formatDataTime(alert.windowEnd)}
						</Item>
						<Item label="관련 거래">{alert.transactionCount}건</Item>
						<Item label="경보 번호">{alert.alertNo}</Item>
						<Item label="탐지 기준일">{alert.batchDate}</Item>
					</>
				) : (
					<Item label="경보">경보 정보 없음</Item>
				)}
				<Item label="생성">{formatSystemTime(detail.createdAt)}</Item>
				{detail.updatedAt && (
					<Item label="최근 변경">{formatSystemTime(detail.updatedAt)}</Item>
				)}
			</dl>
		</section>
	)
}
