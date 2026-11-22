import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { useCaseDetail } from "../../cases/hooks/useCases"
import { draftKey, useStrCommand, useStrDraft } from "../hooks/useStrDraft"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemTime } from "../../../shared/format/time"
import VerificationPanel from "../components/VerificationPanel"
import { revisionLabel } from "../../../shared/str/revisionLabel"
import { sectionTitle } from "../../../shared/str/sectionTitles"
import { suspicionTypeLabel } from "../../../shared/str/suspicionTypes"
import { getErrorCode, getErrorMessage, isVersionConflict } from "../../../shared/api/apiClient"
import { STATUS_LABELS, STATUS_TONES, REJECTION_LABELS } from "../../cases/labels"
import StatusBadge from "../../../shared/ui/StatusBadge"
import { CloseForm } from "../../cases/components/CaseActions"
import StrNarrative from "../components/StrNarrative"
import StrFacts from "../components/StrFacts"
import StrSuspicionPanel from "../components/StrSuspicionPanel"
import StrReferencePanel from "../components/StrReferencePanel"
import StrRevisionHistory from "../components/StrRevisionHistory"
import StrGenerateForm from "../components/StrGenerateForm"
import StrChangeReview from "../components/StrChangeReview"
import { baseOptions } from "../model/changeReview"
import { useSession } from "../../auth/hooks/useSession"
import ApprovalDialog from "../../approvals/components/ApprovalDialog"
import {
	changedSections,
	currentRejection,
	sectionError,
	stateNotice,
	strActionsFor,
	submitBlockReason,
	verificationState,
} from "../model/strRules"
import { DRAFT_STATUS_LABELS, labelOf } from "../labels"
import "../../cases/styles/cases.css"
import "../styles/str.css"
import { useGuide } from "../../../shared/ui/useGuide"
import { strWorkflowGuide } from "../../../shared/ui/workflowGuide"

// STR 작성 화면 /cases/:caseNo/str (화면 설계 STR-01~04).
// 케이스 상세(C2) → 지금 초안 번호(current_draft_no) → 초안(S2) 순서로 불러와요.
// 순서: 초안 생성(≤90초) → 항목 수정·저장(S3) → 저장본 검증(S5, ≤90초) → 통과면 VI부 입력 후 승인 요청(S6).
export default function StrPage() {
	const { caseNo } = useParams()
	const caseQuery = useCaseDetail(caseNo)
	const detail = caseQuery.data
	const draftNo = detail?.currentDraftNo ?? null
	const draftQuery = useStrDraft(draftNo)
	const draft = draftQuery.data
	const [generating, setGenerating] = useState(false)
	const role = useSession().data?.role
	const caseStatus = detail?.status ?? draft?.caseStatus ?? null
	useGuide(strWorkflowGuide({ draft, detail, role }))
	// 개발·테스트용 원시 값(초안 상태 코드·생성기 버전·생성 시각)은 화면 대신 개발 콘솔로만 남겨요.
	useEffect(() => {
		if (!import.meta.env.DEV || !draft) return
		console.debug("[STR]", {
			draftNo: draft.draftNo,
			draftStatus: draft.status,
			caseStatus,
			currentRevisionNo: draft.currentRevisionNo,
			generatorVersion: draft.generatorVersion,
			producedAt: draft.producedAt,
		})
	}, [draft, caseStatus])
	return (
		<>
			<nav className="str-backlinks" aria-label="돌아가기">
				{/* 승인함에서 들어온 승인자·관리자가 목록으로 바로 돌아가게 */}
				{(role === "APPROVER" || role === "ADMIN") && (
					<Link to="/approvals">← 승인함으로 돌아가기</Link>
				)}
				<Link to={`/cases/${encodeURIComponent(caseNo)}`}>← 케이스 상세</Link>
			</nav>
			<div className="str-page-heading">
				<h1>STR 보고서 초안</h1>
				{draft && (
					<ul className="str-chips" aria-label="초안 정보">
						<li>{detail?.caseNo ?? draft.caseNo ?? caseNo}</li>
						<li>{draft.draftNo}</li>
						{caseStatus && (
							<li className="str-chip-status">
								<StatusBadge tone={STATUS_TONES[caseStatus]}>
									{labelOf(STATUS_LABELS, caseStatus)}
								</StatusBadge>
							</li>
						)}
						{draft.status !== "ACTIVE" && (
							<li className="str-chip-muted">
								{labelOf(DRAFT_STATUS_LABELS, draft.status)}
							</li>
						)}
					</ul>
				)}
			</div>
			<AsyncState query={caseQuery} />
			{detail && !draftNo && (
				<section className="str-panel">
					<p>이 케이스에는 아직 STR 초안이 없어요.</p>
					{detail.availableActions.includes("GENERATE_DRAFT") &&
						(generating ? (
							<StrGenerateForm detail={detail} onDone={() => setGenerating(false)} />
						) : (
							<button type="button" onClick={() => setGenerating(true)}>
								STR 초안 생성
							</button>
						))}
				</section>
			)}
			{draftNo && <AsyncState query={draftQuery} />}
			{draft && draft.access === "META_ONLY" && (
				<p role="note" className="str-restricted">
					본문은 담당 조사역과 승인자만 볼 수 있어요. 상태와 날짜만 보여 드려요.
				</p>
			)}
			{draft && !draft.contentVisible && draft.access !== "META_ONLY" && (
				<div role="alert" className="str-restricted">
					<p>접근 범위를 확인할 수 없어 본문을 보여 드리지 않아요.</p>
					<button type="button" onClick={() => draftQuery.refetch()}>
						다시 불러오기
					</button>
				</div>
			)}
			{/* 초안이 바뀌면(재생성) 편집·검증·선택 상태를 처음부터 — key */}
			{draft?.contentVisible && detail && (
				<StrWorkspace key={draft.draftNo} draft={draft} detail={detail} />
			)}
		</>
	)
}

function StrWorkspace({ draft, detail }) {
	const client = useQueryClient()
	const me = useSession().data
	const actions = strActionsFor(draft)
	const can = (action) => actions.includes(action)
	const editable = can("REVISE")
	// 수정 이력은 담당 조사역만(승인자는 [변경 비교]로 고친 곳만 봐요)
	const isAssignee =
		me?.role === "INVESTIGATOR" &&
		Boolean(me.loginId) &&
		detail.assignee?.loginId === me.loginId
	const isApprover = me?.role === "APPROVER"
	// 화면 아래 안내 한 줄 — 마지막으로 끝난 작업만(저장 안내와 승인 요청 안내가 겹치지 않게)
	const [doneMessage, setDoneMessage] = useState(null)

	// 편집 중 값 {section: text}. 저장본과 같아지면 미저장 아님.
	const [inputs, setInputs] = useState({})
	const changes = changedSections(draft.narrative, inputs)
	const dirty = changes.length > 0
	const invalid = changes.some((item) => sectionError(item.text))

	// VI부 — 서버 값으로 시작, 승인 요청 때 보냄(따로 저장 API 없음).
	const [types, setTypes] = useState(draft.suspicionTypes)
	const [level, setLevel] = useState(draft.suspicionLevelBranch)

	const [panel, setPanel] = useState(null) // "history" | "regenerate" | "close" | "submit"
	// 승인자 결정(P2·P3) 확인창 — 승인함과 같은 ApprovalDialog. mode: APPROVE·NEED_REVISION·NOT_REPORTABLE
	const [decision, setDecision] = useState(null)
	// 409 등으로 재조회가 끝났을 때 한 번 확인 — 서버가 그 동작을 더는 안 주면(다른 승인자가 먼저 처리)
	// 확인창을 닫고 안내해요. 아직 주면(예: 메모 수정으로 version만 바뀜) 확인창을 두고 새 version으로 다시 눌러요.
	// 재조회 직후엔 화면이 아직 옛 draft로 그려져 있어서, 캐시에 들어온 최신 S2로 판단해요.
	const [decisionGone, setDecisionGone] = useState(false)
	const checkDecisionStale = () => {
		const fresh = client.getQueryData(draftKey(draft.draftNo))
		const needed = decision === "APPROVE" ? "APPROVE" : "REJECT"
		if (fresh && strActionsFor(fresh).includes(needed)) return
		setDecision(null)
		setDecisionGone(true)
	}
	const openDecision = (mode) => {
		setDecisionGone(false)
		setDecision(mode)
	}
	const caseVersion = detail.version ?? draft.caseVersion

	const save = useStrCommand(detail.caseNo, draft.draftNo, "saveRevision")
	const verify = useStrCommand(detail.caseNo, draft.draftNo, "verify")
	const submit = useStrCommand(detail.caseNo, draft.draftNo, "submit")
	const conflict = save.isError && isVersionConflict(save.error)

	// 미저장 편집이 있으면 창 닫기·새로고침 전에 브라우저가 확인해요.
	useEffect(() => {
		if (!dirty) return undefined
		const warn = (event) => event.preventDefault()
		window.addEventListener("beforeunload", warn)
		return () => window.removeEventListener("beforeunload", warn)
	}, [dirty])

	const verification = draft.latestVerification
	const vState = verificationState(verification, { dirty })
	// 검증 실패 위치 표시는 "현재 저장본 기준" 결과일 때만(예전 결과로 지금 본문을 표시하지 않음).
	const failedChecks =
		!dirty && verification?.isCurrent
			? verification.codeChecks.filter((check) => !check.match)
			: []
	// 반려 띠: 보완 중(REJECTED·DRAFTED)만 — S2 last_rejection, 새 초안이면 케이스 이력의 최신 반려(STR-04)
	const rejection = currentRejection(draft, detail)
	const rejectionCode =
		rejection?.reasonCode ?? (detail.status === "REJECTED" ? detail.rejectionReasonCode : null)
	const blockReason = submitBlockReason({
		actions,
		caseStatus: detail.status,
		dirty,
		verification,
		types,
		level,
		narrativeUnchanged: rejection?.narrativeUnchanged === true,
	})
	const notice = stateNotice(draft, detail, {
		role: me?.role,
		canDecide: can("APPROVE") || can("REJECT"),
	})
	// 변경 비교 기준 — 반려 당시 수정본(S2 last_rejection, 승인 대기 중에도 남아요)
	const rejectionRevisionNo = draft.lastRejection?.revisionNo ?? null
	const canReview =
		(isAssignee || isApprover) &&
		baseOptions(draft.currentRevisionNo, rejectionRevisionNo).length > 0

	const doSave = () => {
		if (!dirty || invalid || save.isPending) return
		setDoneMessage(null)
		save.mutate(
			{ caseVersion, sections: changes },
			{
				onSuccess: (saved) => {
					setInputs({})
					// needs_verification=false(검증 대상 그대로)일 때만 짧게. 없으면 다시 검증 안내
					setDoneMessage(
						saved.needsVerification === false
							? `${revisionLabel(saved.revisionNo)}으로 저장했어요.`
							: `${revisionLabel(saved.revisionNo)}으로 저장했어요. 저장본을 다시 검증해 주세요.`,
					)
				},
			},
		)
	}

	return (
		<>
			{(rejectionCode || notice) && (
				<section className="str-banner" aria-label="지금 상태">
					{rejectionCode && (
						<p>
							<strong>반려 · {labelOf(REJECTION_LABELS, rejectionCode)}</strong>
							{rejection?.comment && ` — ${rejection.comment}`}
							{rejection?.decidedBy && ` · ${rejection.decidedBy}`}
							{rejection?.decidedAt && ` · ${formatSystemTime(rejection.decidedAt)}`}
							{rejection?.revisionNo != null &&
								` · 대상 ${revisionLabel(rejection.revisionNo)}`}
							{rejection?.previousDraft && " · 이전 초안에 대한 반려"}
						</p>
					)}
					{rejection?.reasonCode === "NEED_REVISION" && rejection.narrativeUnchanged && (
						<p>
							아직 반려 당시 본문 그대로예요. 고쳐 저장해야 다시 승인 요청할 수
							있어요.
						</p>
					)}
					{notice && <p>{notice}</p>}
					{isApprover && draft.lastRejection && detail.status === "PENDING_APPROVAL" && (
						<p>
							지난 반려({labelOf(REJECTION_LABELS, draft.lastRejection.reasonCode)})
							뒤 다시 요청한 건이에요. [변경 비교]에서 고친 곳을 확인하세요.
						</p>
					)}
				</section>
			)}

			{(isAssignee || canReview) && (
				<div className="str-toolbar">
					{canReview && (
						<button
							type="button"
							aria-pressed={panel === "review"}
							onClick={() => setPanel(panel === "review" ? null : "review")}
						>
							변경 비교
						</button>
					)}
					{isAssignee && (
						<button
							type="button"
							aria-pressed={panel === "history"}
							onClick={() => setPanel(panel === "history" ? null : "history")}
						>
							수정 이력
						</button>
					)}
				</div>
			)}
			{panel === "review" && (
				<StrChangeReview
					draftNo={draft.draftNo}
					narrative={draft.narrative}
					currentRevisionNo={draft.currentRevisionNo}
					rejectionRevisionNo={rejectionRevisionNo}
					onClose={() => setPanel(null)}
				/>
			)}
			{panel === "history" && isAssignee && (
				<StrRevisionHistory draftNo={draft.draftNo} onClose={() => setPanel(null)} />
			)}

			<StrFacts facts={draft.facts} />

			<div className="str-grid">
				<section className="str-panel" aria-labelledby="str-narrative-heading">
					<div className="str-panel-head">
						<h2 id="str-narrative-heading">서술부</h2>
						<p>
							{draft.narrative.length}개 항목 ·{" "}
							{revisionLabel(draft.currentRevisionNo)}
							{editable
								? " · 문장만 고칠 수 있어요(숫자·근거는 서버가 관리)"
								: " · 읽기 전용"}
						</p>
					</div>
					<StrNarrative
						narrative={draft.narrative}
						editable={editable}
						inputs={inputs}
						onChange={(section, text) =>
							setInputs((prev) => ({ ...prev, [section]: text }))
						}
						failedChecks={failedChecks}
					/>
					{conflict && (
						<ConflictCompare
							narrative={draft.narrative}
							changes={changes}
							onUseLatest={() => {
								setInputs({})
								save.reset()
							}}
							onKeepMine={() => {
								save.reset()
								doSave()
							}}
						/>
					)}
				</section>

				<div className="str-aside">
					{/* 검증 결과 표시는 #32 패널 하나로 — 2/2는 버튼·미저장 안내·verify 호출만 더해요 */}
					<VerificationPanel
						verification={verification}
						currentRevisionNo={draft.currentRevisionNo}
						dirty={dirty}
						canVerify={can("VERIFY")}
						verifying={verify.isPending}
						verifyError={verify.isError ? getErrorMessage(verify.error) : null}
						onVerify={() => {
							if (dirty || verify.isPending) return
							setDoneMessage(null)
							verify.mutate({})
						}}
					/>
					<StrSuspicionPanel
						editable={editable}
						types={types}
						level={level}
						levelHq={draft.suspicionLevelHq}
						recommended={draft.suspicionTypesRecommended}
						onTypesChange={setTypes}
						onLevelChange={setLevel}
					/>
					{/* 참고 사례(SCRUM-312·333) — 찾기는 서버가 SEARCH_REFERENCES를 줄 때만, 잠긴 초안에서도 */}
					<StrReferencePanel
						draftNo={draft.draftNo}
						references={draft.references}
						facts={draft.facts}
						canSearch={can("SEARCH_REFERENCES")}
					/>
				</div>
			</div>

			<section className="str-actionbar" aria-label="STR 작업">
				{editable && (
					<button
						type="button"
						onClick={doSave}
						disabled={!dirty || invalid || save.isPending}
					>
						{save.isPending ? "저장 중…" : "변경 저장"}
					</button>
				)}
				{can("SUBMIT") && (
					<button
						type="button"
						className="primary"
						onClick={() => setPanel("submit")}
						disabled={Boolean(blockReason) || submit.isPending || panel === "submit"}
					>
						승인 요청
					</button>
				)}
				{can("REGENERATE") && (
					<button
						type="button"
						onClick={() => setPanel("regenerate")}
						disabled={panel === "regenerate"}
					>
						다시 생성
					</button>
				)}
				{can("CLOSE_WITH_DRAFT") && (
					<button
						type="button"
						onClick={() => setPanel("close")}
						disabled={panel === "close"}
					>
						종료
					</button>
				)}
				{/* 승인자: 본문을 보면서 바로 결정(APR-02). 자기 승인이면 서버가 []를 줘서 안 보여요 */}
				{can("APPROVE") && (
					<button
						type="button"
						className="primary"
						onClick={() => openDecision("APPROVE")}
						disabled={Boolean(decision)}
					>
						승인
					</button>
				)}
				{can("REJECT") &&
					["NEED_REVISION", "NOT_REPORTABLE"].map((mode) => (
						<button
							key={mode}
							type="button"
							onClick={() => openDecision(mode)}
							disabled={Boolean(decision)}
						>
							{REJECTION_LABELS[mode]}
						</button>
					))}
				{dirty && (
					<span role="status" className="str-dirty">
						저장하지 않은 변경이 있어요
					</span>
				)}
				{(editable || can("SUBMIT")) && blockReason && (
					<span className="str-block-reason">{blockReason}</span>
				)}
			</section>
			{save.isError && !conflict && (
				<p role="alert">
					{getErrorMessage(save.error)}
					{getErrorCode(save.error) === "INVALID_CASE_TRANSITION" &&
						" 작성 내용은 유지돼요."}
				</p>
			)}
			{doneMessage && !dirty && <p role="status">{doneMessage}</p>}

			{panel === "submit" && (
				<SubmitConfirm
					draft={draft}
					verification={verification}
					types={types}
					level={level}
					command={submit}
					blocked={Boolean(blockReason) || vState !== "PASSED"}
					onConfirm={() =>
						submit.mutate(
							{
								caseVersion,
								verificationId: verification.verificationId,
								suspicionTypes: types,
								suspicionLevelBranch: level,
							},
							{
								onSuccess: () => {
									setPanel(null)
									setDoneMessage("승인 요청을 보냈어요. 승인자 결정을 기다려요.")
								},
							},
						)
					}
					onCancel={() => {
						submit.reset()
						setPanel(null)
					}}
				/>
			)}
			{panel === "regenerate" && (
				<StrGenerateForm
					detail={detail}
					regenerate
					blockedReason={dirty ? "변경한 내용을 먼저 저장하거나 되돌려 주세요." : null}
					onDone={() => setPanel(null)}
				/>
			)}
			{decisionGone && (
				<p role="status">
					다른 승인자가 먼저 처리한 건이에요. 최신 상태를 다시 불러왔어요.
				</p>
			)}
			{decision && (
				<ApprovalDialog
					item={{
						draftNo: draft.draftNo,
						caseNo: detail.caseNo,
						caseVersion,
						assignee: detail.assignee,
					}}
					mode={decision}
					onClose={() => setDecision(null)}
					onStale={checkDecisionStale}
				/>
			)}
			{panel === "close" && (
				<CloseForm
					detail={detail}
					name="closeWithDraft"
					onDone={() => setPanel(null)}
					onClosed={() => client.invalidateQueries({ queryKey: draftKey(draft.draftNo) })}
				/>
			)}
		</>
	)
}

// 409 CONCURRENT_UPDATE — 내 입력은 그대로 두고 최신 서버 본문과 나란히 보여 줘요(STR-03 ②). 자동 병합·재전송 없음.
function ConflictCompare({ narrative, changes, onUseLatest, onKeepMine }) {
	return (
		<section className="str-conflict" role="alert" aria-label="동시 수정 비교">
			<p>
				<strong>다른 곳에서 먼저 저장했어요.</strong> 내가 고친 항목과 최신 서버 본문을
				비교한 뒤 골라 주세요.
			</p>
			<table className="str-table">
				<thead>
					<tr>
						<th scope="col">항목</th>
						<th scope="col">내가 편집한 본문</th>
						<th scope="col">최신 서버 본문</th>
					</tr>
				</thead>
				<tbody>
					{changes.map((item) => {
						const latest = narrative.find((section) => section.section === item.section)
						return (
							<tr key={item.section}>
								<th scope="row">{latest ? sectionTitle(latest) : item.section}</th>
								<td className="str-pre">{item.text}</td>
								<td className="str-pre">{latest?.text ?? "-"}</td>
							</tr>
						)
					})}
				</tbody>
			</table>
			<div className="case-action-buttons">
				<button type="button" onClick={onUseLatest}>
					최신 내용으로 바꾸기
				</button>
				<button type="button" onClick={onKeepMine}>
					내 입력 유지하고 다시 저장
				</button>
			</div>
		</section>
	)
}

function SubmitConfirm({
	draft,
	verification,
	types,
	level,
	command,
	blocked,
	onConfirm,
	onCancel,
}) {
	return (
		<section className="case-action-form" aria-label="승인 요청 확인">
			<h3>승인 요청</h3>
			<p>
				현재 저장본 <strong>{revisionLabel(draft.currentRevisionNo)}</strong>을 승인
				요청해요. 검증 {verification?.verificationId ?? "-"} (
				{revisionLabel(verification?.revisionNo)}) 기준이에요.
			</p>
			<p>
				의심 유형 {types.map(suspicionTypeLabel).join(", ") || "-"} · 지점 의심 정도{" "}
				{level ?? "-"}
			</p>
			<p className="case-action-note">
				승인 대기 중에는 본문을 고칠 수 없어요. 승인자가 보완 요청하면 다시 고칠 수 있어요.
			</p>
			{command.isError && <p role="alert">{getErrorMessage(command.error)}</p>}
			<div className="case-action-buttons">
				<button
					type="button"
					className="primary"
					onClick={onConfirm}
					disabled={blocked || command.isPending}
				>
					{command.isPending ? "요청 중…" : "승인 요청"}
				</button>
				<button type="button" onClick={onCancel} disabled={command.isPending}>
					계속 편집
				</button>
			</div>
		</section>
	)
}
