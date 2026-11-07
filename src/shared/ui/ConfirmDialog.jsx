import Modal from "./dashboard/Modal"

// 되돌릴 수 없는 버튼(배정·종료 확인 등) 뒤에 붙이는 얇은 확인창.
// 사유 입력이 있는 확인창(종료·반려)은 각 기능에서 Modal을 직접 써요.
export default function ConfirmDialog({
	title,
	body,
	confirmLabel = "확인",
	cancelLabel = "취소",
	onConfirm,
	onCancel,
	confirming = false,
	error = null,
}) {
	return (
		<Modal
			title={title}
			onClose={confirming ? () => {} : onCancel}
			footer={
				<>
					<button type="button" onClick={onCancel} disabled={confirming}>
						{cancelLabel}
					</button>
					<button
						type="button"
						className="primary"
						onClick={onConfirm}
						disabled={confirming}
						autoFocus
					>
						{confirming ? "처리 중…" : confirmLabel}
					</button>
				</>
			}
		>
			<div className="confirm-dialog-body">{body}</div>
			{error && (
				<p role="alert" className="confirm-dialog-error">
					{error}
				</p>
			)}
		</Modal>
	)
}
