// 수정본 번호 → 화면 글자. 1번이 AI 원문이고, 사람이 처음 고친 본이 2번이에요(IF-VRF-02, BE PR #14).
// 실제 STR 화면과 시연 화면이 같이 써요. 번호가 없으면(아직 제출 전 등) "-"예요.
export const AI_ORIGINAL_REVISION_NO = 1

export function revisionLabel(revisionNo) {
	if (revisionNo == null) return "-"
	return revisionNo === AI_ORIGINAL_REVISION_NO
		? `수정본 ${revisionNo}번 (AI 원문)`
		: `수정본 ${revisionNo}번`
}
