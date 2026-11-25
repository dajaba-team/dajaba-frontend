// 사용 안내 단계(SCRUM-428) — 업무 흐름 순서. 이미지는 public/tutorial/ 에 같은 이름으로 넣으면 바로 보여요.
// 이미지가 아직 없으면 창이 "화면 이미지 준비 중" 자리를 보여 줘요.
const img = (name) => `${import.meta.env.BASE_URL}tutorial/${name}.png`

export const TUTORIAL_STEPS = [
	{
		id: "dashboard",
		who: "모든 역할",
		title: "대시보드에서 시작해요",
		image: img("01-dashboard"),
		points: [
			"로그인하면 역할에 맞는 대시보드가 열려요.",
			"카드를 눌러 지금 처리할 업무로 바로 갈 수 있어요.",
			"오른쪽 위 이름 칩에서 로그아웃하고 다른 역할로 바꿔 볼 수 있어요.",
		],
	},
	{
		id: "assign",
		who: "관리자",
		title: "새 케이스를 조사역에게 배정해요",
		image: img("02-assign"),
		points: [
			"탐지된 케이스는 처음에 담당자가 없어요(접수).",
			"케이스 상세 [담당자 배정]에서 조사역을 골라 맡겨요.",
		],
	},
	{
		id: "case-list",
		who: "조사역",
		title: "내 담당 케이스를 골라요",
		image: img("03-case-list"),
		points: [
			"조사 케이스에서 상태·담당 필터로 볼 케이스를 좁혀요.",
			"점수가 높은 케이스부터 열어 보세요.",
		],
	},
	{
		id: "investigate",
		who: "조사역",
		title: "근거를 확인하고 메모해요",
		image: img("04-investigate"),
		points: [
			"점수 근거·거래 분석·자금 흐름으로 왜 탐지됐는지 봐요.",
			"AI 요약과 오른쪽 아래 근거 질의로 궁금한 점을 물어봐요.",
			"확인한 내용은 조사 메모에 남겨요.",
		],
	},
	{
		id: "decide",
		who: "조사역",
		title: "의심되면 에스컬레이션, 아니면 종료",
		image: img("05-decide"),
		points: [
			"의심되면 [에스컬레이션]에 사유를 적어 STR 작성 단계로 넘겨요.",
			"오탐이면 [종료]에서 사유를 골라 닫아요. 종료한 케이스는 다시 열 수 없어요.",
		],
	},
	{
		id: "generate",
		who: "조사역",
		title: "STR 초안을 만들어요",
		image: img("06-generate"),
		points: [
			"[STR 초안 생성]을 누르면 AI가 근거로 보고서 초안을 써요.",
			"다 되면 [보고서 열기]로 초안 화면에 들어가요.",
		],
	},
	{
		id: "edit-verify",
		who: "조사역",
		title: "본문을 고치고 검증해요",
		image: img("07-edit-verify"),
		points: [
			"항목 문장을 고친 뒤 [변경 저장]을 눌러요.",
			"[저장본 검증]으로 숫자·근거가 맞는지 확인해요. 통과해야 승인 요청할 수 있어요.",
		],
	},
	{
		id: "submit",
		who: "조사역",
		title: "승인을 요청해요",
		image: img("08-submit"),
		points: [
			"[승인 요청]을 누르면 창이 떠요.",
			"의심 유형과 지점 의심 정도를 고르고 보내요. 보낸 뒤에는 고칠 수 없어요.",
		],
	},
	{
		id: "approve",
		who: "승인자",
		title: "검토하고 승인하거나 반려해요",
		image: img("09-approve"),
		points: [
			"승인함에서 오래 기다린 보고서부터 열어요.",
			"본문과 검증 결과를 보고 승인하거나, 사유를 골라 반려(보완 요청)해요.",
		],
	},
	{
		id: "report",
		who: "승인자",
		title: "모의 제출하고 PDF를 받아요",
		image: img("10-report"),
		points: [
			"승인 완료 화면에서 [모의 제출]을 눌러요. 실제 기관으로는 보내지 않아요.",
			"확정본 PDF는 뒤에서 만들어져요. 다 되면 [확정본 PDF 받기]로 받아요.",
		],
	},
]
