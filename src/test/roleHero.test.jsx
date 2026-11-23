import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import RoleHero from "../features/overview/components/RoleHero"

function show(role, loginId = "tester") {
	return render(
		<MemoryRouter>
			<RoleHero role={role} loginId={loginId} />
		</MemoryRouter>,
	)
}

beforeEach(() => {
	localStorage.clear()
})

describe("역할별 Hero 이동 카드", () => {
	it.each([
		["INVESTIGATOR", "내 담당 케이스 보기", "/cases?mine=1", "배정 케이스 · 근거 거래 확인"],
		["APPROVER", "승인함 열기", "/approvals", "검토 요청 · 모의 제출"],
		["ADMIN", "데이터·배치 운영 열기", "/admin/batches", "배치 결과 확인 · 담당 배정"],
	])("%s 카드는 버튼 문구로 읽히고 안내 문구는 설명으로 붙는다", (role, name, href, sub) => {
		show(role)
		const link = screen.getByRole("link", { name })
		expect(link).toHaveAttribute("href", href)
		expect(link).toHaveAccessibleDescription(sub)
	})

	it("알 수 없는 역할이면 조사역 카드를 보여 준다", () => {
		show("UNKNOWN")
		expect(screen.getByRole("link", { name: "내 담당 케이스 보기" })).toHaveAttribute(
			"href",
			"/cases?mine=1",
		)
	})

	it("관리자 머리말은 제목·설명과 이동 카드만 — 빵부스러기·하늘색 박스 문구·바로가기는 없다 (SCRUM-345)", () => {
		show("ADMIN", "admin")
		expect(
			screen.getByRole("heading", { level: 1, name: "관리자 대시보드" }),
		).toBeInTheDocument()
		expect(
			screen.getByText("배치 운영, 조사 관리, 승인 등의 업무 현황을 한눈에 확인하세요."),
		).toBeInTheDocument()
		expect(screen.queryByText(/업무 공간/)).toBeNull()
		expect(screen.queryByText(/업무 시작/)).toBeNull()
		expect(screen.queryByRole("heading", { name: "오늘의 배치와 배정 현황" })).toBeNull()
		expect(screen.queryByRole("button", { name: "첫 이용 안내 닫기" })).toBeNull()
		expect(screen.queryByRole("navigation", { name: "바로가기" })).toBeNull()
		expect(screen.getAllByRole("link")).toHaveLength(1) // 데이터·배치 운영 열기 하나
	})
})
