import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { casesApi } from "../features/cases/api/casesApi"
import { resetCases } from "../mocks/handlers"

// 케이스 API 모듈이 계약서 칸을 빠짐없이 옮기는지, 목업이 계약서 규칙을 따르는지 (SCRUM-317).
const INV01 = { id: 1, login_id: "inv01", display_name: "예시 inv01", role: "INVESTIGATOR" }
const CASE_NO = "CASE-2022-001001"

describe("응답 칸 옮기기 — 계약서 C1·C2·C5", () => {
	it("상세의 policy_version 을 policyVersion 으로 옮긴다", async () => {
		resetCases(INV01)
		const detail = await casesApi.detail(CASE_NO)
		expect(detail).toHaveProperty("policyVersion")
		expect(detail.policyVersion).toBe(detail.scoreBand ? "mock-policy" : null)
	})
	it("목록 한 줄도 policyVersion 칸이 있다 — 정책이 없으면 scoreBand 와 같이 null", async () => {
		resetCases(INV01)
		const { items } = await casesApi.list({})
		for (const item of items) {
			expect(item).toHaveProperty("policyVersion")
			if (item.policyVersion === null) expect(item.scoreBand).toBeNull()
		}
	})
	it("그래프 선의 amount_basis 를 amountBasis 로 옮긴다", async () => {
		resetCases(INV01)
		const graph = await casesApi.graph({ caseNo: CASE_NO })
		expect(graph.edges.length).toBeGreaterThan(0)
		for (const edge of graph.edges) expect(edge.amountBasis).toBe("RECEIVED")
	})
})

// src/mocks·src/test·features/cases 안 파일 전부 — 예전 룰 이름·앞 0 붙은 가린 계좌가 다시 들어오지 않게(계약서 2.4·5.7).
function filesUnder(dir) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name)
		return statSync(path).isDirectory() ? filesUnder(path) : [path]
	})
}
const SOURCES = ["src/mocks", "src/test", "src/features/cases"]
	.flatMap(filesUnder)
	.filter((path) => /\.(js|jsx)$/.test(path))

describe("목업 규칙 — 계약서 2.4·5.7", () => {
	it("룰 이름은 v2 — _24H 같은 예전 이름을 쓰지 않는다", () => {
		const hits = SOURCES.filter((path) => /R0\d_[A-Z_]*_24H/.test(readFileSync(path, "utf8")))
		expect(hits).toEqual([])
	})
	it("가린 계좌는 은행 번호 앞 0 없이(10_****8842) — 010_**** 모양을 쓰지 않는다", () => {
		const hits = SOURCES.filter((path) =>
			/(^|[^0-9A-Za-z])0\d{2}_\*{4}/.test(readFileSync(path, "utf8")),
		)
		expect(hits).toEqual([])
	})
})
