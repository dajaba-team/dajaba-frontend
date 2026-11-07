import { createContext, useContext, useEffect } from "react"

export const GuideContext = createContext(null)

// 페이지 안에서 `useGuide("이 화면에서 할 일 한 줄")`을 부르면 안내 띠 문구를 덮어쓰고,
// 화면을 떠나면 역할 기본 문구로 돌아갑니다.
export function useGuide(text) {
	const ctx = useContext(GuideContext)
	useEffect(() => {
		if (!ctx) return
		ctx.set(text)
		return () => ctx.set(null)
	}, [ctx, text])
}
