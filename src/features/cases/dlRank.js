// ML+DL 조사 순위 표시 (SCRUM-420) — 서버 dl_rank(계약서 C1·C2, BE CaseDlRank)를 화면 글자로.
// - 서버가 그날 순위를 경보·점수·기준 시각·근거 거래까지 다 맞춰 본 뒤에만 AVAILABLE 을 줘요. 하나라도 어긋나면 UNAVAILABLE.
// - UNAVAILABLE 이유(reason 7종, REFERENCE_MISMATCH·EVIDENCE_MISMATCH 포함)는 값마다 나누지 않고 "순위 조회 불가" 하나로 보여 줘요.
//   모르는 새 이유가 와도 같은 문구예요.
// - 칸이 없거나(옛 서버) 모양이 틀려도 순위를 지어내지 않고 "순위 조회 불가"예요.

export const DL_RANK_UNAVAILABLE = "순위 조회 불가"

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
