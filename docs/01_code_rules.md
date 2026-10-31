# 01. 코드 규칙

> v0.1 · 2026-10-31 · 초안(팀 확인 중) · 정리 지윤

코드 짜기 전과 PR 올리기 전에 보는 규칙이에요. 〔제안〕 표시만 빼면 지금 코드가 이미 지키고 있거나 백엔드에서 확정된 규칙이에요.

## 1. 규칙 세 줄 — 이것만은 꼭 [FE README]

1. **API는 `features/{기능}/api/`에서만 부르고, snake_case는 그 경계에서 한 번 바꾼다.** 페이지·컴포넌트·훅은 `apiClient`를 import하지 않아요. → `03_api.md` §1
2. **서버 데이터는 TanStack Query에만.** 같은 데이터를 Zustand·`useState`에 복사하지 않아요. 쓰기는 자동 재시도·낙관적 상태 변경 없이, 서버 성공 응답 뒤에 캐시를 고쳐요. → §4
3. **버튼은 `role` + 담당자 + `status`로 숨기지만, 판단은 서버가 한다.** 에러는 `error.code`로 분기하고, 실패해도 사용자가 쓰던 입력은 지우지 않아요. → `04_auth_session.md` §4, `03_api.md` §3

## 2. 언어와 파일 [FE 코드, `eslint.config.js`]

- JavaScript만. 컴포넌트는 `.jsx`, API·훅·설정·유틸은 `.js`. **TypeScript·`tsconfig`·타입 전용 파일 없음.**
- 함수 인자·반환 모양이 헷갈리면 JSDoc 한 줄. 외부 응답 검증은 실제 API 계약이 정해진 뒤에 붙여요.
- 포맷은 Prettier가 정해요 — 탭 들여쓰기(4), 세미콜론 없음, 큰따옴표, 한 줄 100자. 손으로 맞추지 말고 `npm run format`.
- ESLint는 경고도 실패(`--max-warnings=0`). `react-hooks` 규칙 끄지 않아요.

## 3. 이름

| 종류               | 규칙                                                      | 예                                                         |
| ------------------ | --------------------------------------------------------- | ---------------------------------------------------------- |
| 컴포넌트 파일·함수 | PascalCase, 한 파일 한 기본 export                        | `CaseMemoEditor.jsx`                                       |
| 페이지             | `{대상}{List·Detail}Page`                                 | `CaseListPage.jsx`, `CaseDetailPage.jsx`                   |
| 시연 페이지        | `Demo` 접두어                                             | `DemoCaseListPage.jsx` → §2 `02_structure.md`              |
| 훅                 | `use` + 대상                                              | `useCases`, `useCaseDetail`, `useSession`                  |
| API 모듈           | `{기능}Api` 객체, 메서드는 동사                           | `casesApi.list`, `casesApi.saveMemo`                       |
| Query key          | 배열, 첫 칸은 리소스                                      | `["auth", "me"]`, `["cases", filters]`, `["case", caseNo]` |
| CSS 클래스         | kebab-case, 상태는 `is-`                                  | `case-table`, `is-active`                                  |
| 상수               | UPPER_SNAKE_CASE                                          | `DEFAULT_PAGE_SIZE`                                        |
| 서버 enum 값       | 백엔드 UPPER_SNAKE 그대로, 화면 글자는 따로 매핑          | `"PENDING_APPROVAL"` → "승인 대기"                         |
| 화면 번호          | 사람이 보는 번호(`case_no`) 그대로, 숫자 PK로 바꾸지 않음 | `CASE-2022-000057`                                         |

## 4. 상태 관리 [FE 코드 `queryClient.js`, 예전 「프론트 구조·개발 규칙」]

| 무엇                                                          | 어디에                                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 서버의 목록·상세·상태·이력·현재 사용자                        | TanStack Query                                                          |
| 아직 저장 안 한 메모·본문, 그 글을 쓰기 시작한 기준 `version` | 컴포넌트 상태                                                           |
| 필터·정렬·페이지                                              | URL 검색 매개변수 (`?status=REVIEWING&page=1`)                          |
| 모달 열림, 탭 선택                                            | 그 화면의 컴포넌트 상태                                                 |
| 여러 화면이 같이 보는 화면 전용 상태(선택한 그래프 노드 등)   | Zustand — 패키지만 있고 **지금은 안 씀**. 필요해질 때 이 표에 먼저 추가 |

- 기본값: 조회 `staleTime` 30초, `retry: false`. **쓰기(mutation)는 `retry: false` 고정** — 응답이 없어도 서버는 저장했을 수 있어요.
- 쓰기 성공 뒤: 응답이 상세 전체면 상세 캐시를 교체, 아니면 재조회. 관련 목록은 무효화.
- 편집 중인 입력은 background refetch나 409 응답으로 덮어쓰지 않아요. 충돌 처리는 `03_api.md` §3.
- 로그인 사용자가 바뀌거나 401이 오면 **업무 캐시를 지우고 진행 중 조회를 취소**해요(`clearBusinessData`). 새 Query key를 만들 때 첫 칸이 `"auth"`가 아니면 자동으로 지워지는 쪽에 들어가요. → `04_auth_session.md` §3

## 5. 에러 처리 [BE 03 §2, BE 04 §5]

- 에러 응답은 `{ error: { code, message, details } }` 하나. **분기는 `error.code`로**, HTTP 상태만 보고 판단하지 않아요(409가 여러 뜻이에요).
- 화면 문구는 `shared/api/apiClient.js`의 `getErrorMessage`에서 한 곳으로 관리해요. 새 코드를 다루면 거기에 먼저 추가해요.
- 서버가 준 `error.message`는 그대로 보여 줘도 되지만, 계좌번호·본문이 섞일 수 있는 `details`는 화면에 통째로 찍지 않아요.
- 컴포넌트마다 try-catch로 감싸지 않아요. Query의 `error` 상태 + `AsyncState`로 보여 줘요.

## 6. 보안·로그 [BE 01 §6·§7, BE 04 §3]

| #   | 규칙                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | 인증은 **세션 쿠키 + CSRF**. 토큰·역할을 localStorage/sessionStorage에 저장하지 않아요. 새로고침하면 `/auth/me`로 다시 받아요 |
| 2   | `VITE_*`는 공개 값이에요. 비밀값·내부 키를 프론트 코드·환경변수에 두지 않아요                                                 |
| 3   | 계좌번호는 서버가 마스킹한 값(`****9D80`)을 그대로. 프론트가 복원·조합하지 않아요 〔확인 필요: `account_key` — FE-6〕         |
| 4   | `console.log`에 거래 금액·계좌번호·고객명·STR 본문·메모를 남기지 않아요. 지원 문의엔 `X-Request-Id`만                         |
| 5   | 메모·STR 본문을 브라우저 저장소에 자동 저장하지 않아요(임시 저장 기능도 서버로)                                               |
| 6   | AI가 쓴 본문을 `dangerouslySetInnerHTML`로 그리지 않아요. 글자로만                                                            |
| 7   | 정답 라벨(`is_laundering`)·패턴 정답은 API에 없어요. 시연 데이터에도 넣지 않아요                                              |

## 7. 하드코딩

- API 주소는 `VITE_API_BASE_URL`, 목업 여부는 `VITE_USE_MOCKS`. 코드에 `http://localhost:8080` 같은 주소를 새로 박지 않아요(`apiClient.js`의 기본값 하나만).
- 서버 enum 값을 화면에서 새로 만들거나 계산하지 않아요 — 위험 등급, HIGH 기준, 다음 상태는 서버가 줘요.
- 페이지 크기·timeout 같은 숫자는 파일 맨 위 상수로.

## 8. 테스트 [FE 코드 `src/test/`, BE 01 §9]

- 도구: Vitest + jsdom + Testing Library + MSW(`src/mocks/server.js`). 테스트용 `apiClient`는 fetch 어댑터로 바꿔 MSW가 받게 해요(`src/test/setup.js`).
- **사용자 흐름으로 써요.** "목록에서 케이스를 누르면 상세가 뜬다", "충돌이 나도 쓰던 메모가 남는다"처럼. 내부 state·훅 반환값을 직접 검사하지 않아요.
- 화면 요소는 역할·이름으로 찾아요(`getByRole("button", { name: "저장" })`). `data-testid`는 마지막 수단.
- PR마다 **정상 1 + 경계 1 + 실패 1**. 실패는 에러 코드별 안내가 맞는지까지.
- 정의 안 된 요청은 테스트가 실패해요(`onUnhandledRequest: "error"`). 새 API를 부르면 `handlers.js`에 같이 넣어요.
- 안 하는 것: 스냅샷 테스트, 스타일 테스트, 커버리지 목표치.

## 9. 브랜치·커밋·PR [컨벤션, BE 01 §10]

- 브랜치: `feat|fix|refactor|docs|test|chore/{Jira 이슈 키}` (예: `feat/SCRUM-21`). PR 대상은 `develop`. `main`은 develop에서만.
- 커밋: `Gitmoji type: 작업 내용`, 명사형 끝맺음 (`✨ feat: 케이스 에스컬레이션 버튼`, `🐛 fix: 계정 전환 뒤 이전 목록 노출`).
- PR: 제목·본문에 Jira 키와 링크, 템플릿 항목 채우기. 화면이 바뀌면 스크린샷.
- **한 가지 일만, 목표 ≤ 400줄**(`package-lock.json`·생성 파일 제외).
- `TODO`엔 미결 번호: `// TODO(FE-3):` (`08_decisions.md` §3).
- 새 라이브러리는 3줄 사유(유지보수 · 무게 · 라이선스). 그래프·PDF·폼 라이브러리도 그 기능을 만들 때 설치해요.
- **최소 1명 Approve 후 머지.** 머지 전 `develop` 최신 반영. 머지 후 Jira 상태 갱신.
- API 계약이 바뀌는 PR은 `casesApi.js` 같은 API 모듈 · `handlers.js` · 테스트 · `03_api.md`를 **같은 PR에서** 고쳐요.

## 10. 자주 하는 실수 모음

- 컴포넌트에서 `apiClient.get(...)` 바로 부르기 → `features/{기능}/api/`로
- 응답의 `login_id`를 컴포넌트에서 그대로 쓰기 → API 모듈에서 `loginId`로 바꿔서 넘기기
- `useQuery` 결과를 `useEffect`로 `useState`에 복사하기 → 그냥 Query 데이터를 쓰기
- 저장 버튼에서 성공 전에 상태 글자를 먼저 바꾸기(낙관적 변경) → 성공 응답 뒤에
- 409면 전부 "다른 사람이 먼저 바꿨어요" → `CONCURRENT_UPDATE`만 그 안내, 나머지는 코드별
- 저장 실패 뒤 입력창 비우기 → 입력은 남기고 안내만
- 화면 페이지 1을 그대로 API `page=1`로 보내기 → API는 0부터
- 위험 등급·다음 상태를 프론트에서 계산하기 → 서버 값을 보여 주기
- 시연(`/demo`) 코드를 실제 화면에서 import하기 → `02_structure.md` §4
- MSW에만 있는 필드(`has_next`, `allowed_actions`)를 새 화면에 쓰기 → 〔임시〕, 실제 계약 확인 먼저
