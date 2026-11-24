import { useId } from "react"
import { Link } from "react-router"
import { useStrCommand } from "../hooks/useStrDraft"
import { getErrorCode, getErrorMessage, isNoResponse } from "../../../shared/api/apiClient"

// STR 초안 생성·재생성 확인 (계약서 S1, 화면 설계 CASE-03 초안 생성·STR-03 ③).
// - 최대 90초. 기다리는 동안 같은 버튼을 다시 누를 수 없고, 가짜 진행률을 보여 주지 않아요.
// - 생성 직후 자동 검증 없음(안건 17). 성공하면 케이스를 다시 읽어 새 current_draft_no로 바뀌어요.
// - 409 DRAFT_IN_PROGRESS는 장애가 아니라 "만드는 중". 응답이 없으면 먼저 최신 상태를 읽어요(훅이 처리).
export default function StrGenerateForm({ detail, regenerate = false, blockedReason, onDone }) {
	const titleId = useId()
	const command = useStrCommand(detail.caseNo, detail.currentDraftNo, "createDraft")
	const code = command.isError ? getErrorCode(command.error) : null
	return (
		<form
			className="case-action-form"
			aria-labelledby={titleId}
			onSubmit={(event) => {
				event.preventDefault()
				if (command.isPending || blockedReason) return
				command.mutate({ caseVersion: detail.version })
			}}
		>
			<h3 id={titleId}>{regenerate ? "STR 초안 다시 생성" : "STR 초안 생성"}</h3>
			{regenerate ? (
				<p>
					현재 초안({detail.currentDraftNo})은 새 초안으로 대체되고, 기존 본문과 수정
					이력은 과거 초안으로 보관됩니다.
				</p>
			) : (
				<p>현재 경보와 근거 거래로 STR 초안을 생성합니다.</p>
			)}
			<p className="case-action-note">
				최대 90초 소요됩니다. 생성 후 본문을 확인하고 검증을 진행하세요.
			</p>
			{blockedReason && <p role="note">{blockedReason}</p>}
			{command.isPending && (
				<p role="status">초안을 생성하는 중입니다. 화면을 닫아도 생성은 계속됩니다.</p>
			)}
			{command.isSuccess && (
				<p role="status">
					초안 {command.data.draftNo}을 저장했습니다.{" "}
					{!regenerate && (
						<Link to={`/cases/${encodeURIComponent(detail.caseNo)}/str`}>
							STR 화면에서 확인하기 →
						</Link>
					)}
				</p>
			)}
			{command.isError && (
				<p role="alert">
					{getErrorMessage(command.error)}
					{(code === "DRAFT_IN_PROGRESS" || isNoResponse(command.error)) &&
						" 최신 상태를 다시 불러왔습니다."}
				</p>
			)}
			<div className="case-action-buttons">
				{!command.isSuccess && (
					<button type="submit" disabled={command.isPending || Boolean(blockedReason)}>
						{command.isPending ? "만드는 중…" : regenerate ? "다시 생성" : "초안 생성"}
					</button>
				)}
				<button type="button" onClick={onDone} disabled={command.isPending}>
					{command.isSuccess ? "닫기" : "취소"}
				</button>
			</div>
		</form>
	)
}
