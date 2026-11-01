import { useState } from "react"
import PageHeading from "../../../shared/ui/dashboard/PageHeading.jsx"
import Icon from "../../../shared/ui/dashboard/Icon.jsx"
import Badge from "../../../shared/ui/dashboard/Badge.jsx"
import Button from "../../../shared/ui/dashboard/Button.jsx"
import Modal from "../../../shared/ui/dashboard/Modal.jsx"
import { useDashboardDemo } from "../../../shared/demo/useDashboardDemo.js"
export default function Rules() {
	const { db, updateRule: save } = useDashboardDemo()
	const [editing, setEditing] = useState(null)
	const [threshold, setThreshold] = useState("")
	const [reason, setReason] = useState("")
	const open = (rule) => {
		setEditing(rule)
		setThreshold(rule.threshold)
		setReason("")
	}
	return (
		<main className="page">
			<PageHeading
				eyebrow="ADMIN"
				title="탐지 룰"
				description="8개 룰은 mockRules 데모 데이터이며 실제 룰 ID·기준값 계약 확정이 필요합니다."
			/>
			<div className="callout warning">
				<Icon name="warning" />
				<span>
					<strong>데모 룰 정의</strong> 기존 경보는 당시 룰 버전을 유지하며 새 기준은 이후
					스캔에 적용됩니다.
				</span>
			</div>
			<section className="panel table-card">
				<div className="table-scroll">
					<table>
						<thead>
							<tr>
								<th>룰 ID</th>
								<th>한국어 이름</th>
								<th>유형 힌트</th>
								<th>버전</th>
								<th>활성</th>
								<th>기준값</th>
								<th>수정자 / 시각</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{db.rules.map((rule) => (
								<tr key={rule.rule_id}>
									<td className="mono">{rule.rule_id}</td>
									<td>
										{rule.name_ko}
										<small>mockRules · 데모</small>
									</td>
									<td>{rule.typology_hint}</td>
									<td>v{rule.version}</td>
									<td>
										<Badge tone="green">
											{rule.enabled ? "활성" : "비활성"}
										</Badge>
									</td>
									<td>{rule.threshold}</td>
									<td>
										{rule.updated_by}
										<small>{rule.updated_at}</small>
									</td>
									<td>
										<Button variant="secondary" onClick={() => open(rule)}>
											기준 변경
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
			{editing && (
				<Modal
					title={`룰 기준값 변경 · ${editing.rule_id}`}
					onClose={() => setEditing(null)}
					footer={
						<>
							<Button variant="secondary" onClick={() => setEditing(null)}>
								취소
							</Button>
							<Button
								onClick={() => {
									save(editing, threshold, reason)
									setEditing(null)
								}}
								disabled={!threshold.trim() || !reason.trim()}
							>
								저장
							</Button>
						</>
					}
				>
					<div className="compare">
						<div>
							<span>기존값</span>
							<strong>{editing.threshold}</strong>
						</div>
						<div>
							<span>변경값</span>
							<input
								aria-label="변경 기준값"
								value={threshold}
								onChange={(e) => setThreshold(e.target.value)}
								autoFocus
							/>
						</div>
					</div>
					<label className="field">
						변경 사유
						<textarea
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							placeholder="감사 가능한 변경 사유를 입력하세요."
						/>
					</label>
					<p className="helper">
						현재 version {editing.version}을 전송합니다. 409 CONCURRENT_UPDATE 시 입력을
						보존하고 최신 버전과 비교해야 합니다.
					</p>
				</Modal>
			)}
		</main>
	)
}
