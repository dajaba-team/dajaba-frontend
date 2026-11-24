// 룰 ID → 화면 이름(백엔드 rules.md v2 이름). 룰 스캔 결과를 "R01 분산 송금 · 149건"처럼 한 줄로(SCRUM-344).
// 모르는 룰은 ID 그대로 보여 줘요.
const NAMES = {
	R01_FAN_OUT: "분산 송금",
	R02_FAN_IN: "집중 입금",
	R03_FX_RELAY: "환전 중계",
	R04_CYCLE: "순환 거래",
	R05_SCATTER_GATHER: "흩었다 모으기",
	R06_GATHER_SCATTER: "모았다 흩기",
}

/** "R01_FAN_OUT" → "R01 분산 송금". 번호는 ID 앞 세 글자. */
export const ruleLabel = (ruleId) =>
	NAMES[ruleId] ? `${ruleId.slice(0, 3)} ${NAMES[ruleId]}` : ruleId
