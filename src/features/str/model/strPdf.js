import { getErrorCode } from "../../../shared/api/apiClient"

// 보고서 PDF(S7 미리보기·S8 확정본) 공통 — STR 화면과 승인 완료 화면이 같이 써요.

/** 확정본이 아직 없을 때 S8 이 주는 409 REPORT_PDF_NOT_READY 의 details.pdf_status(PENDING·FAILED). 그 밖의 오류면 null. */
export const pdfStatusOf = (error) =>
	getErrorCode(error) === "REPORT_PDF_NOT_READY"
		? (error.response?.data?.error?.details?.pdf_status ?? null)
		: null

/** blob 을 파일로 저장 — 링크를 만들어 눌러요. URL 은 1분 뒤 풀어요(바로 풀면 일부 브라우저가 못 받아요). */
export function saveFile(blob, name) {
	const url = URL.createObjectURL(blob)
	const link = document.createElement("a")
	link.href = url
	link.download = name
	link.click()
	setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
