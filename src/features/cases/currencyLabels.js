// 통화 — 거래 데이터(IBM AML HI-Small)는 통화 이름 원문("US Dollar"), 점수 근거 단위는 ISO 코드("USD")로 와요.
const CURRENCIES = {
	"US Dollar": "미국 달러",
	USD: "미국 달러",
	Euro: "유로",
	EUR: "유로",
	Yuan: "중국 위안",
	CNY: "중국 위안",
	Yen: "일본 엔",
	JPY: "일본 엔",
	"UK Pound": "영국 파운드",
	GBP: "영국 파운드",
	Rupee: "인도 루피",
	INR: "인도 루피",
	Ruble: "러시아 루블",
	RUB: "러시아 루블",
	"Swiss Franc": "스위스 프랑",
	CHF: "스위스 프랑",
	"Australian Dollar": "호주 달러",
	AUD: "호주 달러",
	"Canadian Dollar": "캐나다 달러",
	CAD: "캐나다 달러",
	"Mexican Peso": "멕시코 페소",
	MXN: "멕시코 페소",
	"Brazil Real": "브라질 헤알",
	BRL: "브라질 헤알",
	Shekel: "이스라엘 셰켈",
	ILS: "이스라엘 셰켈",
	"Saudi Riyal": "사우디 리얄",
	SAR: "사우디 리얄",
	Bitcoin: "비트코인",
	BTC: "비트코인",
}

/** "US Dollar"·"USD" → "미국 달러". 모르면 원문. */
export const currencyLabel = (currency) =>
	currency == null ? "" : (CURRENCIES[currency] ?? currency)
