# admin — 배치·경보 점검·룰·계정·로그

> v0.1 · 2026-10-31 · 초안(팀 확인 중) · 정리 지윤

- 프론트 폴더: `src/features/admin/batches/`, `src/features/alerts/`, `src/features/rules/` (+ 계정은 만들 때 `features/admin/users/`)
- 백엔드 짝: `source`·`detection` (BE `06_features/source_detection.md`, SD 명세 〔초안〕), `shared/batch`, `user` (BE 04 §7)
- 지금: 시연(`/demo/admin/*`, ADMIN 역할)만. 실제 화면 없음.
- **ADMIN만** 메뉴가 보여요. URL로 들어와도 서버가 403.

## 1. 데이터·배치 운영 — `/admin/batches` [BE flows 01, 안건 14·21]

순서: **적재 → 룰 스캔 → 점수 → 케이스 생성**. 앞 단계 결과를 보고 다음 버튼을 안내하지만, 브라우저 버튼 잠금만으로 동시 실행을 막는다고 보지 않아요(서버 409).

| 배치        | API 〔초안〕                           | 응답                               | 화면                                                                                                                   |
| ----------- | -------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 적재        | `POST /admin/batches/load`             | **202 + `batch_run_id`**           | `GET /admin/batches/{batch_run_id}` 폴링. `RUNNING`이 끝나거나 조회 실패·화면 이탈이면 멈춤. 간격·최대 시간은 계약으로 |
| 룰 스캔     | `POST /admin/batches/rule-scan?date=`  | 동기                               | 결과 건수                                                                                                              |
| 점수        | `POST /admin/batches/score?date=`      | 동기, **200이어도 일부 실패 가능** | `scored`와 `failed`를 같이. 실패는 0점·LOW가 아님. 다시 누르면 남은(실패) 대상만 재처리                                |
| 케이스 생성 | `POST /admin/batches/open-cases?date=` | 동기                               | 생성 건수. 점수 재처리 뒤 새 HIGH가 생기면 다시 실행 가능                                                              |

- 재실행: 적재·룰 스캔은 성공 뒤 금지(409 `BATCH_ALREADY_DONE`), 점수·케이스 생성은 남은 대상 재처리 허용. 실행 중이면 409 `BATCH_RUNNING`.
- 서버 enum만 써요 — 유형 `LOAD_DATASET · RULE_SCAN · SCORE_REQUEST · OPEN_CASES`, 상태 `RUNNING · SUCCEEDED · FAILED` [BE 코드]. 예전 문서의 `PARTIAL`·`SCORE_RETRY`·`LOAD`·`SCORE`를 하드코딩하지 않아요 〔확인 필요: 부분 실패 상태 — BE 미결 4〕.
- 점수 500건은 **AI 요청 묶음 크기**예요. 화면 페이지 크기나 진행률 분모로 쓰지 않아요.
- 위험 등급·HIGH 기준을 프론트에서 계산하지 않아요.

## 2. 경보 점검 — `/admin/alerts` 〔초안 — SD 명세〕

`GET /admin/alerts`, `GET /admin/alerts/{alert_no}`, `GET /admin/alerts/{alert_no}/transactions`(열람 기록). 점수 계산 실패 경보(`FAILED`)를 따로 볼 수 있어야 해요 — 사라지면 안 돼요(안건 4).

## 3. 탐지 룰 — `/admin/rules` 〔초안 — SD 명세〕

`GET /admin/rules`, `PUT /admin/rules/{rule_id}/params`. 저장하면 새 버전 행이 생겨요. 같은 버전 동시 저장은 409 → 재조회. 기준값 기본값을 프론트에서 채우지 않아요.

## 4. 계정 — `/admin/users` [BE 04 §7]

| 기능              | API                                                                  | 화면                                                  |
| ----------------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| 목록              | `GET /admin/users` (`role`, `is_active` 필터)                        | 비활성 포함                                           |
| 발급              | `POST /admin/users {login_id, display_name, role, initial_password}` | 역할은 3개 중 하나(SYSTEM 없음). 응답에 비밀번호 없음 |
| 역할 변경         | `POST /admin/users/{id}/change-role {role}`                          | 그 사람 세션이 끊긴다고 안내                          |
| 비활성화·재활성화 | `POST /admin/users/{id}/deactivate` · `/activate`                    | 담당 케이스 개수가 오면 표시                          |
| 비밀번호 초기화   | `POST /admin/users/{id}/reset-password {new_password}`               |                                                       |

- 동사 이름은 프론트 API 계약서(SCRUM-21)에서 확정. PATCH 없음.
- 삭제 버튼 없음. 자기 자신의 역할 변경·비활성화 버튼 없음.
- 비밀번호 입력값은 상태에 오래 두지 않고 보낸 뒤 비워요.

## 5. 로그 — `/admin/access-logs`, `/admin/ai-calls` 〔후속〕

접근 로그·AI 호출 로그 조회(ADMIN). AI 호출 로그엔 메타데이터만 있어요(본문 없음).

## 6. 테스트에 있어야 하는 것

적재 202 → 폴링 종료, 점수 200 일부 실패 표시 + 성공분 유지 + 다시 누르면 실패분만, `BATCH_RUNNING`·`BATCH_ALREADY_DONE` 안내, 비 ADMIN 메뉴 숨김 + 직접 접근 403, 역할 변경 뒤 세션 끊김 안내.
