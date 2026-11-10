import { useId, useState } from "react"
import { useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import "../../cases/styles/cases.css"
import { AsyncState } from "../../../shared/ui/AsyncState"
import { formatSystemTime } from "../../../shared/format/time"
import { auditApi } from "../api/auditApi"
import { ACCESS_ACTIONS, ACCESS_TARGET_TYPES, AI_ENDPOINTS, AI_TARGET_TYPES } from "../auditLabels"

// 감사 기록 (ADM-05, SCRUM-170) — 관리자만(라우트 RequireRole + 서버 403). 메타만 보여 줘요.
// 탭·필터·페이지는 주소(query)에 남겨 새로고침·링크 공유에도 그대로예요. 빈 결과와 조회 실패를 다르게(COM-02).
// 기간은 한국 날짜로 고르고 서버에는 UTC Z 로 보내요(from 포함, to 는 다음 날 0시 제외 — 계약서 5.9).
const DATE = /^\d{4}-\d{2}-\d{2}$/
const startOfDayZ = (date) => new Date(`${date}T00:00:00`).toISOString().replace(".000Z", "Z")
const nextDayZ = (date) => {
	const d = new Date(`${date}T00:00:00`)
	d.setDate(d.getDate() + 1)
	return d.toISOString().replace(".000Z", "Z")
}

const TABS = {
	ai: {
		label: "AI 호출 기록",
		fields: [
			{ key: "endpoint", label: "엔드포인트", options: AI_ENDPOINTS },
			{ key: "outcome", label: "결과", options: { SUCCESS: "성공", FAILURE: "실패" } },
			{ key: "target_type", label: "대상 종류", options: AI_TARGET_TYPES },
			{ key: "target_id", label: "대상 번호", needs: "target_type" },
			{ key: "request_id", label: "요청 ID" },
			{ key: "error_code", label: "실패 코드" },
		],
		query: auditApi.aiCalls,
	},
	access: {
		label: "접근 기록",
		fields: [
			{ key: "login_id", label: "사용자 아이디" },
			{ key: "action", label: "동작", options: ACCESS_ACTIONS },
			{ key: "target_type", label: "대상 종류", options: ACCESS_TARGET_TYPES },
		],
		query: auditApi.accessLogs,
	},
}
const KEYS = (tab) => [...TABS[tab].fields.map((f) => f.key), "from", "to"]

function readState(params) {
	const tab = params.get("tab") === "access" ? "access" : "ai"
	const filters = Object.fromEntries(KEYS(tab).map((key) => [key, params.get(key) ?? ""]))
	if (!DATE.test(filters.from)) filters.from = ""
	if (!DATE.test(filters.to)) filters.to = ""
	const rawPage = Number(params.get("page") || 1)
	return { tab, filters, page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1 }
}

function FilterForm({ tab, applied, onApply, onReset }) {
	const [draft, setDraft] = useState(applied)
	const formId = useId()
	const periodInvalid = Boolean(draft.from && draft.to && draft.from > draft.to)
	const set = (key) => (event) => setDraft({ ...draft, [key]: event.target.value })
	return (
		<form
			className="case-filter"
			aria-label={`${TABS[tab].label} 필터`}
			onSubmit={(event) => {
				event.preventDefault()
				if (!periodInvalid) onApply(draft)
			}}
		>
			{TABS[tab].fields.map((field) => {
				const id = `${formId}-${field.key}`
				const disabled = field.needs && !draft[field.needs]
				return (
					<span key={field.key}>
						<label htmlFor={id}>{field.label}</label>{" "}
						{field.options ? (
							<select id={id} value={draft[field.key]} onChange={set(field.key)}>
								<option value="">전체</option>
								{Object.entries(field.options).map(([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								))}
							</select>
						) : (
							<input
								id={id}
								value={draft[field.key]}
								disabled={disabled}
								placeholder={disabled ? "대상 종류를 먼저 골라요" : undefined}
								onChange={set(field.key)}
							/>
						)}
					</span>
				)
			})}
			<span>
				<label htmlFor={`${formId}-from`}>시작일</label>{" "}
				<input
					id={`${formId}-from`}
					type="date"
					value={draft.from}
					onChange={set("from")}
				/>
			</span>
			<span>
				<label htmlFor={`${formId}-to`}>종료일</label>{" "}
				<input
					id={`${formId}-to`}
					type="date"
					value={draft.to}
					aria-invalid={periodInvalid || undefined}
					onChange={set("to")}
				/>
			</span>
			<button type="submit" disabled={periodInvalid}>
				조회
			</button>
			<button type="button" onClick={onReset}>
				필터 초기화
			</button>
			{periodInvalid && <p role="alert">시작일은 종료일보다 늦을 수 없어요.</p>}
		</form>
	)
}

function AiCallRows({ items }) {
	return (
		<table className="case-table">
			<thead>
				<tr>
					<th scope="col">시각</th>
					<th scope="col">엔드포인트</th>
					<th scope="col">대상</th>
					<th scope="col">결과</th>
					<th scope="col">HTTP</th>
					<th scope="col">시도</th>
					<th scope="col">걸린 시간</th>
					<th scope="col">AI 버전</th>
					<th scope="col">요청 ID</th>
				</tr>
			</thead>
			<tbody>
				{items.map((row) => (
					<tr key={row.id}>
						<td>{formatSystemTime(row.createdAt)}</td>
						<td>
							{AI_ENDPOINTS[row.endpoint] ?? row.endpoint}{" "}
							<small>{row.endpoint}</small>
						</td>
						<td>
							{row.targetType
								? `${AI_TARGET_TYPES[row.targetType] ?? row.targetType} ${row.targetId ?? ""}`
								: "—"}
						</td>
						<td>{row.errorCode ? `실패 · ${row.errorCode}` : "성공"}</td>
						<td>{row.statusCode ?? "응답 없음"}</td>
						<td>{row.attempt}</td>
						<td>{row.durationMs.toLocaleString()}ms</td>
						<td>{row.aiVersion ?? "—"}</td>
						<td>
							<code>{row.requestId}</code>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	)
}

function AccessLogRows({ items }) {
	return (
		<table className="case-table">
			<thead>
				<tr>
					<th scope="col">시각</th>
					<th scope="col">사용자</th>
					<th scope="col">동작</th>
					<th scope="col">대상</th>
				</tr>
			</thead>
			<tbody>
				{items.map((row) => (
					<tr key={row.id}>
						<td>{formatSystemTime(row.createdAt)}</td>
						<td>{row.loginId ?? "—"}</td>
						<td>{ACCESS_ACTIONS[row.action] ?? row.action}</td>
						<td>
							{row.targetType
								? `${ACCESS_TARGET_TYPES[row.targetType] ?? row.targetType} ${row.targetId ?? ""}`
								: "—"}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	)
}

export default function AdminAuditPage() {
	const [params, setParams] = useSearchParams()
	const { tab, filters, page } = readState(params)
	const apiFilters = Object.fromEntries(
		Object.entries(filters)
			.filter(([key, value]) => value && key !== "from" && key !== "to")
			.filter(([key]) => !(key === "target_id" && !filters.target_type)),
	)
	if (filters.from) apiFilters.from = startOfDayZ(filters.from)
	if (filters.to) apiFilters.to = nextDayZ(filters.to)
	const query = useQuery({
		queryKey: ["admin", "audit", tab, apiFilters, page],
		queryFn: ({ signal }) => TABS[tab].query({ ...apiFilters, page }, signal),
	})
	const data = query.data
	const filtered = Object.values(filters).some(Boolean)
	const go = (next) =>
		setParams(Object.fromEntries(Object.entries(next).filter(([, value]) => value)))
	const reset = () => go({ tab })
	return (
		<>
			<header className="case-page-heading">
				<h1>감사 기록</h1>
				<p>
					누가 무엇을 봤는지, 백엔드가 AI를 언제 불렀는지 기록만 보여 줘요.
					본문·메모·계좌번호는 없어요.
				</p>
			</header>
			<div className="case-action-buttons" role="tablist" aria-label="감사 기록 종류">
				{Object.entries(TABS).map(([key, value]) => (
					<button
						key={key}
						type="button"
						role="tab"
						aria-selected={tab === key}
						onClick={() => go({ tab: key })}
					>
						{value.label}
					</button>
				))}
			</div>
			<section className="case-panel" role="tabpanel" aria-label={TABS[tab].label}>
				<FilterForm
					key={`${tab}-${params.toString()}`}
					tab={tab}
					applied={filters}
					onApply={(draft) => go({ tab, ...draft })}
					onReset={reset}
				/>
				<AsyncState query={query} />
				{data &&
					(data.items.length ? (
						<div
							className="case-table-scroll"
							tabIndex={0}
							aria-label={`${TABS[tab].label} 표`}
						>
							{tab === "ai" ? (
								<AiCallRows items={data.items} />
							) : (
								<AccessLogRows items={data.items} />
							)}
						</div>
					) : (
						<div>
							<p>{filtered ? "조건에 맞는 기록이 없어요." : "아직 기록이 없어요."}</p>
							{filtered && (
								<button type="button" onClick={reset}>
									필터 초기화
								</button>
							)}
						</div>
					))}
				{data && data.totalPages > 1 && (
					<nav className="case-pagination" aria-label="기록 페이지">
						<button
							type="button"
							disabled={page <= 1}
							onClick={() => go({ tab, ...filters, page: String(page - 1) })}
						>
							이전
						</button>
						<span>
							{page} / {data.totalPages} (전체 {data.total}건)
						</span>
						<button
							type="button"
							disabled={page >= data.totalPages}
							onClick={() => go({ tab, ...filters, page: String(page + 1) })}
						>
							다음
						</button>
					</nav>
				)}
			</section>
		</>
	)
}
