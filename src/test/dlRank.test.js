import { describe, expect, it } from "vitest"
import { describeDlRank, toDlRank } from "../features/cases/dlRank"

// ML+DL 조사 순위 글자 (SCRUM-420)
describe("describeDlRank", () => {
	const available = (fields) => ({
		status: "AVAILABLE",
		reason: null,
		mlRank: null,
		fusedRank: null,
		fallbackReason: null,
		dlScore: null,
		...fields,
	})
	it("ML·DL 둘 다 이어지면 결합 순위와 ML 순위", () => {
		expect(describeDlRank(available({ mlRank: 2, fusedRank: 1 }))).toEqual({
			text: "결합 1위",
			note: "ML 2위",
			unavailable: false,
		})
	})
	it("DL 근거가 덜 이어지면 ML 순위를 유지한다고 알려 준다", () => {
		expect(
			describeDlRank(
				available({ mlRank: 3, fusedRank: 3, fallbackReason: "INCOMPLETE_DL_EVIDENCE" }),
			).note,
		).toBe("ML 3위 · DL 근거 일부 빠짐(ML 순위 유지)")
	})
	it("ML 점수가 없으면 순위 없음", () => {
		expect(describeDlRank(available({ fallbackReason: "ML_UNSCORED" })).text).toBe("순위 없음")
	})
	it("UNAVAILABLE 은 이유와 상관없이(새 이유·모르는 이유 포함) 조회 불가, 칸이 없어도 조회 불가", () => {
		for (const reason of [
			"REFERENCE_MISMATCH",
			"EVIDENCE_MISMATCH",
			"AI_UNAVAILABLE",
			"NEW_ONE",
		])
			expect(describeDlRank({ status: "UNAVAILABLE", reason }).text).toBe("순위 조회 불가")
		expect(describeDlRank(null).unavailable).toBe(true)
		expect(describeDlRank(toDlRank(undefined)).text).toBe("순위 조회 불가")
		// 순위 칸이 있어도 상태가 AVAILABLE 이 아니면 지어내지 않아요
		expect(describeDlRank({ status: "UNAVAILABLE", mlRank: 1, fusedRank: 1 }).text).toBe(
			"순위 조회 불가",
		)
	})
	it("서버 snake_case 를 바꾼다", () => {
		expect(
			toDlRank({
				status: "AVAILABLE",
				reason: null,
				ml_rank: 1,
				fused_rank: 2,
				fallback_reason: null,
				dl_score: 0.5,
			}),
		).toEqual({
			status: "AVAILABLE",
			reason: null,
			mlRank: 1,
			fusedRank: 2,
			fallbackReason: null,
			dlScore: 0.5,
		})
	})
})
