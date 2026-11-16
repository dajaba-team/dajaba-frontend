import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { useMutation } from "@tanstack/react-query"
import "../../cases/styles/cases.css"
import "../styles/approvals.css"
import { approvalsApi } from "../api/approvalsApi"
import { useApprovalCommand } from "../hooks/useApprovals"
import { deadlineStatus, deadlineText } from "../model/deadline"
import { useStrDraft } from "../../str/hooks/useStrDraft"
import { useCaseDetail } from "../../cases/hooks/useCases"
import { useSession } from "../../auth/hooks/useSession"
import { STATUS_LABELS, labelOf } from "../../cases/labels"
import ConfirmDialog from "../../../shared/ui/ConfirmDialog"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { getErrorCode, getErrorMessage } from "../../../shared/api/apiClient"
import { formatSystemTime } from "../../../shared/format/time"

// 이력에서 그 동작의 가장 최근 시각 — 상세 history 는 최근 20건(CASES 명세 API-02)이라 승인·제출 행은 그 안에 있어요.
const latestAt = (history, action) =>
	history
		.filter((row) => row.action === action)
		.map((row) => row.createdAt)
		.sort()
		.at(-1) ?? null

// PDF 상태 — 확정본 받기(S8)가 409 REPORT_PDF_NOT_READY 로 알려 줘요(details.pdf_status). 그 밖의 방법은 아직 없어요.
const pdfStatusOf = (error) =>
	getErrorCode(error) === "REPORT_PDF_NOT_READY"
		? (error.response?.data?.error?.details?.pdf_status ?? null)
		: null

function saveFile(blob, name) {
	const url = URL.createObjectURL(blob)
	const link = document.createElement("a")
	link.href = url
	link.download = name
	link.click()
	setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * 승인 완료 화면 (SCRUM-111, FR-APR-06·07) — `/approvals/:draftNo`. 승인(P2) 뒤 여기로 와요.
 * APPROVED: 마감 배지 · "제출 전" PDF 미리보기(S7) · [모의 제출](P4). REPORTED: 확정본 PDF(S8) · 실패면 [PDF 다시 만들기](P5).
 * 〔SCRUM-240 전〕 P4·S7·S8·P5 는 BE 가 아직 없어 MSW 가 답해요.
 * 〔확인 필요〕 버튼은 원래 서버 available_actions 만 보고 켜는데(01_code_rules §1), 승인 뒤 동작은 서버가 아직 주지 않아요.
 *   그래서 지금은 역할(APPROVER)·케이스 상태로 켜고, 서버가 다시 검사해요. SCRUM-240 에서 액션 목록이 생기면 그걸로 바꿔요.
 * 이 경로(/approvals/*)는 승인자·관리자만 열어요. 관리자는 PDF 권한이 없어(BE 04_auth_user 12-1·12-1a) 상태만 봐요.
 * 담당 조사역의 PDF 미리보기·확정본은 STR 화면 몫이에요.
 */
export default function ApprovalDonePage() {
	const { draftNo } = useParams()
	const draft = useStrDraft(draftNo)
	const caseNo = draft.data?.caseNo ?? null
	const detail = useCaseDetail(caseNo)
	const session = useSession()
	const isApprover = session.data?.role === "APPROVER"
	const status = draft.data?.caseStatus ?? null

	const target = { draftNo, caseNo, caseVersion: draft.data?.caseVersion }
	const report = useApprovalCommand(target, "report")
	const regenerate = useApprovalCommand(target, "regeneratePdf")
	const [confirming, setConfirming] = useState(false)

	const [previewUrl, setPreviewUrl] = useState(null)
	useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])
	const preview = useMutation({
		mutationFn: () => approvalsApi.previewPdf({ draftNo }),
		onSuccess: (blob) => setPreviewUrl(URL.createObjectURL(blob)),
	})
	const download = useMutation({
		mutationFn: () => approvalsApi.reportPdf({ draftNo }),
		onSuccess: (blob) => saveFile(blob, `${draftNo}.pdf`),
	})
	const pdfStatus = download.isError ? pdfStatusOf(download.error) : null

	const history = detail.data?.history ?? []
	const approvedAt = latestAt(history, "APPROVE")
	const reportedAt = latestAt(history, "REPORT")

	return (
		<>
			<header className="case-page-heading">
				<p>
					<Link to="/approvals">← 승인함</Link>
				</p>
				<h1>승인 완료</h1>
				<p>승인된 STR 보고서를 확인하고 모의 제출하세요. 실제 기관으로 보내지는 않아요.</p>
			</header>
			<AsyncState query={draft} />
			{draft.data && !["APPROVED", "REPORTED"].includes(status) && (
				<section className="case-panel">
					<p>
						이 초안은 승인 완료 상태가 아니에요(지금 {labelOf(STATUS_LABELS, status)}).
					</p>
				</section>
			)}
			{draft.data && ["APPROVED", "REPORTED"].includes(status) && (
				<section className="case-panel approval-done" aria-label="승인 완료 보고서">
					<dl className="approval-summary">
						<div>
							<dt>초안</dt>
							<dd>{draftNo}</dd>
						</div>
						<div>
							<dt>케이스</dt>
							<dd>
								<Link to={`/cases/${encodeURIComponent(caseNo)}/str`}>
									{caseNo} 초안 보기
								</Link>
							</dd>
						</div>
						<div>
							<dt>상태</dt>
							<dd>{labelOf(STATUS_LABELS, status)}</dd>
						</div>
						<div>
							<dt>의심 정도</dt>
							<dd>
								지점 {draft.data.suspicionLevelBranch ?? "-"} · 본점{" "}
								{draft.data.suspicionLevelHq ?? "-"}
							</dd>
						</div>
						<div>
							<dt>승인</dt>
							<dd>{approvedAt ? formatSystemTime(approvedAt) : "-"}</dd>
						</div>
						{status === "REPORTED" && (
							<div>
								<dt>모의 제출</dt>
								<dd>{reportedAt ? formatSystemTime(reportedAt) : "-"}</dd>
							</div>
						)}
					</dl>

					{status === "APPROVED" && (
						<>
							{approvedAt && (
								<p className="approval-badge" role="status">
									{deadlineText(deadlineStatus(approvedAt))}
								</p>
							)}
							{isApprover ? (
								<div className="approval-actions">
									<button
										type="button"
										onClick={() => preview.mutate()}
										disabled={preview.isPending}
									>
										{preview.isPending
											? "불러오는 중…"
											: "제출 전 PDF 미리보기"}
									</button>
									<button
										type="button"
										className="primary"
										onClick={() => setConfirming(true)}
									>
										모의 제출
									</button>
								</div>
							) : (
								<p className="approval-muted">
									모의 제출과 PDF 미리보기는 승인자가 해요.
								</p>
							)}
							{preview.isError && (
								<p role="alert">{getErrorMessage(preview.error)}</p>
							)}
							{previewUrl && (
								<iframe
									className="approval-preview"
									title="제출 전 PDF 미리보기"
									src={previewUrl}
								/>
							)}
						</>
					)}

					{status === "REPORTED" && (
						<>
							<p role="status">모의 제출을 마쳤어요. 실제 기관 전송은 없어요.</p>
							<div className="approval-actions">
								{isApprover && (
									<button
										type="button"
										onClick={() => download.mutate()}
										disabled={download.isPending}
									>
										{download.isPending ? "받는 중…" : "확정본 PDF 받기"}
									</button>
								)}
								{isApprover && pdfStatus === "FAILED" && (
									<button
										type="button"
										onClick={() =>
											regenerate.mutate(undefined, {
												onSuccess: () => download.reset(),
											})
										}
										disabled={regenerate.isPending}
									>
										PDF 다시 만들기
									</button>
								)}
							</div>
							{pdfStatus === "PENDING" && (
								<p role="status">
									PDF를 만드는 중이에요. 잠시 후 다시 받아 주세요.
								</p>
							)}
							{pdfStatus === "FAILED" && (
								<p role="alert">
									PDF를 만들지 못했어요. [PDF 다시 만들기]를 눌러 주세요.
								</p>
							)}
							{download.isError && !pdfStatus && (
								<p role="alert">{getErrorMessage(download.error)}</p>
							)}
							{regenerate.isSuccess && !download.isError && (
								<p role="status">PDF를 다시 만들고 있어요. 잠시 후 받아 주세요.</p>
							)}
							{regenerate.isError && (
								<p role="alert">{getErrorMessage(regenerate.error)}</p>
							)}
						</>
					)}
				</section>
			)}
			{confirming && (
				<ConfirmDialog
					title="모의 제출"
					confirmLabel="모의 제출"
					confirming={report.isPending}
					error={report.isError ? getErrorMessage(report.error) : null}
					onConfirm={() =>
						report.mutate(undefined, { onSuccess: () => setConfirming(false) })
					}
					onCancel={() => setConfirming(false)}
					body={
						<p>
							{draftNo} 보고서를 모의 제출할까요? 제출하면 보고됨(REPORTED)으로 끝나고
							되돌릴 수 없어요. 실제 기관 전송은 없어요.
						</p>
					}
				/>
			)}
		</>
	)
}
