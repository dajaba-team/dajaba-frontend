import Modal from "./dashboard/Modal"

// 처리 작업 확인창 공통 틀(SCRUM-428) — 케이스 상세의 배정·에스컬레이션·초안 생성·종료와 STR 화면의 다시 생성·종료가 같이 써요.
// 본문과 버튼이 한 <form> 안에 있어서 Enter로도 보내고, 폼 이름(aria-label)으로 찾을 수 있어요(STR 화면 테스트도 폼 안 버튼을 봐요).
// 보내는 중에는 닫히지 않아요. 되돌릴 수 없는 동작(종료)은 파란 주 버튼 대신 빨간 글자·테두리예요.
export default function ActionDialog({
	title,
	submitLabel,
	pendingLabel = "처리 중…",
	pending = false,
	canSubmit = true,
	irreversible = false,
	showSubmit = true,
	cancelLabel = "취소",
	error = null,
	onSubmit,
	onClose,
	children,
}) {
	const close = pending ? () => {} : onClose
	return (
		<Modal title={title} className="action-dialog" onClose={close}>
			<form
				aria-label={title}
				onSubmit={(event) => {
					event.preventDefault()
					if (pending || !canSubmit) return
					onSubmit()
				}}
			>
				{children}
				{error && <p role="alert">{error}</p>}
				<div className="action-dialog-buttons">
					<button type="button" onClick={close} disabled={pending}>
						{cancelLabel}
					</button>
					{showSubmit && (
						<button
							type="submit"
							className={irreversible ? "is-irreversible" : undefined}
							disabled={pending || !canSubmit}
						>
							{pending ? pendingLabel : submitLabel}
						</button>
					)}
				</div>
			</form>
		</Modal>
	)
}
