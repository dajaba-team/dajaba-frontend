// ML+DL 조사 순위 표시 (SCRUM-420) — 서버 dl_rank(계약서 C1·C2, BE CaseDlRank)를 화면 글자로.
// - 서버가 그날 순위를 경보·점수·기준 시각·근거 거래까지 다 맞춰 본 뒤에만 AVAILABLE 을 줘요. 하나라도 어긋나면 UNAVAILABLE.
// - UNAVAILABLE 이유(reason 7종, REFERENCE_MISMATCH·EVIDENCE_MISMATCH 포함)는 값마다 나누지 않고 "순위 조회 불가" 하나로 보여 줘요.
//   모르는 새 이유가 와도 같은 문구예요.
// - 칸이 없거나(옛 서버) 모양이 틀려도 순위를 지어내지 않고 "순위 조회 불가"예요.

import { formatScore } from "../../shared/format/score"

export const DL_RANK_UNAVAILABLE = "순위 조회 불가"

// 이름·도움말(SCRUM-431) — ML 점수와 ML+DL 순위는 기준이 달라요(ML 0.99가 결합 2위일 수 있음). 화면마다 같은 이름을 써요.
// 결합 순위는 점수를 더한 값이 아니라, 두 점수가 다 있는 경보끼리 ML·DL 각각의 순위 중 더 높은 쪽으로 다시 줄 세운 순위예요(AI dl_ranking).
export const ML_SCORE_LABEL = "ML 위험도 점수"
export const ML_SCORE_HELP = "ML 모델 점수예요. 범죄 확률이나 결합 순위 점수가 아니에요."
export const DL_RANK_LABEL = "ML+DL 조사 순위"
export const DL_RANK_HELP =
	"같은 날 경보 안에서 ML과 DL 중 더 높게 본 쪽을 기준으로 매긴 순위예요. 점수를 더한 값이 아니에요."
export const DL_SCORE_LABEL = "DL 참고 점수"
export const DL_SCORE_HELP =
	"근거 거래별 DL 점수 중 가장 큰 값이에요. 근거 거래가 다 계산되지 않았으면 미산출이에요."

/** 서버 dl_rank → 화면 모양. 없으면 null(= 조회 불가). */
export const toDlRank = (data) =>
	data
		? {
				status: data.status,
				reason: data.reason ?? null,
				mlRank: data.ml_rank ?? null,
				fusedRank: data.fused_rank ?? null,
				fallbackReason: data.fallback_reason ?? null,
				dlScore: data.dl_score ?? null,
			}
		: null

const isAvailable = (rank) => rank?.status === "AVAILABLE"

/**
 * DL 참고 점수 글자(SCRUM-431) — 세 상태를 나눠요.
 * - 순위 응답이 있고 점수가 있으면 점수(ML 점수와 같은 표기, 0도 "0.00")
 * - 순위 응답은 있는데 점수가 없으면(근거 거래가 다 계산되지 않음·ML 점수 없음) "미산출"
 * - 순위 응답 자체를 쓸 수 없으면 "조회 불가"
 */
export function describeDlScore(rank) {
	if (!isAvailable(rank)) return { text: "조회 불가", missing: true }
	if (rank.dlScore == null) return { text: "미산출", missing: true }
	return { text: formatScore(rank.dlScore), missing: false }
}

/** 상세 상단 옆에 작게 붙이는 결합 순위 — 순위가 있을 때만 "N위", 아니면 null(안 그림). */
export const fusedRankText = (rank) =>
	isAvailable(rank) && rank.fusedRank != null ? `${rank.fusedRank}위` : null

/**
 * 순위 한 줄 글자.
 * - 조회 불가 → { text: "순위 조회 불가", unavailable: true }
 * - ML 점수 없음(ML_UNSCORED, 두 순위 null) → "순위 없음" + "ML 점수 없음"
 * - 그 밖 → "결합 N위" + "ML M위", DL 근거가 덜 이어졌으면(INCOMPLETE_DL_EVIDENCE) "DL 근거 일부 빠짐 · ML 순위 유지"
 */
export function describeDlRank(rank) {
	if (!isAvailable(rank)) return { text: DL_RANK_UNAVAILABLE, note: null, unavailable: true }
	if (rank.fusedRank == null || rank.mlRank == null)
		return { text: "순위 없음", note: "ML 점수 없음", unavailable: false }
	return {
		text: `결합 ${rank.fusedRank}위`,
		note:
			rank.fallbackReason === "INCOMPLETE_DL_EVIDENCE"
				? `ML ${rank.mlRank}위 · DL 근거 일부 빠짐(ML 순위 유지)`
				: `ML ${rank.mlRank}위`,
		unavailable: false,
	}
}
