import "../../../cases/styles/cases.css"
import OpenCasesCard from "../components/OpenCasesCard"

// 데이터·배치 운영(ADM-01). 화면 틀(적재·룰 스캔·점수 카드, 메뉴 ready)은 준혁 님 담당(11/7 결정) —
// 지금은 [케이스 생성] 카드(SCRUM-180)만 올려 두고, 틀이 들어오면 그 안으로 옮겨요.
export default function AdminBatchesPage() {
	return (
		<>
			<header className="case-page-heading">
				<h1>데이터·배치 운영</h1>
			</header>
			<OpenCasesCard />
		</>
	)
}
