import { useContext } from "react"
import { JobsContext } from "./JobsContext"

// 추적기 밖(시연 화면·테스트)에서도 깨지지 않게 빈 값을 돌려줘요 — track 은 아무 일도 안 해요.
const NONE = {
	jobs: [],
	track: () => false,
	recheck: () => {},
	markSeen: () => {},
	running: 0,
	unseen: 0,
}

/** 어느 화면에서든 `const { track } = useJobs()` 로 작업을 등록해요. */
export function useJobs() {
	return useContext(JobsContext) ?? NONE
}
