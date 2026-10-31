import { Link, useParams } from "react-router"

export default function StrPage() {
	const { caseId } = useParams()
	return (
		<>
			<Link to={`/cases/${caseId}`}>← 케이스 상세</Link>
			<h1>STR 초안</h1>
			<p>케이스 {caseId}의 보고서 작업 공간입니다.</p>
			<p>초안 생성·편집·검증·승인 요청과 PDF는 백엔드 명세 확정 후 연결합니다.</p>
		</>
	)
}
