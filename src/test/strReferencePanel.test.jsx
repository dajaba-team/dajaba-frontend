import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import StrReferencePanel from "../features/str/components/StrReferencePanel"

describe("STR 참고 사례 패널", () => {
	it("참고 사례 3건을 문서명·PDF 쪽·소수 둘째 자리 유사도로 표시한다", () => {
		render(
			<StrReferencePanel
				references={[
					{
						chunkId: "c-1",
						docId: "d-1",
						docTitle: "STR 작성 사례집",
						page: 12,
						score: 0.83,
					},
					{
						chunkId: "c-2",
						docId: "d-2",
						docTitle: "의심거래 유형",
						page: 3,
						score: 0.71,
					},
					{
						chunkId: "c-3",
						docId: "d-3",
						docTitle: "자금세탁 의심거래 분석 사례",
						page: 43,
						score: 0.68,
					},
				]}
			/>,
		)

		const panel = screen.getByRole("region", { name: "참고 사례" })
		const cards = within(panel).getAllByRole("listitem")
		expect(cards).toHaveLength(3)
		expect(panel).toHaveTextContent("STR 작성 사례집")
		expect(panel).toHaveTextContent("PDF 12쪽")
		expect(panel).toHaveTextContent("유사도 0.83")
		expect(panel).toHaveTextContent("PDF 3쪽")
		expect(panel).toHaveTextContent("유사도 0.71")
		expect(panel).toHaveTextContent("원문은 해당 문서의 쪽에서 확인해 주세요")
		expect(panel).not.toHaveTextContent("원문 조각")
	})

	it("참고 사례가 0건이면 빈 상태 안내를 표시한다", () => {
		render(<StrReferencePanel references={[]} />)
		const panel = screen.getByRole("region", { name: "참고 사례" })
		expect(panel).toHaveTextContent("연결된 참고 사례가 없어요.")
		expect(within(panel).queryByRole("listitem")).not.toBeInTheDocument()
	})
})
