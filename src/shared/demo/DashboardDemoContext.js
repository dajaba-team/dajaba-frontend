import { createContext } from "react"

// 운영 인증·서버 캐시와 섞이지 않는 /demo 전용 상태 경계입니다.
export const DashboardDemoContext = createContext(null)
