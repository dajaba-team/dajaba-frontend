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
import { STATUS_LABELS, REJECTION_LABELS } from "../../cases/labels"
import { CloseForm } from "../../cases/components/CaseActions"
import StrNarrative from "../components/StrNarrative"
import StrFacts from "../components/StrFacts"
import StrSuspicionPanel from "../components/StrSuspicionPanel"
import StrRevisionHistory from "../components/StrRevisionHistory"
import StrGenerateForm from "../components/StrGenerateForm"
import {
	changedSections,
	sectionError,
	stateNotice,
	strActionsFor,
	submitBlockReason,
	verificationState,
} from "../model/strRules"
import { DRAFT_STATUS_LABELS, labelOf } from "../labels"
import "../../cases/styles/cases.css"
import "../styles/str.css"

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
	return (
		<>
			<Link to={`/cases/${encodeURIComponent(caseNo)}`}>← 케이스 상세</Link>
			<div className="str-page-heading">
				<h1>STR 초안</h1>
				{draft && (
					<p>
						{draft.draftNo} · 초안 {draft.status}
						{(detail?.status ?? draft.caseStatus) &&
							` · 케이스 ${detail?.status ?? draft.caseStatus}`}
						{draft.producedAt && ` · 생성 ${formatSystemTime(draft.producedAt)}`}
					</p>
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
	const actions = strActionsFor(draft, detail)
	const can = (action) => actions.includes(action)
	const editable = can("REVISE")

	// 편집 중 값 {section: text}. 저장본과 같아지면 미저장 아님.
	const [inputs, setInputs] = useState({})
	const changes = changedSections(draft.narrative, inputs)
	const dirty = changes.length > 0
	const invalid = changes.some((item) => sectionError(item.text))

	// VI부 — 서버 값으로 시작, 승인 요청 때 보냄(따로 저장 API 없음).
	const [types, setTypes] = useState(draft.suspicionTypes)
	const [level, setLevel] = useState(draft.suspicionLevelBranch)

	const [panel, setPanel] = useState(null) // "history" | "regenerate" | "close" | "submit"
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
	const blockReason = submitBlockReason({
		actions,
		caseStatus: detail.status,
		dirty,
		verification,
		types,
		level,
	})
	const notice = stateNotice(draft, detail)
	const rejection = draft.lastRejection
	const rejectionCode = rejection?.reasonCode ?? detail.rejectionReasonCode

	const doSave = () => {
		if (!dirty || invalid || save.isPending) return
		save.mutate({ caseVersion, sections: changes }, { onSuccess: () => setInputs({}) })
	}

	return (
		<>
			<p className="str-subheading">
				{detail.caseNo} · {revisionLabel(draft.currentRevisionNo)} ·{" "}
				{labelOf(DRAFT_STATUS_LABELS, draft.status)} ·{" "}
				{labelOf(STATUS_LABELS, detail.status)}
				{draft.generatorVersion && ` · ${draft.generatorVersion}`}
				{" · "}
				<span role="status">{dirty ? "미저장 변경이 있어요" : "저장본과 같아요"}</span>
			</p>

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
						</p>
					)}
					{notice && <p>{notice}</p>}
				</section>
			)}

			<div className="str-toolbar">
				<button
					type="button"
					aria-pressed={panel === "history"}
					onClick={() => setPanel(panel === "history" ? null : "history")}
				>
					수정 이력
				</button>
			</div>
			{panel === "history" && (
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
						onVerify={() => !dirty && !verify.isPending && verify.mutate({})}
					/>
					<StrSuspicionPanel
						editable={editable}
						types={types}
						level={level}
						recommended={draft.suspicionTypesRecommended}
						onTypesChange={setTypes}
						onLevelChange={setLevel}
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
			{save.isSuccess && !dirty && (
				<p role="status">
					{/* needs_verification=false(검증 대상 그대로)일 때만 짧게. 없으면 다시 검증 안내 */}
					{save.data.needsVerification === false
						? `${revisionLabel(save.data.revisionNo)}으로 저장했어요.`
						: `${revisionLabel(save.data.revisionNo)}으로 저장했어요. 저장본을 다시 검증해 주세요.`}
				</p>
			)}

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
							{ onSuccess: () => setPanel(null) },
						)
					}
					onCancel={() => {
						submit.reset()
						setPanel(null)
					}}
				/>
			)}
			{submit.isSuccess && <p role="status">승인 요청을 보냈어요. 승인자 결정을 기다려요.</p>}
			{panel === "regenerate" && (
				<StrGenerateForm
					detail={detail}
					regenerate
					blockedReason={dirty ? "변경한 내용을 먼저 저장하거나 되돌려 주세요." : null}
					onDone={() => setPanel(null)}
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
