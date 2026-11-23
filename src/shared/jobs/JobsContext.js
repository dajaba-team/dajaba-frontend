import { createContext } from "react"

// 작업 추적기 공유 값(SCRUM-365). 값은 JobsProvider 가, 읽기는 useJobs 로.
export const JobsContext = createContext(null)
