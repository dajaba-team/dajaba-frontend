import { formatSystemTime } from "../../../shared/format/time"
import { revisionLabel } from "../../../shared/str/revisionLabel"
import { sectionTitle } from "../../../shared/str/sectionTitles"
import InfoTip from "../../../shared/ui/InfoTip"
import {
	CODE_CHECKS,
	CODE_REASON_LABELS,
	HIDDEN_CHECKS,
	LLM_CHECKS,
	LLM_PASS_SCORE,
	LLM_SKIPPED_NOTES,
	VERIFICATION_CHECK_HELP,
	VERIFICATION_STATUS_LABELS,
} from "../verificationLabels"
import { VERIFICATION_TEXT } from "../model/strRules"
import StatusBadge from "../../../shared/ui/StatusBadge"
import Button from "../../../shared/ui/Button"

// 검증 결과 패널 (SCRUM-116). 표의 코드 검사 6개·AI 평가 5개를 늘 다 보여 주고, 실패한 항목을 위로 올려요.
// 표에 없는 검사 이름이 응답에 오면 이름 그대로 표 뒤에 보여 줘요(옛 GROUNDING만 뺌).
// 통과·실패 판단은 서버 passed·status 그대로예요 — 화면은 줄마다 표시만 하고 전체 결과를 다시 계산하지 않아요.
// STR 작성 화면(2/2)은 선택 props로 [저장본 검증]·[다시 검증] 버튼(canVerify·onVerify), 미저장 안내(dirty),
// 검증 중 안내(verifying), 실패 안내(verifyError)를 붙여요. 결과(VERIFY_UNAVAILABLE 포함)는 서버가 준 최신 검증으로 패널에 남아요.

const PASS_RULE = `통과 기준: 코드 검사 전부 통과 + AI 평가 전부 ${LLM_PASS_SCORE}점 이상`

// 표 항목 + 응답에만 있는 이름(이름을 그대로 제목으로). 숨기면 "실패"인데 실패 항목이 안 보여요.
function withUnlisted(table, rows) {
	const listed = new Set(table.map(([check]) => check))
	const extra = [...new Set((rows ?? []).map((row) => row.check))].filter(
		(check) => !listed.has(check) && !HIDDEN_CHECKS.includes(check),
	)
	return [...table, ...extra.map((check) => [check, check])]
}

// 같은 검사가 여러 줄 올 수 있어요(DATE_MATCH는 날짜 하나당 한 줄). 한 줄이라도 틀리면 그 검사는 실패.
function codeCheckItems(codeChecks) {
	return withUnlisted(CODE_CHECKS, codeChecks).map(([check, label]) => {
		const rows = codeChecks.filter((row) => row.check === check)
		const failedRows = rows.filter((row) => row.match === false)
		const state = rows.length === 0 ? "NONE" : failedRows.length > 0 ? "FAIL" : "PASS"
		return { check, label, rows, failedRows, state }
	})
}

// llmChecks가 null이면 평가 결과가 없는 것(코드 검사 실패 또는 평가 서비스 오류) — "0개"와 다르게 "평가 안 함"으로 보여 줘요.
function llmCheckItems(llmChecks) {
	return withUnlisted(LLM_CHECKS, llmChecks).map(([check, label]) => {
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
// 줄 상태·전체 결과 → 상태 배지 뜻(SCRUM-332). 강조는 배지에만 — 줄 테두리는 칠하지 않아요.
const CHECK_STATE_TONES = { PASS: "success", FAIL: "danger", NONE: "neutral", SKIPPED: "neutral" }
const verificationTone = (verification) => {
	if (verification.passed) return "success"
	return verification.status === "VERIFY_UNAVAILABLE" ? "warning" : "danger"
}
const LLM_STATE_TEXT = { PASS: "통과", FAIL: "미달", NONE: "결과 없음", SKIPPED: "평가 안 함" }

// 줄의 section이 null이면 초안 전체를 본 검사예요(건수·근거 범위 등).
const rowSection = (section) =>
	section == null ? "초안 전체" : sectionTitle({ section, label: null })

const valueText = (value) => (value == null || value === "" ? "-" : String(value))

function CheckName({ item }) {
	const help = VERIFICATION_CHECK_HELP[item.check]

	return (
		<span className="str-check-name">
			<strong>{item.label}</strong>
			{help && <InfoTip label={item.label} text={help} />}
		</span>
	)
}

function CodeCheckRow({ item }) {
	return (
		<li className={`str-check str-check--${item.state.toLowerCase()}`}>
			<div className="str-check-head">
				<CheckName item={item} />
				<StatusBadge className="str-check-state" tone={CHECK_STATE_TONES[item.state]}>
					{CODE_STATE_TEXT[item.state]}
				</StatusBadge>
			</div>
			{item.state === "NONE" && (
				<p className="str-check-note">이번 검증에서 검사한 값이 없어요.</p>
			)}
			{item.state === "PASS" && (
				<p className="str-check-note">검사한 {item.rows.length}곳 모두 통과했어요.</p>
			)}
			{item.failedRows.length > 0 && (
				<ul className="str-check-rows">
					{item.failedRows.map((row, index) => (
						<li key={`${row.section}-${index}`}>
							<span className="str-check-reason">
								{CODE_REASON_LABELS[row.reason] ?? row.reason ?? "불일치"}
							</span>{" "}
							· {rowSection(row.section)} · 본문 {valueText(row.draftValue)} · 원본{" "}
							{valueText(row.sourceValue)}
						</li>
					))}
				</ul>
			)}
		</li>
	)
}

function LlmCheckRow({ item, status }) {
	return (
		<li className={`str-check str-check--${item.state.toLowerCase()}`}>
			<div className="str-check-head">
				<CheckName item={item} />
				<StatusBadge className="str-check-state" tone={CHECK_STATE_TONES[item.state]}>
					{item.row?.score != null && `${item.row.score}점 · `}
					{LLM_STATE_TEXT[item.state]}
				</StatusBadge>
			</div>
			{item.state === "SKIPPED" && (
				<p className="str-check-note">
					{LLM_SKIPPED_NOTES[status] ?? "AI 평가 결과가 없어요."}
				</p>
			)}
			{item.row?.comment && <p className="str-check-note">{item.row.comment}</p>}
		</li>
	)
}

// 검증 실행 줄 — 결과가 없을 때도 있을 때도 같은 자리에 보여요. 가짜 진행률은 없어요.
// [저장본 검증]은 승인 요청 전에 꼭 거치는 단계라 파란 주 버튼(SCRUM-432). 고친 게 저장 전이면 꺼진 회색이에요.
// "최대 90초" 안내는 뺐어요 — 실제로는 몇 초 안에 끝나요(SCRUM-432).
function VerifyControls({ hasResult, dirty, canVerify, verifying, verifyError, onVerify }) {
	return (
		<>
			{dirty && (
				<p role="status" className="str-check-note">
					{VERIFICATION_TEXT.UNSAVED}
				</p>
			)}
			{canVerify && (
				<div className="str-toolbar">
					<Button variant="primary" onClick={onVerify} disabled={dirty || verifying}>
						{verifying ? "검증 중…" : hasResult ? "다시 검증" : "저장본 검증"}
					</Button>
				</div>
			)}
			{verifying && (
				<p role="status" className="str-check-note">
					저장본을 검증하고 있어요. 잠시만 기다려 주세요.
				</p>
			)}
			{verifyError && <p role="alert">{verifyError}</p>}
		</>
	)
}

export default function VerificationPanel({
	verification,
	currentRevisionNo,
	dirty = false,
	canVerify = false,
	verifying = false,
	verifyError = null,
	onVerify,
}) {
	const controls = (
		<VerifyControls
			hasResult={Boolean(verification)}
			dirty={dirty}
			canVerify={canVerify}
			verifying={verifying}
			verifyError={verifyError}
			onVerify={onVerify}
		/>
	)
	if (!verification) {
		return (
			<section className="str-panel" aria-labelledby="str-verify-heading">
				<div className="str-panel-head">
					<h2 id="str-verify-heading">검증 결과</h2>
					<p>{PASS_RULE}</p>
				</div>
				{controls}
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
					<StatusBadge
						className="str-verify-status"
						tone={verificationTone(verification)}
					>
						{statusText}
					</StatusBadge>{" "}
					· {revisionLabel(verification.revisionNo)} 검증
					{verification.producedAt && ` · ${formatSystemTime(verification.producedAt)}`}
				</p>
				<p>{PASS_RULE}</p>
			</div>
			{controls}
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
					<LlmCheckRow key={item.check} item={item} status={verification.status} />
				))}
			</ul>
		</section>
	)
}
