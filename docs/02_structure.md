# 02. 폴더 구조와 import 방향

> v0.1 · 2026-10-31 · 초안(팀 확인 중) · 정리 지윤

## 1. 폴더 — 기능이 먼저, 그 안에 역할 [FE 코드]

```
src/
├─ main.jsx            진입점. 개발 + VITE_USE_MOCKS=true 일 때만 MSW 시작
├─ app/                앱 전체를 엮는 곳 — 기능을 알아도 됨
│  ├─ App.jsx, router.jsx      라우트 표 (실제 화면 + 개발 전용 /demo)
│  ├─ queryClient.js           QueryClient, 401·계정 전환 시 업무 캐시 정리
│  ├─ layouts/                 AppLayout (사이드바·헤더·로그인 패널 자리)
│  ├─ routes/ providers/ navigation/   /demo 전용 라우터·Provider·메뉴
│  └─ styles/                  레이아웃 CSS
├─ features/           업무 기능 — 백엔드 기능 폴더와 이름을 맞춤
│  ├─ auth/            로그인·세션        (BE user)
│  ├─ cases/           케이스 목록·상세·메모 (BE cases)
│  ├─ str/             STR 초안·수정·검증   (BE str)
│  ├─ approvals/       승인함·승인·반려     (BE str 승인 API)
│  ├─ alerts/ rules/   경보 점검·탐지 룰    (BE detection, 관리자)
│  ├─ admin/batches/   데이터·배치 운영     (BE source·detection·shared/batch)
│  ├─ overview/ evaluation/ audit/   업무 개요·평가·감사 기록 (지금은 시연만)
│  └─ (기능 안은 똑같이)
│       api/         {기능}Api.js — HTTP 호출 + snake_case ↔ camelCase
│       hooks/       useQuery·useMutation 묶음
│       pages/       라우트 하나 = 페이지 하나
│       components/  그 기능에서만 쓰는 조각
│       styles/      그 기능 CSS
├─ shared/             기능을 모르는 공통 — 아무 데서나 import
│  ├─ api/apiClient.js         axios 인스턴스, 에러 코드 → 문구
│  ├─ ui/                      AsyncState, 버튼·배지·모달 등
│  ├─ styles/                  tokens.css, GlobalStyle.js
│  └─ demo/                    /demo 전용 컨텍스트·라벨
├─ mocks/              MSW와 시연 데이터
│  ├─ handlers.js, browser.js, server.js   개발·테스트용 API 대역
│  └─ dashboard/                           /demo 합성 데이터와 가짜 API
└─ test/               setup.js + 사용자 흐름 테스트
```

- **기능 이름은 백엔드와 맞춰요.** 백엔드 `cases` 담당 API를 쓰는 화면은 `features/cases/`. 그래야 "이 화면이 누구 API를 쓰나"가 바로 보여요. 승인은 백엔드에선 `str`이지만 화면·권한(APPROVER)이 따로라 `features/approvals/`로 나눴어요.
- 폴더는 **필요할 때 만들어요.** 지금 `api/`가 있는 건 `auth`·`cases`뿐이에요. 빈 폴더·빈 파일을 미리 두지 않아요.
- 정적 파일은 `public/`(`mockServiceWorker.js`는 MSW가 만든 파일 — 고치지 않음).

| 헷갈리는 것                      | 여기서는                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| "공통 컴포넌트"인데 한 기능만 씀 | 그 기능의 `components/`. 두 번째 기능이 쓰기 시작하면 `shared/ui/`로 옮겨요                          |
| 페이지 안 로직이 길어짐          | 조회·저장은 `hooks/`, 화면 조각은 `components/`                                                      |
| 응답 모양 바꾸는 함수            | 그 기능 `api/` 안 (페이지에서 하지 않음)                                                             |
| 역할·상태별 버튼 계산            | 그 기능 `hooks/` 또는 순수 함수 파일 〔제안〕 `features/cases/permissions.js`처럼 테스트하기 쉬운 곳 |

## 2. import 방향

```
app  →  features  →  shared
             ↘ mocks (시연 페이지만)
```

| 해도 되는 것                                                                              | 하면 안 되는 것                                          |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `app`이 `features/*/pages`를 라우트에 연결                                                | `shared`가 `features`·`app`을 import                     |
| `features/*`가 `shared/*`를 import                                                        | 페이지·컴포넌트가 `shared/api/apiClient`로 직접 요청     |
| 기능 A의 페이지가 기능 B의 **훅**을 써서 조합 (케이스 상세가 `str` 훅으로 현재 초안 표시) | 기능 A가 기능 B의 `api/`를 직접 import                   |
| `features/auth/hooks/useSession`을 어디서나                                               | 실제 화면이 `mocks/`·`shared/demo/`·`Demo*Page`를 import |

예외 하나: `features/auth/components/AuthPanel`이 `app/queryClient`의 `clearBusinessData`를 써요. 로그인·로그아웃이 캐시 정리와 묶여 있어서예요. 이 밖에 `features → app` import는 만들지 않아요.

자동 검사는 아직 없어요. 〔제안〕 ESLint `no-restricted-imports`로 ① `shared`에서 `features`·`app` import 금지 ② `pages`·`components`에서 `apiClient` import 금지 ③ `Demo` 아닌 파일에서 `mocks/dashboard` import 금지를 걸면 리뷰에서 매번 안 봐도 돼요.

## 3. 라우트 [FE 코드 `router.jsx`]

| 경로                 | 화면                              | 지금                |
| -------------------- | --------------------------------- | ------------------- |
| `/`                  | `/cases`로 이동                   | 있음                |
| `/cases`             | `CaseListPage`                    | 있음 (〔임시〕 API) |
| `/cases/:caseId`     | `CaseDetailPage`                  | 있음 (〔임시〕 API) |
| `/cases/:caseId/str` | `StrPage`                         | 안내 화면만         |
| `*`                  | 페이지 없음 안내                  | 있음                |
| `/demo/*`            | 시연 묶음 (`DashboardDemoRouter`) | 개발 모드만         |

앞으로 붙을 경로(`/login`, `/approvals`, `/admin/*`)는 `06_features/`에 있어요. 경로를 새로 만들면 이 표와 해당 `06_features` 파일을 같이 고쳐요.

## 4. 시연(`/demo`)과 실제 화면의 경계 [FE 코드 `router.jsx`, `mocks/dashboard/`]

`/demo`는 발표·화면 설계용으로 **전체 업무를 합성 데이터로 미리 그려 둔 묶음**이에요. 실제 API·세션·서버 enum과 섞이지 않게 나눠 뒀어요.

- `import.meta.env.DEV`일 때만 `lazy`로 불러와요. 운영 빌드엔 시연 코드·fixture가 들어가지 않아요.
- 시연 파일은 `Demo` 접두어(`DemoCaseListPage.jsx`), 데이터는 `src/mocks/dashboard/`, 상태는 `shared/demo/`.
- **실제 화면을 만들 때 시연 컴포넌트를 import하지 않아요.** 모양이 좋으면 `shared/ui/`로 옮기고 시연·실제가 같이 써요.
- 시연이 보여 주는 동작(예: 일부 409 세부 코드)은 백엔드 〔초안〕 명세 기준이에요. 실제로 구현됐다는 뜻이 아니에요.

## 5. 경계 — 프론트가 하지 않는 것 [예전 「프론트 구조·개발 규칙」, BE 03 §3]

- **Spring Boot API만 불러요.** DB·AI 서버에 직접 붙지 않아요.
- 별도 저장 토큰(JWT 등)을 도입하지 않아요. 세션 쿠키·CSRF.
- 보고서 숫자(금액·건수·날짜)를 다시 계산하지 않아요. 서버 `facts` 값을 보여 줘요.
- 백엔드 상세 응답은 "화면 하나에 요청 하나"가 원칙이에요(케이스 상세에 경보·점수·요약·현재 초안·이력). 거래 목록만 따로 페이징해요. [BE 03 §3] 〔확인 필요: 상세에 현재 초안을 합치는 위치 — FE-5〕
