import { ruleLabel } from "./ruleLabels"

// 룰 스캔 진행 문구 — 자동 처리 현황 칸과 실행 결과 표가 같이 써요. "R03 환전 중계 실행 중 (3/6)".
export const scanningText = (progress) =>
	progress?.current
		? `${ruleLabel(progress.current)} 실행 중 (${progress.done + 1}/${progress.total})`
		: "룰 스캔 시작 중"
