// 두 문장을 단어 단위로 비교해요(GitHub 리뷰처럼 지운 곳·더한 곳 표시). 순수 함수 — 서버 판단과 무관한 "보기" 용도.
// 결과: [{type: "same" | "del" | "add", text}] — 이어 붙이면 same+del = before, same+add = after.

const tokenize = (text) => (text ?? "").split(/(\s+)/).filter((token) => token !== "")

// 단락 하나는 최대 5,000자라 보통 충분히 작아요. 그래도 너무 크면(앞뒤 같은 부분을 뺀 뒤 칸 수 기준)
// 계산을 멈추고 "통째로 바뀜"으로 보여 줘요 — 화면이 멈추지 않게.
const MAX_CELLS = 2_000_000

function push(out, type, text) {
	if (!text) return
	const last = out[out.length - 1]
	if (last && last.type === type) last.text += text
	else out.push({ type, text })
}

export function diffWords(before, after) {
	const a = tokenize(before)
	const b = tokenize(after)
	const out = []
	// 앞뒤 같은 부분은 먼저 떼어 내요(대부분의 수정은 일부 문장만 바꿔서 표가 작아져요).
	let start = 0
	while (start < a.length && start < b.length && a[start] === b[start]) start += 1
	let endA = a.length
	let endB = b.length
	while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
		endA -= 1
		endB -= 1
	}
	push(out, "same", a.slice(0, start).join(""))
	const midA = a.slice(start, endA)
	const midB = b.slice(start, endB)
	if (midA.length * midB.length > MAX_CELLS) {
		push(out, "del", midA.join(""))
		push(out, "add", midB.join(""))
	} else {
		// LCS 표 — lcs[i][j] = midA[i..]·midB[j..]의 최장 공통 길이
		const n = midA.length
		const m = midB.length
		const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
		for (let i = n - 1; i >= 0; i -= 1)
			for (let j = m - 1; j >= 0; j -= 1)
				lcs[i][j] =
					midA[i] === midB[j]
						? lcs[i + 1][j + 1] + 1
						: Math.max(lcs[i + 1][j], lcs[i][j + 1])
		let i = 0
		let j = 0
		while (i < n && j < m) {
			if (midA[i] === midB[j]) {
				push(out, "same", midA[i])
				i += 1
				j += 1
			} else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
				push(out, "del", midA[i])
				i += 1
			} else {
				push(out, "add", midB[j])
				j += 1
			}
		}
		push(out, "del", midA.slice(i).join(""))
		push(out, "add", midB.slice(j).join(""))
	}
	push(out, "same", a.slice(endA).join(""))
	return out
}

/** 지운·더한 단어 수(공백 제외). 요약 줄에 써요. */
export function diffStats(segments) {
	const count = (type) =>
		segments
			.filter((segment) => segment.type === type)
			.reduce(
				(sum, segment) =>
					sum + tokenize(segment.text.trim()).filter((t) => t.trim()).length,
				0,
			)
	return { added: count("add"), removed: count("del") }
}

/**
 * 단락 목록 두 개(base·current) 비교 — 서버가 준 current 순서대로.
 * 결과: [{section, base, current, segments, changed}] — base에 없던 항목은 통째로 추가로 봐요.
 * base에만 있는 항목은 생기지 않아요: 비교 대상(반려본·AI 원본·이전 수정본)은 모두 같은 초안의 수정본이고,
 * 수정은 이미 있는 단락의 문장만 바꿔요(BE StrDraft.revise — 앞 본문에 고친 문장을 덮어씀, 이 초안에 없는 단락은 400).
 * 단락을 지우거나 더하는 API가 생기면 "지운 항목" 줄을 더해야 해요(#63 리뷰).
 */
export function diffNarratives(base, current) {
	return current.map((item) => {
		const before = base.find((entry) => entry.section === item.section)
		const changed = (before?.text ?? "") !== item.text
		return {
			section: item.section,
			base: before ?? null,
			current: item,
			changed,
			segments: changed
				? diffWords(before?.text ?? "", item.text)
				: [{ type: "same", text: item.text }],
		}
	})
}
