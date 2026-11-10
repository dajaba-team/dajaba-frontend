import { formatSystemTime } from "../../../shared/format/time"
import { revisionLabel } from "../../../shared/str/revisionLabel"
import { sectionTitle } from "../../../shared/str/sectionTitles"
import {
	CODE_CHECKS,
	CODE_REASON_LABELS,
	LLM_CHECKS,
	LLM_PASS_SCORE,
	VERIFICATION_STATUS_LABELS,
} from "../verificationLabels"

// 검증 결과 패널 (SCRUM-116). 코드 검사 5개·AI 평가 5개를 늘 다 보여 주고, 실패한 항목을 위로 올려요.
// 통과·실패 판단은 서버 passed·status 그대로예요 — 화면은 줄마다 표시만 하고 전체 결과를 다시 계산하지 않아요.
// 검증을 다시 돌리는 버튼·검증 못 함 유지는 SCRUM-117에서 붙여요.

const PASS_RULE = `통과 기준: 코드 검사 5개 전부 통과 + AI 평가 전부 ${LLM_PASS_SCORE}점 이상`

// 같은 검사가 여러 줄 올 수 있어요(DATE_MATCH는 날짜 하나당 한 줄). 한 줄이라도 틀리면 그 검사는 실패.
function codeCheckItems(codeChecks) {
	return CODE_CHECKS.map(([check, label]) => {
		const rows = codeChecks.filter((row) => row.check === check)
		const failedRows = rows.filter((row) => row.match === false)
		const state = rows.length === 0 ? "NONE" : failedRows.length > 0 ? "FAIL" : "PASS"
		return { check, label, rows, failedRows, state }
	})
}

// llmChecks가 null이면 평가를 안 돌린 것(코드 검사 실패) — "0개"와 다르게 "평가 안 함"으로 보여 줘요.
function llmCheckItems(llmChecks) {
	return LLM_CHECKS.map(([check, label]) => {
		const row = llmChecks?.find((item) => item.check === check) ?? null
		const state =
			llmChecks == null
				? "SKIPPED"
				: row == null || row.score == null
					? "NONE"
					: row.score >= LLM_PASS_SCORE
						? "PASS"
						: "FAIL"
		return { check, label, row, state }
	})
}

// 실패 먼저, 나머지는 표 순서 그대로(안정 정렬).
const failedFirst = (items) => [
	...items.filter((item) => item.state === "FAIL"),
	...items.filter((item) => item.state !== "FAIL"),
]

const CODE_STATE_TEXT = { PASS: "통과", FAIL: "실패", NONE: "검사 없음" }
const LLM_STATE_TEXT = { PASS: "통과", FAIL: "미달", NONE: "결과 없음", SKIPPED: "평가 안 함" }

const valueText = (value) => (value == null || value === "" ? "-" : String(value))

function CodeCheckRow({ item }) {
	return (
		<li className={`str-check str-check--${item.state.toLowerCase()}`}>
			<div className="str-check-head">
				<strong>{item.label}</strong>
				<code>{item.check}</code>
				<span className="str-check-state">{CODE_STATE_TEXT[item.state]}</span>
			</div>
			{item.state === "NONE" && (
				<p className="str-check-note">이번 검증에서 검사한 값이 없어요.</p>
			)}
			{item.state === "PASS" && (
				<p className="str-check-note">{item.rows.length}곳 모두 원본과 같아요.</p>
			)}
			{item.failedRows.length > 0 && (
				<ul className="str-check-rows">
					{item.failedRows.map((row, index) => (
						<li key={`${row.section}-${index}`}>
							<span className="str-check-reason">
								{CODE_REASON_LABELS[row.reason] ?? row.reason ?? "불일치"}
							</span>{" "}
							· {sectionTitle({ section: row.section, label: null })} · 본문{" "}
							{valueText(row.draftValue)} · 원본 {valueText(row.sourceValue)}
						</li>
					))}
				</ul>
			)}
		</li>
	)
}

function LlmCheckRow({ item }) {
	return (
		<li className={`str-check str-check--${item.state.toLowerCase()}`}>
			<div className="str-check-head">
				<strong>{item.label}</strong>
				<code>{item.check}</code>
				<span className="str-check-state">
					{item.row?.score != null && `${item.row.score}점 · `}
					{LLM_STATE_TEXT[item.state]}
				</span>
			</div>
			{item.state === "SKIPPED" && (
				<p className="str-check-note">코드 검사가 실패해서 AI 평가를 돌리지 않았어요.</p>
			)}
			{item.row?.comment && <p className="str-check-note">{item.row.comment}</p>}
		</li>
	)
}

export default function VerificationPanel({ verification, currentRevisionNo }) {
	if (!verification) {
		return (
			<section className="str-panel" aria-labelledby="str-verify-heading">
				<div className="str-panel-head">
					<h2 id="str-verify-heading">검증 결과</h2>
					<p>{PASS_RULE}</p>
				</div>
				<p>아직 검증하지 않았어요.</p>
			</section>
		)
	}
	const codeItems = failedFirst(codeCheckItems(verification.codeChecks))
	const llmItems = failedFirst(llmCheckItems(verification.llmChecks))
	const stale =
		verification.isCurrent === false ||
		(currentRevisionNo != null && verification.revisionNo !== currentRevisionNo)
	const statusText =
		VERIFICATION_STATUS_LABELS[verification.status] ??
		(verification.passed ? "통과" : "통과 못 함")
	return (
		<section className="str-panel" aria-labelledby="str-verify-heading">
			<div className="str-panel-head">
				<h2 id="str-verify-heading">검증 결과</h2>
				<p>
					<strong
						className={`str-verify-status ${verification.passed ? "is-passed" : "is-failed"}`}
					>
						{statusText}
					</strong>{" "}
					· {revisionLabel(verification.revisionNo)} 검증
					{verification.producedAt && ` · ${formatSystemTime(verification.producedAt)}`}
				</p>
				<p>{PASS_RULE}</p>
			</div>
			{stale && (
				<p role="note" className="str-restricted">
					지금 저장된 수정본이 아닌 이전 수정본을 검증한 결과예요. 다시 검증해야 승인
					요청을 할 수 있어요.
				</p>
			)}
			<h3>코드 검사</h3>
			<ul className="str-checks" aria-label="코드 검사">
				{codeItems.map((item) => (
					<CodeCheckRow key={item.check} item={item} />
				))}
			</ul>
			<h3>AI 평가</h3>
			<ul className="str-checks" aria-label="AI 평가">
				{llmItems.map((item) => (
					<LlmCheckRow key={item.check} item={item} />
				))}
			</ul>
		</section>
	)
}
