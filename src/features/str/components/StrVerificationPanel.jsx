import { formatSystemTime } from "../../../shared/format/time"
import { revisionLabel } from "../../../shared/str/revisionLabel"
import { sectionTitle } from "../../../shared/str/sectionTitles"
import { VERIFICATION_TEXT, verificationState } from "../model/strRules"
import { CHECK_LABELS, CHECK_REASON_LABELS, VERIFICATION_STATUS_LABELS, labelOf } from "../labels"

// 저장본 검증 (화면 설계 STR-02·STR-02-S).
// - 서버가 준 passed·status로만 판단해요. 검사 수를 고정하지 않고 받은 항목 전체를 보여 줘요.
// - llm_checks=null(코드 대조 실패로 미실행)을 0점·빈 목록·통과로 바꾸지 않아요.
// - 검증 통신 실패(VERIFY_UNAVAILABLE·502)를 "내용 부적합"으로 보여 주지 않아요.
export default function StrVerificationPanel({
	verification,
	dirty,
	canVerify,
	verifying,
	verifyError,
	onVerify,
	narrative,
}) {
	const state = verificationState(verification, { dirty })
	const titleOf = (section) => {
		const found = narrative.find((item) => item.section === section)
		return found ? sectionTitle(found) : (section ?? "-")
	}
	return (
		<section className="str-panel" aria-labelledby="str-verify-heading">
			<div className="str-panel-head">
				<h2 id="str-verify-heading">저장본 검증</h2>
				<p role="status" className={`str-verify-state str-verify-${state.toLowerCase()}`}>
					{verifying
						? "저장본을 검증하고 있어요. 최대 90초쯤 걸려요."
						: VERIFICATION_TEXT[state]}
				</p>
			</div>
			{canVerify && (
				<div className="str-actions-row">
					<button
						type="button"
						onClick={onVerify}
						disabled={dirty || verifying}
						title={dirty ? "변경한 내용을 먼저 저장해 주세요." : undefined}
					>
						{verifying ? "검증 중…" : "저장본 검증"}
					</button>
				</div>
			)}
			{verifyError && <p role="alert">{verifyError}</p>}
			{verification && (
				<>
					<dl className="str-facts">
						<div>
							<dt>결과</dt>
							<dd>{labelOf(VERIFICATION_STATUS_LABELS, verification.status)}</dd>
						</div>
						<div>
							<dt>검증한 본문</dt>
							<dd>
								{revisionLabel(verification.revisionNo)}
								{verification.isCurrent ? " · 현재 저장본" : " · 지금 저장본 아님"}
							</dd>
						</div>
						<div>
							<dt>검증 시각</dt>
							<dd>{formatSystemTime(verification.producedAt) || "-"}</dd>
						</div>
						<div>
							<dt>검증기</dt>
							<dd>{verification.verifierVersion ?? "-"}</dd>
						</div>
					</dl>
					<h3>코드 대조 ({verification.codeChecks.length}항목)</h3>
					{verification.codeChecks.length ? (
						<table className="str-table">
							<thead>
								<tr>
									<th scope="col">검사</th>
									<th scope="col">결과</th>
									<th scope="col">본문 값 / 원본 값</th>
									<th scope="col">항목</th>
								</tr>
							</thead>
							<tbody>
								{[...verification.codeChecks]
									// 실패 항목을 먼저(STR-02-S CODE_FAILED). 순서는 안정 정렬이라 같은 결과끼리는 받은 순서.
									.sort((a, b) => Number(a.match) - Number(b.match))
									.map((check, index) => (
										<tr key={`${check.check}-${index}`}>
											<th scope="row">
												{labelOf(CHECK_LABELS, check.check)}
											</th>
											<td>
												{check.match
													? "통과"
													: labelOf(
															CHECK_REASON_LABELS,
															check.reason ?? "MISMATCH",
														)}
											</td>
											<td>
												{check.draftValue ?? "-"} /{" "}
												{check.sourceValue ?? "-"}
											</td>
											<td>
												{check.section ? (
													<a href={`#str-section-${check.section}`}>
														{titleOf(check.section)}
													</a>
												) : (
													"-"
												)}
											</td>
										</tr>
									))}
							</tbody>
						</table>
					) : (
						<p>코드 대조 항목이 없어요.</p>
					)}
					<h3>AI 평가</h3>
					{verification.llmChecks === null ? (
						<p>코드 대조가 실패해 AI 평가는 실행하지 않았어요.</p>
					) : (
						<ul className="str-llm-checks">
							{verification.llmChecks.map((check) => (
								<li
									key={check.check}
									className={check.score < 4 ? "str-error" : undefined}
								>
									<strong>{labelOf(CHECK_LABELS, check.check)}</strong>{" "}
									{check.score}/5
									{check.comment && ` · ${check.comment}`}
								</li>
							))}
							<li className="str-muted">모든 항목이 4점 이상이어야 통과예요.</li>
						</ul>
					)}
				</>
			)}
		</section>
	)
}
