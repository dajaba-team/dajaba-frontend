// 점수 표기 [SCRUM-347, docs/06_features/cases.md §1]
// - 서버 점수(0~1 double)를 소수 둘째 자리까지 "버려서" 보여 줘요(목록·상세·대시보드 같이, 11/24). 반올림하면 HIGH 경계 바로 아래(예 0.69996, MEDIUM)가
//   0.70으로 보여 등급 배지와 어긋나요. 정렬·등급은 서버 값 그대로 — 여기는 표시만.
// - 부동소수점 끝자리(0.8600000000000001)를 자릿수로 자르기 전에 toFixed(10)으로 한 번 정리해요.
//   Math.floor(x * 10000)은 0.29 * 10000 = 2899.9999…처럼 한 자리 내려가서 쓰지 않아요.
// - toFixed(10)이 열째 자리에서 반올림하니, 열째 자리 아래 차이(예 0.69999999999996 → 0.70)는 같은 값으로 봐요.
//   모델 점수가 경계에 그만큼 붙을 일은 사실상 없고, 등급은 서버 값으로 정해요 (#79 리뷰).
// - 처음엔 넷째 자리(SCRUM-347), 대시보드만 둘째 자리(SCRUM-392)였는데 목록·상세도 둘째 자리로 맞췄어요(0.9233 → 0.92).

export const SCORE_DECIMALS = 2

/** 점수를 "0.86" 모양 글자로(decimals 자리까지 버림). null·숫자가 아닌 값은 null — 빈 칸 글자는 부르는 쪽이 정해요. */
export function formatScore(score, decimals = SCORE_DECIMALS) {
	if (score == null || score === "") return null
	const value = Number(score)
	if (!Number.isFinite(value)) return null
	const [whole, fraction = ""] = value.toFixed(10).split(".")
	return `${whole}.${fraction.slice(0, decimals)}`
}
