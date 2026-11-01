import { useState } from "react"
import { Link } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { clearBusinessData } from "../../../app/queryClient"
import { sessionKey } from "../../auth/hooks/useSession"
import { connectionApi } from "../api/connectionApi"
import "../styles/connection.css"

const ACCOUNTS = ["inv01", "inv02", "apr01", "admin"]
const usingMocks = import.meta.env.VITE_USE_MOCKS === "true"
const passwordHint = usingMocks
	? "MSW 비밀번호는 mock-password"
	: "비밀번호는 백엔드 .env의 DEV_USER_PASSWORD"

const checks = [
	{ id: "health", label: "서버 상태", request: "GET /actuator/health" },
	{ id: "apiDocs", label: "API 문서", request: "GET /v3/api-docs" },
	{ id: "me", label: "현재 세션", request: "GET /api/v1/auth/me" },
	{ id: "login", label: "로그인", request: "POST /api/v1/auth/login" },
	{ id: "logout", label: "로그아웃 (CSRF)", request: "POST /api/v1/auth/logout" },
]

const errorCode = (result) => result.data?.error?.code

// API 주소가 다른 출처면 백엔드 CORS(/api/**만 허용) 때문에 서버가 응답해도 브라우저가 막습니다.
const crossOrigin =
	new URL(connectionApi.baseUrl(), window.location.origin).origin !== window.location.origin

function unreachable(result) {
	if (result.status !== null) return null
	return crossOrigin
		? "브라우저가 응답을 막았어요(CORS). 백엔드는 /api/** 만 다른 출처를 허용해요. .env.local의 VITE_API_BASE_URL을 비우거나 / 로 두고 개발 서버를 다시 켜 주세요."
		: "서버에 연결하지 못했어요. 백엔드가 켜져 있는지, Vite 프록시 설정을 확인해 주세요."
}

// 응답 하나를 "통과/실패 + 한 줄 설명"으로 바꿉니다. 401 비로그인처럼 예상된 실패는 통과로 봅니다.
const interpret = {
	health: (r) =>
		r.ok && r.data?.status === "UP"
			? { pass: true, summary: "UP" }
			: { pass: false, summary: unreachable(r) || `상태 ${r.data?.status ?? r.status}` },
	apiDocs: (r) => {
		if (!r.ok || !r.data?.paths)
			return {
				pass: false,
				summary:
					unreachable(r) ||
					(r.status === 404
						? "API 문서가 꺼져 있어요. 백엔드를 local 프로파일로 실행해 주세요."
						: `응답 ${r.status}`),
			}
		const paths = Object.entries(r.data.paths)
		return {
			pass: true,
			summary: `${r.data.info?.title ?? "OpenAPI"} ${r.data.info?.version ?? ""} · 경로 ${paths.length}개`,
			detail: paths.map(
				([path, methods]) => `${Object.keys(methods).join(", ").toUpperCase()} ${path}`,
			),
		}
	},
	me: (r) => {
		if (r.ok)
			return {
				pass: true,
				summary: `로그인됨 — ${r.data.display_name} (${r.data.login_id}) · ${r.data.role}`,
			}
		if (r.status === 401) return { pass: true, summary: "로그인 안 됨 — 401 정상 응답" }
		return { pass: false, summary: unreachable(r) || `응답 ${r.status} ${errorCode(r) ?? ""}` }
	},
	login: (r) =>
		r.ok
			? {
					pass: true,
					summary: connectionApi.hasCsrfCookie()
						? "로그인 성공 · XSRF-TOKEN 쿠키 있음"
						: "로그인 성공 · XSRF-TOKEN 쿠키 아직 없음",
				}
			: {
					pass: false,
					summary:
						unreachable(r) ||
						(errorCode(r) === "LOGIN_FAILED"
							? `401 LOGIN_FAILED — 아이디·비밀번호를 확인해 주세요 (${passwordHint})`
							: errorCode(r) === "INVALID_REQUEST"
								? "400 INVALID_REQUEST — 비밀번호를 입력해 주세요"
								: `응답 ${r.status} ${errorCode(r) ?? ""}`),
				},
	logout: (r) => {
		if (r.ok) return { pass: true, summary: `${r.status} — CSRF 헤더 통과, 세션 종료` }
		if (errorCode(r) === "CSRF_INVALID")
			return {
				pass: false,
				summary: "403 CSRF_INVALID — XSRF-TOKEN 쿠키와 헤더가 맞지 않아요",
			}
		if (r.status === 401) return { pass: false, summary: "401 — 먼저 로그인해 주세요" }
		return { pass: false, summary: unreachable(r) || `응답 ${r.status} ${errorCode(r) ?? ""}` }
	},
}

export default function ConnectionCheckPage() {
	const queryClient = useQueryClient()
	const [loginId, setLoginId] = useState("inv01")
	const [password, setPassword] = useState("")
	// 결과는 확인한 시점의 기록이라 Query 캐시에 넣지 않습니다.
	const [results, setResults] = useState({})
	const [running, setRunning] = useState(false)

	async function run(id, request) {
		setResults((prev) => ({ ...prev, [id]: { running: true } }))
		const response = await request()
		const result = { ...interpret[id](response), status: response.status, ms: response.ms }
		setResults((prev) => ({ ...prev, [id]: result }))
		return result
	}

	async function guard(task) {
		setRunning(true)
		try {
			await task()
		} finally {
			setRunning(false)
		}
	}

	// 이 화면에서 세션을 바꾸면 업무 화면이 이전 계정 캐시를 보여 주지 않도록 정리합니다.
	async function resetSession() {
		await clearBusinessData(queryClient)
		queryClient.removeQueries({ queryKey: sessionKey })
	}

	const readChecks = () =>
		guard(async () => {
			await run("health", connectionApi.health)
			await run("apiDocs", connectionApi.apiDocs)
			await run("me", connectionApi.me)
		})
	const login = () =>
		guard(async () => {
			const result = await run("login", () => connectionApi.login(loginId, password))
			if (result.pass) await resetSession()
			await run("me", connectionApi.me)
		})
	const logout = () =>
		guard(async () => {
			const result = await run("logout", connectionApi.logout)
			if (result.pass) await resetSession()
			await run("me", connectionApi.me)
		})

	return (
		<main id="main-content" className="connection-page">
			<header className="connection-heading">
				<h1>백엔드 연동 확인</h1>
				<p>
					API 주소 <code>{connectionApi.baseUrl()}</code>
					{usingMocks ? " · MSW 예시 응답 (실제 백엔드 아님)" : " · 실제 백엔드"}
					{crossOrigin && " · 다른 출처 직접 호출 (Vite 프록시 안 거침)"}
				</p>
				<Link to="/cases">업무 화면으로</Link>
			</header>

			<section className="connection-actions" aria-label="확인 실행">
				<button type="button" disabled={running} onClick={readChecks}>
					전체 확인
				</button>
				<label htmlFor="connection-login-id">테스트 계정</label>
				<select
					id="connection-login-id"
					value={loginId}
					disabled={running}
					onChange={(event) => setLoginId(event.target.value)}
				>
					{ACCOUNTS.map((id) => (
						<option key={id} value={id}>
							{id}
						</option>
					))}
				</select>
				<label htmlFor="connection-password">비밀번호</label>
				<input
					id="connection-password"
					type="password"
					autoComplete="current-password"
					value={password}
					disabled={running}
					onChange={(event) => setPassword(event.target.value)}
				/>
				<button type="button" disabled={running} onClick={login}>
					로그인
				</button>
				<button type="button" disabled={running} onClick={logout}>
					로그아웃
				</button>
			</section>

			<div
				className="connection-table-scroll"
				role="region"
				aria-label="확인 결과"
				tabIndex={0}
			>
				<table className="connection-table">
					<caption className="visually-hidden">항목별 요청과 결과</caption>
					<thead>
						<tr>
							<th scope="col">항목</th>
							<th scope="col">요청</th>
							<th scope="col">결과</th>
							<th scope="col">내용</th>
						</tr>
					</thead>
					<tbody aria-live="polite">
						{checks.map((check) => (
							<ResultRow key={check.id} check={check} result={results[check.id]} />
						))}
					</tbody>
				</table>
			</div>
		</main>
	)
}

function ResultRow({ check, result }) {
	const state = !result
		? { label: "대기", className: "" }
		: result.running
			? { label: "확인 중…", className: "" }
			: result.pass
				? { label: "통과", className: "is-pass" }
				: { label: "실패", className: "is-fail" }
	return (
		<tr>
			<th scope="row">{check.label}</th>
			<td>
				<code>{check.request}</code>
			</td>
			<td>
				<span className={`connection-state ${state.className}`}>{state.label}</span>
				{result?.ms !== undefined && <span className="connection-ms"> {result.ms}ms</span>}
			</td>
			<td>
				{result?.summary}
				{result?.detail && (
					<details>
						<summary>경로 목록</summary>
						<ul>
							{result.detail.map((line) => (
								<li key={line}>
									<code>{line}</code>
								</li>
							))}
						</ul>
					</details>
				)}
			</td>
		</tr>
	)
}
