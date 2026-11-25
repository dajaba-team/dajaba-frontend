// 통화 — 거래 데이터(IBM AML HI-Small)는 통화 이름 원문("US Dollar"), 점수 근거 단위는 ISO 코드("USD")로 와요.
// 화면 표기는 "기호(나라)"(SCRUM-428). $는 여러 나라가 같이 써서 나라로 구분해요. 유로·비트코인은 나라 대신 이름.
// 기호가 낯설거나 글꼴에 따라 깨지는 통화(사우디 리얄 ﷼·스위스 프랑)는 ISO 코드로 써요.
const CURRENCIES = {
	"US Dollar": "$(미국)",
	USD: "$(미국)",
	Euro: "€(유로)",
	EUR: "€(유로)",
	Yuan: "¥(중국)",
	CNY: "¥(중국)",
	Yen: "¥(일본)",
	JPY: "¥(일본)",
	"UK Pound": "£(영국)",
	GBP: "£(영국)",
	Rupee: "₹(인도)",
	INR: "₹(인도)",
	Ruble: "₽(러시아)",
	RUB: "₽(러시아)",
	"Swiss Franc": "CHF(스위스)",
	CHF: "CHF(스위스)",
	"Australian Dollar": "$(호주)",
	AUD: "$(호주)",
	"Canadian Dollar": "$(캐나다)",
	CAD: "$(캐나다)",
	"Mexican Peso": "$(멕시코)",
	MXN: "$(멕시코)",
	"Brazil Real": "R$(브라질)",
	BRL: "R$(브라질)",
	Shekel: "₪(이스라엘)",
	ILS: "₪(이스라엘)",
	"Saudi Riyal": "SAR(사우디)",
	SAR: "SAR(사우디)",
	Bitcoin: "₿(비트코인)",
	BTC: "₿(비트코인)",
}

/** "US Dollar"·"USD" → "$(미국)". 모르면 원문. */
export const currencyLabel = (currency) =>
	currency == null ? "" : (CURRENCIES[currency] ?? currency)
