// VI부 "의심스러운 거래유형" 선택 목록 — 5분류 38항목.
// 출처: UI/UX 검토 자료 v1.3(dajaba-flow-demo, 11/7)의 "첨부 미확정 서식 참고안". 항목명·분류는 협의안이에요.
//
// 〔확인 필요 — 준혁·채영〕 코드(id)는 아직 확정이 아니에요. 시연 자료의 DEMO_ 접두사 코드를 그대로 둬서
// 실제 코드로 착각하지 않게 했어요. 룰 명세의 "서식 유형 번호"가 정해지면 id만 바꿔요(화면 코드는 그대로).
// 서버가 이 목록에 없는 코드를 주면(suspicion_types·_recommended) 지우지 않고 "확인 필요한 유형"으로 보여 줘요.
export const SUSPICION_TYPES = [
	{
		id: "DEMO_VI1_01",
		group: "VI-1. 금융사고 또는 긴급조사가 요청되는 사건 관련",
		label: "금융사고 거액횡령 의심",
	},
	{
		id: "DEMO_VI1_02",
		group: "VI-1. 금융사고 또는 긴급조사가 요청되는 사건 관련",
		label: "뇌물 공여·수수",
	},
	{
		id: "DEMO_VI1_03",
		group: "VI-1. 금융사고 또는 긴급조사가 요청되는 사건 관련",
		label: "거액 외화도피",
	},
	{
		id: "DEMO_VI1_04",
		group: "VI-1. 금융사고 또는 긴급조사가 요청되는 사건 관련",
		label: "조직범죄·강력사건 연루",
	},
	{
		id: "DEMO_VI1_05",
		group: "VI-1. 금융사고 또는 긴급조사가 요청되는 사건 관련",
		label: "테러자금",
	},
	{
		id: "DEMO_VI1_06",
		group: "VI-1. 금융사고 또는 긴급조사가 요청되는 사건 관련",
		label: "기타 긴급조사 필요 거래",
	},
	{
		id: "DEMO_VI1_07",
		group: "VI-1. 금융사고 또는 긴급조사가 요청되는 사건 관련",
		label: "수사기관 자료제공 요청 거래",
	},
	{
		id: "DEMO_VI2_01",
		group: "VI-2. 의심스러운 거래자의 태도 및 특징 관련",
		label: "실명노출 기피",
	},
	{
		id: "DEMO_VI2_02",
		group: "VI-2. 의심스러운 거래자의 태도 및 특징 관련",
		label: "합당한 답변 불제공 또는 자금출처 불명",
	},
	{
		id: "DEMO_VI2_03",
		group: "VI-2. 의심스러운 거래자의 태도 및 특징 관련",
		label: "업력·규모 대비 과다 거래",
	},
	{
		id: "DEMO_VI2_04",
		group: "VI-2. 의심스러운 거래자의 태도 및 특징 관련",
		label: "언행과 거래금액의 부조화",
	},
	{
		id: "DEMO_VI2_05",
		group: "VI-2. 의심스러운 거래자의 태도 및 특징 관련",
		label: "중요인물 관련 거래",
	},
	{
		id: "DEMO_VI2_06",
		group: "VI-2. 의심스러운 거래자의 태도 및 특징 관련",
		label: "어색하고 불안한 태도",
	},
	{
		id: "DEMO_VI2_07",
		group: "VI-2. 의심스러운 거래자의 태도 및 특징 관련",
		label: "사전거래 없는 고객의 의심거래 요청",
	},
	{
		id: "DEMO_VI2_08",
		group: "VI-2. 의심스러운 거래자의 태도 및 특징 관련",
		label: "의심스러운 동행자",
	},
	{
		id: "DEMO_VI2_09",
		group: "VI-2. 의심스러운 거래자의 태도 및 특징 관련",
		label: "불특정다수와의 거래",
	},
	{
		id: "DEMO_VI2_10",
		group: "VI-2. 의심스러운 거래자의 태도 및 특징 관련",
		label: "계약자·수익자의 빈번하거나 갑작스러운 변경",
	},
	{ id: "DEMO_VI3_01", group: "VI-3. 계좌 정보 관련", label: "타인 명의 또는 계좌 이용" },
	{ id: "DEMO_VI3_02", group: "VI-3. 계좌 정보 관련", label: "특별한 사유 없는 복수 계좌 개설" },
	{ id: "DEMO_VI3_03", group: "VI-3. 계좌 정보 관련", label: "의심스러운 계약·계좌 해지" },
	{ id: "DEMO_VI3_04", group: "VI-3. 계좌 정보 관련", label: "단발성 계좌 이용" },
	{ id: "DEMO_VI4_01", group: "VI-4. 거래유형 관련", label: "갑작스러운 거래패턴 변화" },
	{ id: "DEMO_VI4_02", group: "VI-4. 거래유형 관련", label: "원격지거래" },
	{ id: "DEMO_VI4_03", group: "VI-4. 거래유형 관련", label: "교환거래" },
	{ id: "DEMO_VI4_04", group: "VI-4. 거래유형 관련", label: "분할거래" },
	{ id: "DEMO_VI4_05", group: "VI-4. 거래유형 관련", label: "현금 집착 거래" },
	{ id: "DEMO_VI4_06", group: "VI-4. 거래유형 관련", label: "거액 입금 후 당일·익일 인출" },
	{ id: "DEMO_VI4_07", group: "VI-4. 거래유형 관련", label: "무기명증서 관련거래" },
	{
		id: "DEMO_VI4_08",
		group: "VI-4. 거래유형 관련",
		label: "계좌개설 없는 거액 환전 또는 외국 송금",
	},
	{
		id: "DEMO_VI4_09",
		group: "VI-4. 거래유형 관련",
		label: "의심스러운 담보대출 또는 보험 즉시 약관대출",
	},
	{
		id: "DEMO_VI4_10",
		group: "VI-4. 거래유형 관련",
		label: "주금 납입거래 또는 예금잔액증명서 발급 요청",
	},
	{ id: "DEMO_VI4_11", group: "VI-4. 거래유형 관련", label: "다중거래 동시요청" },
	{ id: "DEMO_VI4_12", group: "VI-4. 거래유형 관련", label: "빈번한 입출금(입출고)" },
	{
		id: "DEMO_VI4_13",
		group: "VI-4. 거래유형 관련",
		label: "의심스러운 대여금고 또는 보호예수 거래",
	},
	{ id: "DEMO_VI4_14", group: "VI-4. 거래유형 관련", label: "법인·타인자산 담보 거래" },
	{
		id: "DEMO_VI4_15",
		group: "VI-4. 거래유형 관련",
		label: "무관업종 또는 의심스러운 재산에 대한 보험청약",
	},
	{ id: "DEMO_VI4_16", group: "VI-4. 거래유형 관련", label: "테러자금 의심 거래" },
	{ id: "DEMO_VI5_01", group: "VI-5. 기타 특징 및 유형", label: "기타 (특징·유형을 따로 기술)" },
]

export const SUSPICION_GROUPS = [...new Set(SUSPICION_TYPES.map((item) => item.group))]

const BY_ID = new Map(SUSPICION_TYPES.map((item) => [item.id, item]))

/** 코드 → 화면 글자. 모르는 코드는 숨기지 않고 코드를 같이 보여 줘요. */
export const suspicionTypeLabel = (id) => BY_ID.get(id)?.label ?? `확인 필요한 유형 (${id})`

export const isKnownSuspicionType = (id) => BY_ID.has(id)

// 의심 정도 1~5 (지점 = 담당 조사역, 본점 = 승인자). 기본값 없음.
// 서식 참고안은 양 끝만 설명해요: 1 의심스러우나 불확실함 → 5 매우 의심스러움.
export const SUSPICION_LEVELS = [1, 2, 3, 4, 5]
export const SUSPICION_LEVEL_HINT = "1: 의심스러우나 불확실함 → 5: 매우 의심스러움"
