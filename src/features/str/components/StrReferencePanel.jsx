import { useEffect, useId, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { referenceSearchKey, useReferenceSearch } from "../hooks/useStrDraft"
import {
	MAX_TYPOLOGIES,
	QUERY_MAX,
	SEARCH_TYPOLOGIES,
	formatSimilarity,
	initialTypologies,
	invalidInputMessage,
	isAttached,
	queryLength,
	searchBlockReason,
	typologyLabel,
} from "../model/referenceSearch"
import {
	getErrorCode,
	getErrorMessage,
	isAiFailure,
	isNoResponse,
} from "../../../shared/api/apiClient"

const SOURCE_NOTE = "원문은 해당 문서의 쪽에서 확인해 주세요."
const SIMILARITY_HELP =
	"검색어와 얼마나 비슷한지 나타내는 값이에요. 높다고 같은 사건이라는 뜻은 아니에요."

const pageLabel = (page) => (page != null ? `PDF ${page}쪽` : "쪽 정보 없음")

// 참고 사례 패널 (SCRUM-312·333, 설계 문서 A 7.1) — STR 화면 오른쪽(str-aside).
// ① 초안을 만들 때 AI가 붙인 참고 사례(S2 references) ② [유형으로 더 찾아보기] 영역.
// 본문 발췌는 응답에 없고 화면에도 그리지 않아요(문서명·쪽·유사도만).
// [유형으로 더 찾아보기]는 S2 available_actions에 SEARCH_REFERENCES가 있을 때만 — 서버가 권한·설정을 판단해요.
export default function StrReferencePanel({ draftNo, references, facts, canSearch }) {
	const [open, setOpen] = useState(false)
	const areaId = useId()
	return (
		<section className="str-panel" aria-labelledby="str-ref-heading">
			<div className="str-panel-head">
				<h2 id="str-ref-heading">참고 사례</h2>
				<p>초안을 만들 때 붙은 자료 {references.length}건</p>
			</div>
			{references.length === 0 ? (
				<p className="str-muted">이 초안에 붙은 참고 사례가 없어요.</p>
			) : (
				<>
					<ul className="str-ref-list" aria-label="초안에 붙은 참고 사례">
						{references.map((ref, index) => (
							<li key={ref.chunkId ?? `${ref.docTitle}-${ref.page}-${index}`}>
								<strong>{ref.docTitle ?? "문서명 없음"}</strong>
								<span className="str-ref-meta">
									{pageLabel(ref.page)} · 유사도 {formatSimilarity(ref.score)}
								</span>
							</li>
						))}
					</ul>
					<p className="str-muted">{SOURCE_NOTE}</p>
				</>
			)}
			{canSearch && (
				<>
					<button
						type="button"
						className="str-ref-toggle"
						aria-expanded={open}
						aria-controls={areaId}
						onClick={() => setOpen((value) => !value)}
					>
						유형으로 더 찾아보기
					</button>
					{/* 닫았다 열어도 마지막 결과를 유지해요 — 영역은 숨기기만(설계 7.3) */}
					<div id={areaId} hidden={!open}>
						<ReferenceSearch draftNo={draftNo} references={references} facts={facts} />
					</div>
				</>
			)}
		</section>
	)
}

function ReferenceSearch({ draftNo, references, facts }) {
	const client = useQueryClient()
	const queryId = useId()
	const countId = useId()
	const [typologies, setTypologies] = useState(() => initialTypologies(facts))
	const [query, setQuery] = useState("")
	const [limitHit, setLimitHit] = useState(false)
	// [찾기]를 누를 때마다 새 요청 — seq로 같은 조건도 다시 불러요
	const [request, setRequest] = useState(null)
	const search = useReferenceSearch(draftNo, request)

	// 페이지를 떠나면 결과를 지워요(설계 7.3). 진행 중 요청도 취소.
	useEffect(
		() => () => {
			const key = referenceSearchKey(draftNo)
			void client.cancelQueries({ queryKey: key })
			client.removeQueries({ queryKey: key })
		},
		[client, draftNo],
	)

	const length = queryLength(query)
	const over = length > QUERY_MAX
	const blockReason = searchBlockReason({ typologies, query })
	const busy = search.isFetching

	const toggle = (code) => {
		if (typologies.includes(code)) {
			setLimitHit(false)
			setTypologies(typologies.filter((item) => item !== code))
			return
		}
		if (typologies.length >= MAX_TYPOLOGIES) {
			setLimitHit(true)
			return
		}
		setLimitHit(false)
		// 서버로 보내는 순서를 늘 같게(목록 순서)
		setTypologies(
			SEARCH_TYPOLOGIES.map(([item]) => item).filter(
				(item) => item === code || typologies.includes(item),
			),
		)
	}

	const submit = (event) => {
		event.preventDefault()
		if (blockReason || busy) return
		setRequest({ typologies, query, seq: (request?.seq ?? 0) + 1 })
	}

	const error = search.isError ? search.error : null
	const inputError =
		error && error.response?.status === 400 && getErrorCode(error) === "INVALID_REQUEST"
			? invalidInputMessage(error.response?.data?.error?.details)
			: null

	return (
		<form className="str-ref-search" onSubmit={submit} aria-label="참고 사례 찾기">
			<fieldset className="str-ref-types">
				<legend>유형 (최대 {MAX_TYPOLOGIES}개)</legend>
				<div className="str-ref-chips">
					{SEARCH_TYPOLOGIES.map(([code, label]) => (
						<button
							key={code}
							type="button"
							className="str-ref-chip"
							aria-pressed={typologies.includes(code)}
							onClick={() => toggle(code)}
						>
							{label}
						</button>
					))}
				</div>
				{limitHit && (
					<p role="status" className="str-muted">
						유형은 {MAX_TYPOLOGIES}개까지 고를 수 있어요.
					</p>
				)}
			</fieldset>
			<label htmlFor={queryId}>검색어 (선택)</label>
			<input
				id={queryId}
				type="text"
				value={query}
				placeholder="더 좁히고 싶을 때만 적어 주세요"
				aria-invalid={over || Boolean(inputError)}
				aria-describedby={countId}
				onChange={(event) => setQuery(event.target.value)}
			/>
			<p id={countId} className={over ? "str-ref-count is-over" : "str-ref-count"}>
				{length} / {QUERY_MAX}
			</p>
			{inputError && <p role="alert">{inputError}</p>}
			<button type="submit" className="primary" disabled={Boolean(blockReason) || busy}>
				{busy ? "찾는 중…" : "찾기"}
			</button>
			{blockReason && !busy && <p className="str-muted">{blockReason}</p>}
			<div aria-live="polite">
				{busy && <p role="status">참고 사례를 찾는 중이에요.</p>}
				{!busy && error && !inputError && (
					<SearchFailure error={error} onRetry={() => search.refetch()} />
				)}
				{!busy && search.data && (
					<SearchResults result={search.data} references={references} />
				)}
			</div>
		</form>
	)
}

// 502·timeout·응답 없음은 영역 안에만 안내 + [다시 시도]. 조회라 다시 눌러도 문제없어요(설계 7.2).
function SearchFailure({ error, onRetry }) {
	const status = error.response?.status
	const aiDown = isAiFailure(error) || isNoResponse(error) || status === 502 || status === 503
	return (
		<div role="alert" className="str-ref-failure">
			<p>
				{aiDown
					? "AI 서버가 응답하지 않아요. 잠시 후 다시 시도해 주세요."
					: getErrorMessage(error)}
			</p>
			<button type="button" onClick={onRetry}>
				다시 시도
			</button>
		</div>
	)
}

function SearchResults({ result, references }) {
	const [help, setHelp] = useState(false)
	const helpId = useId()
	return (
		<>
			{result.degraded && (
				<p className="str-muted">일부 검색 방식이 응답하지 않아 결과가 줄었을 수 있어요.</p>
			)}
			{result.items.length === 0 ? (
				<p role="status">이 유형의 참고 자료가 아직 없어요.</p>
			) : (
				<>
					<div className="str-ref-results-head">
						<span>찾은 자료 {result.items.length}건 · 유사도순</span>
						<button
							type="button"
							className="str-ref-help"
							aria-label="유사도 설명"
							aria-expanded={help}
							aria-controls={helpId}
							onClick={() => setHelp((value) => !value)}
						>
							?
						</button>
					</div>
					<p id={helpId} className="str-muted" hidden={!help}>
						{SIMILARITY_HELP}
					</p>
					<ul className="str-ref-list" aria-label="찾은 참고 사례">
						{result.items.map((item, index) => (
							<li key={`${item.docTitle}-${item.page}-${index}`}>
								<strong>{item.docTitle ?? "문서명 없음"}</strong>
								{isAttached(item, references) && (
									<span className="str-badge">이미 붙어 있음</span>
								)}
								<span className="str-ref-meta">
									{[item.publisher, item.year].filter(Boolean).join(" ") ||
										"발행처 정보 없음"}{" "}
									· {pageLabel(item.page)} · 유사도 {formatSimilarity(item.score)}
								</span>
								{item.typologies.length > 0 && (
									<ul className="str-ref-tags" aria-label="유형">
										{item.typologies.map((code) => (
											<li key={code}>{typologyLabel(code)}</li>
										))}
									</ul>
								)}
							</li>
						))}
					</ul>
					<p className="str-muted">{SOURCE_NOTE}</p>
				</>
			)}
		</>
	)
}
