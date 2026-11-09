import { describe, expect, it } from "vitest"
import { revisionLabel } from "../shared/str/revisionLabel"

describe("수정본 번호 표시 (SCRUM-119)", () => {
	it("1번은 AI 원문이에요", () => {
		expect(revisionLabel(1)).toBe("수정본 1번 (AI 원문)")
	})
	it("처음 고친 본은 2번이고 AI 원문 표시가 없어요", () => {
		expect(revisionLabel(2)).toBe("수정본 2번")
	})
	it("번호가 없으면 AI 원문으로 오해하지 않게 '-'예요", () => {
		expect(revisionLabel(null)).toBe("-")
		expect(revisionLabel(undefined)).toBe("-")
	})
})
