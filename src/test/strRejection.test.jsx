import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
	const user = userEvent.setup()
	render(
		<QueryClientProvider client={createQueryClient()}>
			<MemoryRouter initialEntries={[STR_PATH]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	)
	return user
}

const rejectNeedRevision = (version) =>
	apiClient.post(`/api/v1/approvals/${DRAFT}/reject`, {
		case_version: version,
		reason_code: "NEED_REVISION",
		comment: "금액 근거 보완",
	})

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

	it("고쳐 저장하면 같은 본문 안내가 사라지고, 반려 사유 띠는 보완 중이라 남는다", async () => {
		const user = await decideThenLoginAsInv01(rejectNeedRevision)
		const banner = await screen.findByRole("region", { name: "지금 상태" })
		expect(banner).toHaveTextContent("아직 반려 당시 본문 그대로예요")
		const box = within(screen.getByRole("list", { name: "서술부" })).getAllByRole("textbox")[0]
		await user.type(box, " 금액 근거를 보완함.")
		await user.click(screen.getByRole("button", { name: "변경 저장" }))
		// 저장 뒤 S2가 narrative_unchanged=false → 안내·막힘 이유가 사라져요(케이스는 DRAFTED)
		await screen.findByText(/저장했어요/)
		expect(screen.queryByText(/아직 반려 당시 본문 그대로예요/)).not.toBeInTheDocument()
		expect(screen.queryByText(/반려 당시와 본문이 같아요/)).not.toBeInTheDocument()
		expect(screen.getByRole("region", { name: "지금 상태" })).toHaveTextContent(
			"반려 · 보완 요청 — 금액 근거 보완",
		)
	})

	it("반려 뒤 다시 생성한 새 초안이면 케이스 이력의 반려 사유를 보여 준다", async () => {
		await decideThenLoginAsInv01(async (version) => {
			await rejectNeedRevision(version)
			await apiClient.post("/api/v1/auth/login", {
				login_id: "inv01",
				password: MOCK_PASSWORD,
			})
			await apiClient.post("/api/v1/cases/CASE-2022-001001/str-drafts", {
				case_version: version + 1,
			})
		})
		const banner = await screen.findByRole("region", { name: "지금 상태" })
		expect(banner).toHaveTextContent("반려 · 보완 요청 — 금액 근거 보완 · apr01")
		expect(banner).toHaveTextContent("이전 초안에 대한 반려")
		expect(banner).not.toHaveTextContent("아직 반려 당시 본문 그대로예요")
	})
})
