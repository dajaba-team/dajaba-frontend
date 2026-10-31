## 🔗 Jira

> 관련 이슈 키와 링크를 적어주세요. 브랜치 이름에도 같은 키를 써요 (`feat/SCRUM-00`).

- [SCRUM-00](https://dajaba.atlassian.net/browse/SCRUM-00) — 이슈 제목

<br>

## ⭐ Key Changes

> 핵심 변경 사항을 적어주세요.

1.
2.
3.

<br>

## ✅ 확인 방법

> 리뷰어가 직접 돌려볼 수 있도록 적어주세요. (mock/실서버 중 무엇으로, 어떤 계정으로, 화면 경로·클릭 순서, 테스트 이름 등)

- 실행: `VITE_USE_MOCKS=true` / 백엔드 local (`inv01`)
- 화면:
- 스크린샷 (화면이 바뀐 경우):

<br>

## 👪 To Reviewers

>

<br>

## 📎 참조한 문서 · 규칙

> 구현 전 읽은 문서와 따른 절 번호를 적어주세요.
> 예: 프론트 `docs/03_api.md` §3 에러 처리 · 백엔드 `docs/04_auth_user.md` §4 권한 표 · CASES 명세 v0.5 API-06

-

<br>

## 📋 체크리스트

- [ ] **PR 대상이 `develop`이다** (`main`은 develop에서만 올린다)
- [ ] 로컬에서 `npm run lint` · `npm run format:check` · `npm run test:run` · `npm run build` 통과
- [ ] GitHub Actions **CI가 초록불**이다
- [ ] PR은 한 가지 일만 · 목표 ≤400줄 (`package-lock.json`·생성 파일 제외)
- [ ] 테스트 포함 — 사용자 흐름 기준 정상 1 + 경계 1 + 실패 1
- [ ] API 호출은 `features/{기능}/api/`에서만, snake_case → camelCase 변환은 그 경계에서 한 번
- [ ] 서버 데이터는 TanStack Query로만 (Zustand·컴포넌트 상태에 복사하지 않음)
- [ ] 변경 요청은 자동 재시도·낙관적 상태 변경 없음, 실패 시 사용자 입력 보존
- [ ] 에러는 `error.code`로 분기했다 (`shared/api/apiClient.js` 메시지 사용)
- [ ] 버튼 노출은 `role` + 담당자 + `status`로 계산했다 (서버가 다시 검사한다는 전제)
- [ ] (API 계약 변경 시) `src/mocks/handlers.js`·테스트·`docs/03_api.md`를 같이 고쳤다
- [ ] 하드코딩 없음 — 주소는 `VITE_*` 환경변수, 비밀값은 프론트에 두지 않음
- [ ] 계좌번호·본문 같은 민감 값을 `console`·localStorage에 남기지 않았다
- [ ] `TODO`에 안건·미결 번호를 달았다 (`// TODO(FE-3):`)
- [ ] (새 라이브러리 추가 시) 3줄 사유 — 유지보수 · 무게 · 라이선스
