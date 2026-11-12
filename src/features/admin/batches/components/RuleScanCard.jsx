import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import ConfirmDialog from "../../../../shared/ui/ConfirmDialog"
import { getErrorMessage } from "../../../../shared/api/apiClient"
import { batchesApi } from "../api/batchesApi"
import { formatCount } from "../formatCount"
import BatchStep from "./BatchStep"

// [룰 스캔] 카드 — 계약서 B2, 백엔드 RuleScanController(SCRUM-99). 선택한 날짜의 켜진 룰을 한 번에(동기, 200).
// 성공한 날짜는 다시 스캔할 수 없어서(409 BATCH_ALREADY_DONE) 실행 전 확인창. 시작 전 거절은 확인창 안에 보여 줘요.
// 페이지가 날짜마다 key 를 바꿔 새로 그려요 — 다른 날짜 결과가 남지 않게.
const DATE = /^\d{4}-\d{2}-\d{2}$/

export default function RuleScanCard({ date, onResult, primary = false }) {
	const [confirming, setConfirming] = useState(false)
	const scan = useMutation({
		mutationFn: () => batchesApi.ruleScan({ date }),
		onSuccess: (result) => {
			setConfirming(false)
			onResult?.({
				status: result.status,
				summary: `${result.batchDate} 경보 ${formatCount(result.rowsOut)}건`,
			})
		},
	})
	const result = scan.data
	return (
		<BatchStep
			id="rule-scan-title"
			no={2}
			title="룰 스캔"
			scope="선택한 날짜의 켜진 룰 전부 · 경보 생성"
			state={scan.isSuccess ? "done" : scan.isPending ? "running" : "idle"}
		>
			<button
				type="button"
				className="batch-run"
				data-primary={primary}
				disabled={!DATE.test(date) || scan.isPending || scan.isSuccess}
				onClick={() => setConfirming(true)}
			>
				{scan.isSuccess ? "완료됨" : "실행"}
			</button>
			{!DATE.test(date) && <p>위에서 분석 날짜를 먼저 골라 주세요.</p>}
			{scan.isError && !confirming && <p role="alert">{getErrorMessage(scan.error)}</p>}
			{result && (
				<div role="status">
					<p>
						{result.batchDate} 경보 {formatCount(result.rowsOut)}건을 만들었어요. (그날
						거래 {formatCount(result.rowsIn)}건)
					</p>
					{!result.rowsOut && <p>조건에 맞는 경보가 없어요. 정상 결과일 수 있어요.</p>}
					<ul>
						{result.alertsByRule.map((rule) => (
							<li key={rule.ruleId}>
								{rule.ruleId} (버전 {rule.ruleVersion}) —{" "}
								{formatCount(rule.alertCount)}건
							</li>
						))}
					</ul>
				</div>
			)}
			{confirming && (
				<ConfirmDialog
					title="룰 스캔"
					body={`${date} 룰 스캔을 실행할까요? 성공한 날짜는 다시 스캔할 수 없습니다.`}
					confirmLabel="실행"
					confirming={scan.isPending}
					error={scan.isError ? getErrorMessage(scan.error) : null}
					onConfirm={() => scan.mutate()}
					onCancel={() => {
						setConfirming(false)
						scan.reset()
					}}
				/>
			)}
		</BatchStep>
	)
}
