import { useEffect, useState } from "react"
import { useCaseCommand } from "../hooks/useCases"
import { getErrorCode, getErrorMessage } from "../../../shared/api/apiClient"
import Button from "../../../shared/ui/Button"
import Icon from "../../../shared/ui/dashboard/Icon"
import ConfirmDialog from "../../../shared/ui/ConfirmDialog"
import { useUnsavedLinkGuard } from "../../../shared/ui/useUnsavedLinkGuard"

// 메모 저장 — 계약서 A3 `PUT /cases/{case_no}/notes { investigator_notes, version }` → 공통 변경 응답 M.
// 성공하면 useCaseCommand가 상세를 다시 불러요. 충돌(409 CONCURRENT_UPDATE)이어도 쓰던 메모는 그대로 둬요.
export default function CaseMemoEditor({ detail, onRefresh }) {
	// 쓰기 시작하면 그때의 내용·기준 버전을 붙잡아 재조회가 입력을 덮어쓰지 않게 합니다.
	// 쓰기 전(draft = null)에는 서버 값을 그대로 따라가요 — 배정·에스컬레이션으로 버전이 올라도 충돌이 아니에요.
	const [draft, setDraft] = useState(null)
	const editing = draft !== null
	const memo = editing ? draft.memo : detail.investigatorNotes || ""
	const [confirmedVersion, setConfirmedVersion] = useState(null)
	const mutation = useCaseCommand(detail.caseNo, "saveNotes")
	const changed = editing && detail.version !== draft.version
	const confirmed = confirmedVersion === detail.version
	// 400 details는 요청 JSON 이름(investigator_notes)으로 와요(BE SCRUM-167).
	const details =
		getErrorCode(mutation.error || {}) === "INVALID_REQUEST"
			? mutation.error.response.data.error.details
			: null
	const fieldError = details?.investigator_notes ?? null
	const dirty = editing && draft.memo !== (detail.investigatorNotes || "")
	useEffect(() => {
		if (!dirty) return
		const warnBeforeLeaving = (event) => {
			event.preventDefault()
			event.returnValue = ""
		}
		// 새로고침·탭 닫기로 미저장 메모가 사라지기 전에 브라우저 확인을 요청합니다.
		window.addEventListener("beforeunload", warnBeforeLeaving)
		return () => window.removeEventListener("beforeunload", warnBeforeLeaving)
	}, [dirty])
	// 앱 안 다른 화면으로 가는 링크를 누르면 이동 전에 확인해요.
	const guard = useUnsavedLinkGuard(dirty)
	return (
		<section aria-labelledby="memo-title">
			{guard.pending && (
				<ConfirmDialog
					title="저장하지 않은 메모가 있습니다"
					body="지금 이동하면 쓰던 메모가 사라집니다."
					confirmLabel="저장하지 않고 이동"
					cancelLabel="계속 작성"
					initialFocus="cancel"
					onConfirm={guard.leave}
					onCancel={guard.stay}
				/>
			)}
			<h2 id="memo-title">조사 메모</h2>
			<form
				onSubmit={(event) => {
					event.preventDefault()
					if (mutation.isPending || (changed && !confirmed)) return
					mutation.mutate(
						{
							investigatorNotes: memo,
							version: !editing || confirmed ? detail.version : draft.version,
						},
						{
							onSuccess: () => {
								setDraft(null)
								setConfirmedVersion(null)
							},
						},
					)
				}}
			>
				{/* 탭 이름이 "조사 메모"라 칸 이름은 화면 읽기 프로그램에만 */}
				<label htmlFor="memo" className="visually-hidden">
					메모 내용
				</label>
				<textarea
					id="memo"
					className="memo-input"
					placeholder="확인한 내용, 더 볼 거래, 판단 근거를 적어 두세요."
					aria-invalid={typeof fieldError === "string" || undefined}
					aria-describedby={typeof fieldError === "string" ? "memo-error" : undefined}
					value={memo}
					disabled={mutation.isPending}
					onChange={(event) => {
						setDraft({
							memo: event.target.value,
							version: editing ? draft.version : detail.version,
						})
						mutation.reset()
					}}
				/>
				{typeof fieldError === "string" && <p id="memo-error">{fieldError}</p>}
				{mutation.isError && <p role="alert">{getErrorMessage(mutation.error)}</p>}
				{mutation.isError && (
					<button type="button" onClick={onRefresh}>
						최신 내용 확인
					</button>
				)}
				{changed && (
					<aside className="memo-conflict">
						<h3>쓰는 동안 케이스가 바뀌었어요 — 서버의 최신 메모</h3>
						<p className="preserve-lines">{detail.investigatorNotes || "메모 없음"}</p>
						<label>
							<input
								type="checkbox"
								checked={confirmed}
								onChange={(event) =>
									setConfirmedVersion(
										event.target.checked ? detail.version : null,
									)
								}
							/>{" "}
							최신 내용과 내 메모를 비교했습니다.
						</label>
					</aside>
				)}
				{/* 저장 줄 — 왼쪽은 상태 한 줄(저장됨·저장 안 함), 오른쪽은 저장 버튼.
				    채움 파랑은 판단 요약의 [다음 처리] 하나라 메모 저장은 보조 모양(SCRUM-369). */}
				<div className="memo-actions">
					{mutation.isSuccess && !dirty ? (
						<p role="status" className="memo-state is-saved">
							<Icon name="check" size={14} />
							메모가 저장되었습니다.
						</p>
					) : dirty ? (
						<p className="memo-state">저장하지 않은 변경이 있어요.</p>
					) : (
						<span />
					)}
					<Button
						type="submit"
						variant="secondary"
						disabled={mutation.isPending || (changed && !confirmed)}
					>
						{mutation.isPending ? "저장 중…" : "메모 저장"}
					</Button>
				</div>
			</form>
		</section>
	)
}
