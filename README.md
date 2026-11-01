# dajaba — AML 의심거래 탐지 + STR 초안 (프론트엔드)

조사역이 우선순위대로 올라온 의심거래 케이스를 조사하고, AI가 쓴 STR(의심거래보고서) 초안을 고치고 검증해 승인자에게 넘기는 내부 업무 화면.
React 19 / JavaScript(`.js`·`.jsx`, TypeScript 없음) / Vite / TanStack Query / React Router / MSW.

설계 정본은 팀 노션과 백엔드 리포([`dajaba-backend`](https://github.com/dajaba-team/dajaba-backend) `docs/`)예요. 프론트 규칙·구조·화면별 정리와 리뷰 체크리스트는 [`docs/README.md`](docs/README.md)에 모았어요.

## 처음 받았을 때 (5분)

```bash
git clone <repo> && cd dajaba-frontend
# 1. Node 22.22.0 (.nvmrc)
nvm install && nvm use
# 2. 설치 — package-lock.json 그대로
npm ci
# 3. 환경변수
cp .env.example .env.local
# 4. 기동
npm run dev            # http://localhost:5173
```

개발 모드에서 `http://localhost:5173`을 열면 먼저 **백엔드 연동 확인 화면(`/dev/connection`)**으로 가요. 조사 케이스는 `/cases`, 시연은 `/demo`로 들어가요.

**백엔드 없이 보기** — `.env.local`에서 `VITE_USE_MOCKS=true`로 바꾸고 개발 서버를 다시 켜요. MSW가 API를 대신 받아요. 화면 위 계정 선택에서 `inv01` → 테스트 로그인 → 목록 → 상세 → 메모 저장 → STR 화면까지 돌아가면 준비 끝. 새로고침하면 예시 데이터는 처음으로 돌아가요.

**백엔드와 같이 보기** — 백엔드를 local 프로파일로 띄우고(`docker compose up --build`, 백엔드 README 참고) `VITE_USE_MOCKS=false`. 개발 서버가 `/api` 요청을 `http://localhost:8080`으로 넘겨서(`vite.config.js` 프록시) 세션·CSRF 쿠키를 같은 출처로 써요. 한 번에 확인하려면 **`http://localhost:5173/dev/connection`**(개발 모드 전용)에서 [전체 확인] → [테스트 로그인] → [로그아웃]을 눌러요. 서버 상태 · API 문서(swagger와 같은 `/v3/api-docs`) · 세션 · CSRF가 전부 "통과"면 연동 준비 끝.

**전체 시연 화면** — 개발 모드에서만 `/demo`(업무 개요·배치·경보·룰·케이스·STR·승인·평가·감사)가 열려요. 합성 데이터만 쓰고 운영 빌드에는 들어가지 않아요.

### .env 변수

| 변수                | 쓰는 곳                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | API 주소. 개발은 `/`(Vite 프록시). 비우면 같은 출처(개발은 Vite 프록시) |
| `VITE_USE_MOCKS`    | `true`면 개발 모드에서 MSW 사용. 운영·preview 빌드에서는 무시           |

`VITE_` 값은 **빌드 결과에 그대로 들어가 누구나 볼 수 있어요.** 비밀값을 넣지 않아요. `.env.local`은 커밋되지 않아요.

## 명령

| 명령                              | 역할                          |
| --------------------------------- | ----------------------------- |
| `npm run dev`                     | 개발 서버 (5173)              |
| `npm run lint`                    | ESLint (경고도 실패)          |
| `npm run format` / `format:check` | Prettier 정리 / 검사          |
| `npm test` / `test:run`           | Vitest 감시 모드 / 한 번 실행 |
| `npm run build` / `preview`       | `dist` 생성 / 빌드 결과 확인  |

CI(`.github/workflows/ci.yml`)는 lint → format:check → test:run → build를 돌려요. PR 전에 넷 다 로컬에서 통과시켜요.

## 지금 들어 있는 것 (W1 뼈대, 10/31)

| 묶음      | 파일                                                                                               | 상태                                                                              |
| --------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 앱 뼈대   | `src/app/` — 라우터, `QueryClient`(401·계정 전환 시 업무 캐시 제거), `AppLayout`                   | 진짜                                                                              |
| 공통 API  | `src/shared/api/apiClient.js` — axios, 쿠키·CSRF, 에러 코드 → 안내 문구                            | 진짜. AI 전용 timeout(90초+)은 아직                                               |
| 인증      | `src/features/auth/` — `GET /auth/me`, local 테스트 로그인, 로그아웃                               | **실제 백엔드 API**. 정식 로그인 화면은 백엔드 W2 이후                            |
| 케이스    | `src/features/cases/` — 목록(상태 필터·페이지 URL), 상세, 메모 저장, 버전 충돌 시 입력 보존·비교   | **임시 계약** `/api/cases` + MSW. 실제 `/api/v1/cases`는 백엔드 cases API 머지 후 |
| STR       | `src/features/str/pages/StrPage.jsx`                                                               | 경로와 안내 화면만                                                                |
| 시연      | `/demo/*` — `src/mocks/dashboard/`, 각 기능의 `Demo*Page.jsx`                                      | 개발 전용, 합성 데이터                                                            |
| 연동 확인 | `/dev/connection` — `src/features/connection/` (health · api-docs · me · 테스트 로그인 · 로그아웃) | 개발 전용, 실제 백엔드 또는 MSW                                                   |
| 목업      | `src/mocks/handlers.js`(MSW)                                                                       | 인증은 백엔드와 같은 모양, 케이스는 임시                                          |
| 테스트    | `src/test/` — 사용자 흐름 25개 (인증·캐시 정리·목록·상세·메모 충돌·CSRF·시연)                      | Vitest + Testing Library + MSW                                                    |
| 배포      | `vercel.json`(SPA rewrite)                                                                         | Vercel 연결·보호 규칙은 아직                                                      |

### 목업인 범위

인증은 **백엔드의 진짜 모양**(`/api/v1/auth/*`, snake_case, 세션·CSRF)에 맞췄어요. 백엔드의 `mock-login`이 비밀번호를 안 볼 뿐이에요.
케이스 API(`/api/cases`, `has_next`, `CASE_VERSION_CONFLICT`)는 **화면을 먼저 만들려고 정한 임시 계약**이에요. 백엔드 cases API가 머지되면 `casesApi.js` · `handlers.js` · 테스트를 한 PR에서 바꿔요. 차이는 [`docs/03_api.md`](docs/03_api.md) §5.

## 규칙 세 줄

1. **API는 `features/{기능}/api/`에서만 부르고, snake_case는 그 경계에서 한 번 바꾼다.** 컴포넌트는 `apiClient`를 직접 모른다.
2. **서버 데이터는 TanStack Query에만.** Zustand·컴포넌트 상태에 복사하지 않는다. 쓰기는 자동 재시도·낙관적 상태 변경 없이, 성공 응답 뒤에 캐시를 고친다.
3. **버튼은 `role` + 담당자 + `status`로 숨기지만, 판단은 서버가 한다.** 에러는 `error.code`로 분기하고 실패해도 사용자 입력은 지우지 않는다.

자세한 건 [`docs/01_code_rules.md`](docs/01_code_rules.md) → [`docs/02_structure.md`](docs/02_structure.md).

## 팀 작업

`feat/SCRUM-xx` 브랜치 → `develop`으로 PR(템플릿 채우기) → CI 초록불 + 1명 Approve → 머지. `main`은 develop에서만 올려요. 커밋은 `Gitmoji type: 내용`(`✨ feat: 케이스 에스컬레이션 버튼`). `package-lock.json`을 같이 커밋하고 설치는 `npm ci`.

## 다음

- 백엔드 cases API 머지 → 임시 `/api/cases`를 `/api/v1/cases`로 교체 (`page` 0 기반, `{items, page, size, total}`, `CONCURRENT_UPDATE`)
- 정식 로그인 화면 (`POST /api/v1/auth/login`, 백엔드 W2)
- 케이스 상세: 배정 · 에스컬레이션 · 종료 · 근거 거래 · AI 요약
- STR 편집 · 검증 · 승인 요청 → 승인함 · 반려 → 관리자 배치·계정
- 순서와 미결 계약은 [`docs/08_decisions.md`](docs/08_decisions.md)
