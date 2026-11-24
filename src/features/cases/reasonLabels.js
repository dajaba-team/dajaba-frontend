import { currencyLabel } from "./currencyLabels"

// 점수 근거(latest_score.reasons) 화면 글자 — AI 점수 서버가 준 값은 기계용 코드(영문)라 여기서만 한글로 바꿔요.
// 서버·AI 요청·요약 해시는 코드를 그대로 써야 해서(규약 v0.4, 안건 3) 값 자체는 바꾸지 않아요.
// 이름은 "<지표>_<기간>" 꼴(account_in_counterparties_24h). 모르는 지표는 코드를 그대로 보여 줘요.

const METRICS = {
	account_in_counterparties: "입금 상대 계좌 수",
	account_out_counterparties: "출금 상대 계좌 수",
	fan_in_degree: "입금 상대 계좌 수",
	fan_out_degree: "송금 상대 계좌 수",
	amount_in_sum: "입금 합계",
	amount_out_sum: "출금 합계",
	tx_count: "거래 건수",
	night_tx_ratio: "야간 거래 비율",
	// 모델이 주목한 점(model_focus)에 나오는 모델 특징 이름(SCRUM-410) — 서버 원문 그대로 오던 것
	paid_raw_currency_count: "보낸 통화 종류 수",
	received_raw_currency_count: "받은 통화 종류 수",
	evidence_account_count: "근거 거래 관련 계좌 수",
	evidence_count: "근거 거래 수",
	prior_alert_count: "이전 경보 수",
	excluded_self_transfer_count: "제외한 자기 이체 수",
}

// 표에 없는 특징 이름은 낱말 뜻으로 옮겨요(SCRUM-410). 모든 낱말을 알 때만 — 하나라도 모르면 코드 그대로 둬요.
// 빈 글자("")는 뜻 없이 붙는 낱말(raw = 환산 전 원래 값)이라 건너뛰어요.
const WORDS = {
	paid: "보낸",
	sent: "보낸",
	received: "받은",
	in: "입금",
	out: "출금",
	inbound: "입금",
	outbound: "출금",
	raw: "",
	currency: "통화",
	currencies: "통화",
	amount: "금액",
	amounts: "금액",
	sum: "합계",
	total: "합계",
	mean: "평균",
	avg: "평균",
	median: "중앙값",
	max: "최대",
	min: "최소",
	std: "표준편차",
	ratio: "비율",
	rate: "비율",
	share: "비중",
	count: "수",
	num: "수",
	tx: "거래",
	txn: "거래",
	transaction: "거래",
	transactions: "거래",
	account: "계좌",
	accounts: "계좌",
	counterparty: "상대 계좌",
	counterparties: "상대 계좌",
	evidence: "근거",
	bank: "은행",
	banks: "은행",
	distinct: "서로 다른",
	unique: "서로 다른",
	same: "같은",
	other: "다른",
	cross: "타",
	night: "야간",
	payment: "결제",
	format: "방식",
	formats: "방식",
	path: "경로",
	paths: "경로",
	hop: "단계",
	hops: "단계",
	cycle: "순환",
	prior: "이전",
	alert: "경보",
	alerts: "경보",
	self: "자기",
	transfer: "이체",
	transfers: "이체",
	span: "기간",
	interval: "간격",
	gap: "간격",
	first: "첫",
	last: "마지막",
	degree: "연결 수",
}

function wordsLabel(metric) {
	const words = (metric ?? "").split("_")
	if (words.length < 2 || !words.every((word) => word in WORDS)) return null
	return words
		.map((word) => WORDS[word])
		.filter(Boolean)
		.join(" ")
}

const WINDOWS = { h: "시간", d: "일" }

// 관측 기준(observation.basis)
const BASES = {
	distinct_inbound_counterparties: "서로 다른 입금 상대 계좌",
	distinct_outbound_counterparties: "서로 다른 출금 상대 계좌",
}

// 지표별 개수 단위 — count 는 "계좌 수"면 개, 그 밖은 건.
const COUNT_UNIT = {
	account_in_counterparties: "개",
	account_out_counterparties: "개",
	fan_in_degree: "개",
	fan_out_degree: "개",
}

function split(name) {
	const match = /^(.+)_(\d+)([hd])$/.exec(name ?? "")
	return match
		? { metric: match[1], window: `${match[2]}${WINDOWS[match[3]]}` }
		: { metric: name }
}

/** "account_in_counterparties_24h" → "24시간 입금 상대 계좌 수". 표에 없으면 낱말 뜻으로, 그래도 모르면 null(화면이 코드를 보여 줘요). */
export function reasonLabel(name) {
	const { metric, window } = split(name)
	const label = METRICS[metric] ?? wordsLabel(metric)
	if (!label) return null
	return window ? `${window} ${label}` : label
}

/** 관측 기준 한글. 모르면 null — 영문 코드는 화면에 쓰지 않아요(이름이 이미 같은 뜻을 담아요). */
export const basisLabel = (basis) => BASES[basis] ?? null

/**
 * 값 + 단위. count → 개/건, ratio → %, 통화 코드(USD)는 한글 통화 이름. 모르는 단위는 붙이지 않아요.
 * @param format 숫자 서식 함수(반올림하지 않는 formatNumber)
 */
export function withReasonUnit(value, unit, name, format) {
	if (value == null) return null
	if (typeof value !== "number") return String(value)
	if (unit === "ratio") return `${format(Math.round(value * 1000) / 10)}%`
	if (unit === "count") return `${format(value)}${COUNT_UNIT[split(name).metric] ?? "건"}`
	if (/^[A-Z]{3}$/.test(unit ?? "")) return `${format(value)} ${currencyLabel(unit)}`
	return format(value)
}
