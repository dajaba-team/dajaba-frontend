import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { casesApi } from "../api/casesApi"
import { getErrorCode, getErrorMessage, isVersionConflict } from "../../../shared/api/apiClient"

export default function CaseMemoEditor({ detail, onRefresh }) {
	const client = useQueryClient()
	// 미저장 내용과 작성 기준 버전을 보존하여 재조회가 사용자의 입력을 덮어쓰지 않게 합니다.
	const [draft, setDraft] = useState({
		memo: detail.memo || "",
		version: detail.case_version,
	})
	const [confirmedVersion, setConfirmedVersion] = useState(null)
	const mutation = useMutation({
		mutationFn: casesApi.saveMemo,
		// 로그아웃 이후 완료된 저장 응답으로 업무 캐시를 다시 채우지 않습니다.
		onMutate: () => ({ session: client.getQueryData(["auth", "me"]) }),
		onSuccess: async (saved, _variables, context) => {
			if (context.session !== client.getQueryData(["auth", "me"])) return
			setDraft({ memo: saved.memo, version: saved.case_version })
			setConfirmedVersion(null)
			client.setQueryData(["case", detail.id], saved)
			await client.invalidateQueries({ queryKey: ["cases"] })
		},
		onError: (error) => {
			if (isVersionConflict(error)) void onRefresh()
		},
	})
	const changed = detail.case_version !== draft.version
	const confirmed = confirmedVersion === detail.case_version
	const fieldError =
		getErrorCode(mutation.error || {}) === "INVALID_REQUEST"
			? mutation.error.response.data.error.details?.memo
			: null
	const dirty = draft.memo !== (detail.memo || "")
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
	return (
		<section aria-labelledby="memo-title">
			<h2 id="memo-title">조사 메모</h2>
			<form
				onSubmit={(event) => {
					event.preventDefault()
					if (mutation.isPending || (changed && !confirmed)) return
					mutation.mutate({
						id: detail.id,
						memo: draft.memo,
						case_version: confirmed ? detail.case_version : draft.version,
					})
				}}
			>
				<label htmlFor="memo">메모 내용</label>
				<textarea
					id="memo"
					aria-invalid={typeof fieldError === "string" || undefined}
					aria-describedby={typeof fieldError === "string" ? "memo-error" : undefined}
					value={draft.memo}
					disabled={mutation.isPending}
					onChange={(event) => {
						setDraft({ ...draft, memo: event.target.value })
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
					<aside>
						<h3>서버의 최신 메모 (버전 {detail.case_version})</h3>
						<p className="preserve-lines">{detail.memo || "메모 없음"}</p>
						<label>
							<input
								type="checkbox"
								checked={confirmed}
								onChange={(event) =>
									setConfirmedVersion(
										event.target.checked ? detail.case_version : null,
									)
								}
							/>{" "}
							최신 내용과 내 메모를 비교했습니다.
						</label>
					</aside>
				)}
				<button type="submit" disabled={mutation.isPending || (changed && !confirmed)}>
					{mutation.isPending ? "저장 중…" : "메모 저장"}
				</button>
				{mutation.isSuccess && <p role="status">메모가 저장되었습니다.</p>}
			</form>
		</section>
	)
}
