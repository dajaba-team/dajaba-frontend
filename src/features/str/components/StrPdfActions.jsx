import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { approvalsApi } from "../../approvals/api/approvalsApi"
import { getErrorMessage } from "../../../shared/api/apiClient"
import { pdfStatusOf, saveFile } from "../model/strPdf"

/**
 * STR 화면의 보고서 PDF 버튼 (QnA BH-FE-01). 서버가 S2 available_actions 로 준 것만 켜요 — 화면이 역할·담당을 따로 판단하지 않아요.
 * - PREVIEW_PDF: 승인됨(APPROVED) — 제출 전 미리보기(S7)를 화면 안에 띄워요. 저장 안 되는 미리보기예요
 * - DOWNLOAD_PDF: 보고됨(REPORTED) — 확정본(S8)을 파일로 받아요. 아직이면 409 REPORT_PDF_NOT_READY 의 pdf_status 로 안내만
 * 서버는 승인자(누구나)와 담당 조사역에게 이 두 동작을 줘요(BE StrDraftActions·StrReportPdfAccess.canRead).
 * [PDF 다시 만들기](P5)는 승인한 승인자의 일이라 승인 완료 화면(/approvals/:draftNo)에 있어요.
 */
export default function StrPdfActions({ draftNo, canPreview, canDownload }) {
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

	if (!canPreview && !canDownload) return null
	return (
		<section className="str-pdf" aria-label="보고서 PDF">
			{canPreview && (
				<button type="button" onClick={() => preview.mutate()} disabled={preview.isPending}>
					{preview.isPending ? "불러오는 중…" : "제출 전 PDF 미리보기"}
				</button>
			)}
			{canDownload && (
				<button
					type="button"
					onClick={() => download.mutate()}
					disabled={download.isPending}
				>
					{download.isPending ? "받는 중…" : "확정본 PDF 받기"}
				</button>
			)}
			{preview.isError && <p role="alert">{getErrorMessage(preview.error)}</p>}
			{pdfStatus === "PENDING" && (
				<p role="status">PDF를 만드는 중이에요. 잠시 후 다시 받아 주세요.</p>
			)}
			{pdfStatus === "FAILED" && (
				<p role="alert">
					PDF를 만들지 못했어요. 승인한 승인자에게 [PDF 다시 만들기]를 요청해 주세요.
				</p>
			)}
			{download.isError && !pdfStatus && (
				<p role="alert">{getErrorMessage(download.error)}</p>
			)}
			{previewUrl && (
				<iframe className="str-pdf-preview" title="제출 전 PDF 미리보기" src={previewUrl} />
			)}
		</section>
	)
}
