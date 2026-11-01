import { useState } from "react"
import "../styles/dashboard-demo.css"
import PageHeading from "../../../shared/ui/dashboard/PageHeading.jsx"
import Icon from "../../../shared/ui/dashboard/Icon.jsx"
import Badge from "../../../shared/ui/dashboard/Badge.jsx"
import Button from "../../../shared/ui/dashboard/Button.jsx"
export default function Evaluation() {
	const [copyState, setCopyState] = useState("")
	const metrics = [
		["탐지", "PR-AUC", "0.873"],
		["탐지", "정밀도", "0.694"],
		["탐지", "재현율", "0.812"],
		["탐지", "오탐률", "0.061"],
		["STR", "근거 정확도", "99.6%"],
		["STR", "불일치 탐지율", "98.2%"],
		["STR", "5W1H 완전성", "97.1%"],
		["STR", "환각률", "1.2%"],
	]
	const command =
		"python -m aml_eval.run --dataset ibm-aml-hi-small --date-start 2022-09-01 --date-end 2022-09-10 --split 60,20,20 --model graph_lgbm_v2.4 --seed 42"
	return (
		<main className="page">
			<PageHeading
				title="평가·재현"
				description="학습·평가 실험과 운영 조사 데이터를 분리해 표시합니다."
			/>
			<div className="callout purple">
				<Icon name="chart" />
				<span>
					<strong>모든 수치는 데모 지표</strong>실제 실험 결과 또는 검증 완료 수치가
					아닙니다.
				</span>
			</div>
			<div className="two-col">
				<section className="panel table-card">
					<div className="section-head">
						<div>
							<h2>탐지·STR 검증 지표</h2>
							<p>데모 평가 결과</p>
						</div>
						<Badge tone="purple">DEMO</Badge>
					</div>
					<table>
						<thead>
							<tr>
								<th>영역</th>
								<th>지표</th>
								<th>값</th>
							</tr>
						</thead>
						<tbody>
							{metrics.map((row) => (
								<tr key={row[1]}>
									<td>{row[0]}</td>
									<td>{row[1]}</td>
									<td className="mono">{row[2]}</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
				<section className="panel">
					<div className="section-head">
						<div>
							<h2>실험 메타데이터</h2>
							<p>운영 케이스와 별도</p>
						</div>
					</div>
					<div className="info-list">
						<div>
							<span>dataset_version</span>
							<strong>ibm-aml-hi-small-demo-v1</strong>
						</div>
						<div>
							<span>기간 / 분할</span>
							<strong>2022-09-01~10 · 60/20/20</strong>
						</div>
						<div>
							<span>model / threshold</span>
							<strong>graph-lgbm-2.4 · 0.65</strong>
						</div>
						<div>
							<span>data_hash / Git</span>
							<strong className="mono">sha256:8f3c…91ad / 3e91c2a</strong>
						</div>
						<div>
							<span>seed / 환경</span>
							<strong>42 · Python 3.11 · CPU</strong>
						</div>
					</div>
				</section>
			</div>
			<section className="panel repro">
				<div className="section-head">
					<div>
						<h2>재현 명령어</h2>
						<p>복사는 실제 모델 실행 기능이 아닙니다.</p>
					</div>
				</div>
				<div>
					<code>{command}</code>
					<Button
						variant="secondary"
						icon="copy"
						onClick={async () => {
							try {
								if (!navigator.clipboard) throw new Error("clipboard unavailable")
								await navigator.clipboard.writeText(command)
								setCopyState("명령어를 복사했습니다.")
							} catch {
								setCopyState(
									"복사하지 못했습니다. 명령어를 직접 선택해 복사해 주세요.",
								)
							}
						}}
					>
						명령어 복사
					</Button>
				</div>
			</section>
			{copyState && <p role="status">{copyState}</p>}
		</main>
	)
}
