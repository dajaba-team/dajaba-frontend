import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "../app/App"
import { createQueryClient } from "../app/queryClient"
import { MOCK_PASSWORD, resetCases } from "../mocks/handlers"
import { apiClient } from "../shared/api/apiClient"

// S2 last_rejection(BE #115)·suspicion_level_hq(BE #109)를 STR 화면에 반영 — MSW 시드 케이스 1001(DRF-000124).
const apr01 = { id: 3, login_id: "apr01", display_name: "예시 apr01", role: "APPROVER" }
const DRAFT = "DRF-000124"
const STR_PATH = "/cases/CASE-2022-001001/str"

async function caseVersion() {
	const { data } = await apiClient.get("/api/v1/approvals")
	return data.items.find((item) => item.draft_no === DRAFT).case_version
}

// apr01이 결정한 뒤 inv01로 다시 로그인해요.
async function decideThenLoginAsInv01(decide) {
	resetCases(apr01, { pendingApproval: true })
	await decide(await caseVersion())
	await apiClient.post("/api/v1/auth/login", { login_id: "inv01", password: MOCK_PASSWORD })
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={[STR_PATH]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
}

describe("STR 화면 — 반려(last_rejection)·본점 의심 정도", () => {
	it("보완 요청을 받으면 사유·승인자·대상 수정본을 보여 주고, 본문 그대로면 안내한다", async () => {
		await decideThenLoginAsInv01((version) =>
			apiClient.post(`/api/v1/approvals/${DRAFT}/reject`, {
				case_version: version,
				reason_code: "NEED_REVISION",
				comment: "금액 근거 보완",
			}),
		)
		const banner = await screen.findByRole("region", { name: "지금 상태" })
		expect(banner).toHaveTextContent("반려 · 보완 요청 — 금액 근거 보완 · 예시 apr01")
		expect(banner).toHaveTextContent("대상 수정본 1번")
		expect(banner).toHaveTextContent("아직 반려 당시 본문 그대로예요")
	})

	it("승인되면 반려 띠 대신 VI부에 본점 의심 정도가 보인다", async () => {
		await decideThenLoginAsInv01((version) =>
			apiClient.post(`/api/v1/approvals/${DRAFT}/approve`, {
				case_version: version,
				suspicion_level_hq: 4,
			}),
		)
		const vi = (await screen.findByRole("heading", { name: /VI\./ })).closest("section")
		expect(vi).toHaveTextContent("본점 의심 정도 4")
		expect(screen.queryByText(/반려 ·/)).not.toBeInTheDocument()
	})
})
