// 배치 건수 표시 — 5078345 → "5,078,345". 값이 없으면 0.
export const formatCount = (value) => (value ?? 0).toLocaleString("ko-KR")
