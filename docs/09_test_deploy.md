# 09. 테스트·CI·배포

> v0.1 · 2026-10-31 · 초안(팀 확인 중) · 정리 지윤

## 1. 로컬과 CI [FE `package.json`, `.github/workflows/ci.yml`]

```bash
npm ci
npm run lint
npm run format:check
npm run test:run
npm run build
```

- JavaScript 프로젝트라 `tsc`·`typecheck` 단계는 없어요.
- GitHub Actions(`Frontend CI`)는 PR과 `develop`·`main` push마다 위 다섯 단계를 Node 22.22.0으로 돌려요. `package.json`·`package-lock.json`이 커밋되기 전에는 검사를 건너뛰고 안내만 남겨요.
- Node는 `.nvmrc`(22.22.0), `engines`는 `>=22.12.0 <23`. 다른 버전이면 `nvm use`.
- 머지를 실제로 막으려면 GitHub 보호 규칙에서 `develop`·`main` 직접 push 금지 · 리뷰 1명 · `check` 통과 필수를 켜야 해요. **아직 설정 안 됨** — 저장소 관리자 작업.

## 2. 테스트 쓰는 법 [FE `src/test/`]

| 파일                     | 다루는 것                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `setup.js`               | jest-dom, MSW 서버(`onUnhandledRequest: "error"`), 테스트마다 핸들러·데이터 초기화, `apiClient`를 fetch 어댑터로 |
| `apiErrors.test.js`      | 에러 코드 → 문구                                                                                                 |
| `cases.test.jsx`         | 인증·캐시 정리·목록·상세·메모 충돌·CSRF·필드 오류·새로고침 확인                                                  |
| `dashboardDemo.test.jsx` | `/demo` 시연 흐름                                                                                                |

- 화면을 `QueryClientProvider` + `MemoryRouter`로 감싸 실제 사용자처럼 클릭·입력해요(`@testing-library/user-event`).
- 응답을 바꾸고 싶으면 그 테스트 안에서 `server.use(http.get(...))`로 덮어써요. 다음 테스트엔 자동으로 원래대로.
- 규칙은 `01_code_rules.md` §8 — 사용자 흐름, `getByRole`, 정상·경계·실패.

## 3. Vercel 〔설정 전〕

1. GitHub 저장소 연결, Framework: Vite.
2. Node 22.x (`.nvmrc`와 맞춤).
3. Build `npm run build`, Output `dist`.
4. Production Branch `main`, Preview는 PR마다.
5. 환경별 `VITE_API_BASE_URL`, `VITE_USE_MOCKS=false`.

- `vercel.json`은 모든 경로를 `index.html`로 보내는 SPA rewrite예요. **API 프록시가 아니에요.** 같은 출처 `/api`를 쓰려면 `/api/**`가 SPA fallback보다 먼저 백엔드로 가는 규칙이 필요해요(FE-9).
- MSW·`/demo`는 `import.meta.env.DEV`로 막혀 있어 production·preview 빌드에서 돌지 않아요. 백엔드가 없으면 배포 화면의 API 조회는 실패하는 게 지금 동작이에요.
- 문제가 생기면 Vercel에서 이전 정상 배포를 운영으로 올리고, 원인을 고치는 PR을 올려요.

### 배포 뒤 확인

- `/cases/CASE-…` 직접 접근·새로고침
- HTTPS API 연결, 쿠키 전달, CSRF (정식 로그인 뒤)
- MSW·`/demo` 비활성, 로딩·빈 결과·조회 실패·저장 충돌 화면

## 4. 실서버 연동 인수 시나리오 〔후속〕

계약이 확정되면 API·MSW·사용자 흐름 테스트를 같이 바꾸고, 아래를 **백엔드 local에서 직접** 확인해요. 자동 테스트 통과와 실서버 연동 완료는 구분해요.

- [ ] snake_case 인증 응답, 로그아웃 204, 세션 만료 뒤 복귀, 이전 사용자 캐시 제거
- [ ] 화면 1페이지 ↔ API `page=0`, 빈 결과, 필터 변경 시 1페이지로
- [ ] `CSRF_INVALID`와 권한 부족 구분, 비담당자 수정 403 `NOT_ASSIGNEE`, 자기 승인 409
- [ ] `CONCURRENT_UPDATE` 입력 보존·비교, 일반 업무 409와 구별 (`inv01`·`inv02` 두 브라우저)
- [ ] 상세 정상 중 거래·요약·초안 각각 따로 실패 + 수동 다시 시도
- [ ] 본문 변경 뒤 재검증, 오래된 검증으로 승인 요청 막힘, 승인 대기 읽기 전용, 승인 뒤 잠금
- [ ] 초안 재생성 뒤 새 초안 선택·이전 초안 이력, 반려 뒤 보완·재검증
- [ ] 적재 202 상태 조회 종료, 점수 200 일부 실패 표시, 성공분 유지·실패분만 재처리
- [ ] AI 응답 유실 시 서버 상태를 먼저 보고 쓰기를 자동으로 다시 보내지 않음
- [ ] 같은 계정 두 번째 로그인 → 첫 세션 401

## 5. 참고

[React Router 설치](https://reactrouter.com/start/declarative/installation) · [MSW 브라우저 구성](https://mswjs.io/docs/integrations/browser) · [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview) · [Vitest](https://vitest.dev/guide/)
