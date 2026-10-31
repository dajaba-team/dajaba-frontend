# cases — 케이스 목록·상세·조사

> v0.1 · 2026-10-31 · 초안(팀 확인 중) · 정리 지윤

- 프론트 폴더: `src/features/cases/` · 백엔드 짝: `cases` (BE `06_features/cases.md`, CASES 명세 v0.5 〔초안〕)
- 지금: 목록·상세·메모가 〔임시〕 `/api/cases` + MSW로 동작. 배정·에스컬레이션·종료·거래·요약은 아직.

## 1. 화면

| 경로                             | 보이는 것                                                                                               | 지금                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `/cases?status=REVIEWING&page=1` | 케이스 번호, 마스킹 계좌, 상태, 유효 점수·위험 등급, 담당자. 상태(복수)·내 담당·기간 필터, 정렬, 페이지 | 상태 필터·페이지 URL만         |
| `/cases/:caseNo`                 | 경보·룰·시간창, 점수·설명·근거, AI 요약, 담당자, 메모·이력, 현재 초안 요약, 상태별 버튼                 | 근거 문자열·메모·이력·STR 링크 |
| `/cases/:caseNo` 안 근거 거래    | `scope=EVIDENCE`(경보 안) / `CONTEXT`(경보 밖 참고) 탭, 별도 페이징                                     | 없음                           |

- 서버가 준 필드만 표시해요. 등급·HIGH 기준을 프론트에서 계산하지 않아요(`CasePolicy`가 서버에서 정함).
- `evidence`와 `context`는 섞지 않아요. 참고 거래 상대방을 혐의자처럼 보이게 하지 않아요(안건 7).
- 화면 집계 숫자(유입·유출)와 STR facts 숫자는 포함 범위가 달라 다를 수 있어요 — 라벨에 무엇을 셌는지 적어요 〔확인 필요: BE 미결 22〕.

## 2. 상태별 버튼 [BE flows 06, BE 04 §4]

| 상태                          | 담당 조사역                                      | 다른 조사역 | 승인자   | 관리자      |
| ----------------------------- | ------------------------------------------------ | ----------- | -------- | ----------- |
| `OPEN`                        | 내게 배정 (미배정일 때)                          | 내게 배정   | 보기     | 담당자 지정 |
| `REVIEWING`                   | 메모 · 에스컬레이션 · 종료(사유) · 요약 새로고침 | 보기        | 보기     | 담당자 교체 |
| `ESCALATED`                   | 초안 생성 · 종료(사유)                           | 보기        | 보기     | 보기        |
| `DRAFTED`                     | → STR 화면 (`str.md`) · 초안 있는 종료(사유)     | 보기        | 보기     | 보기        |
| `PENDING_APPROVAL`            | 읽기 전용                                        | 보기        | → 승인함 | 보기        |
| `REJECTED` + `NEED_REVISION`  | → STR 화면에서 보완                              | 보기        | 보기     | 보기        |
| `REJECTED` + `NOT_REPORTABLE` | 초안 있는 종료(사유)                             | 보기        | 보기     | 보기        |
| `APPROVED` · `CLOSED`         | 이력만                                           | 이력만      | 이력만   | 이력만      |

- 종료·에스컬레이션은 **사유 입력 + 확인 단계**. 성공 응답 뒤에 상태·이력을 바꿔요. 요청 중엔 같은 버튼 막기.
- 〔확인 필요: 메모·요약을 편집할 수 있는 상태 범위 — REVIEWING만인지 ESCALATED·DRAFTED까지인지 (BE cases 확인 필요)〕

## 3. API 〔초안 — CASES 명세 v0.5, BE `06_features/cases.md`〕

| ID    | API                                                         | 화면                                                     | 프론트                                                                     |
| ----- | ----------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| 01    | `GET /cases` (status 복수·`assignee=me`·from/to·정렬)       | 목록                                                     | 〔임시〕 `GET /api/cases`                                                  |
| 02    | `GET /cases/{case_no}` 통합 상세 (+ `available_actions`)    | 상세                                                     | 〔임시〕 `GET /api/cases/:id`                                              |
| 03    | `POST /cases/{case_no}/assign`                              | 내게 배정 / 담당자 지정                                  | 없음                                                                       |
| 04    | `POST /cases/{case_no}/reassign`                            | 담당자 교체(ADMIN)                                       | 없음 〔확인 필요: 본문 `{assignee_id}` vs `{assignee, comment, version}`〕 |
| 05    | `PUT /cases/{case_no}/notes`                                | 메모 (NOTE 행 추가, 같은 내용 no-op, 빈 문자열 = 비우기) | 〔임시〕 `PUT /api/cases/:id/memo`                                         |
| 06    | `POST /cases/{case_no}/close`                               | 종료 (초안 없을 때)                                      | 없음                                                                       |
| 07    | `POST /cases/{case_no}/escalate` (사유 필수)                | 에스컬레이션                                             | 없음                                                                       |
| 08    | `GET /cases/{case_no}/transactions?scope=EVIDENCE\|CONTEXT` | 근거 거래                                                | 없음                                                                       |
| 09    | `GET /cases/{case_no}/evidence/{transaction_id}`            | 거래 원본                                                | 없음                                                                       |
| 10    | `GET /cases/{case_no}/graph`                                | 그래프 (후속)                                            | 없음                                                                       |
| 11    | `GET /cases/{case_no}/histories`                            | 이력                                                     | 〔임시〕 상세 안 `history`                                                 |
| 12·13 | `POST …/refresh-summary`, `GET …/summary`                   | AI 요약                                                  | 없음                                                                       |
| 15    | `GET /cases/{case_no}/note-histories`                       | 메모 이력                                                | 없음                                                                       |

초안 있는 종료 `POST /cases/{case_no}/close-with-draft`는 str 컨트롤러예요(→ `str.md`). 모든 변경 요청에 `version`.

Query key 〔제안〕: `["cases", filters]`, `["case", caseNo]`, `["case", caseNo, "transactions", scope, page, size]`, `["case", caseNo, "summary"]`, `["case", caseNo, "histories"]`.

## 4. 조회·저장 흐름 [예전 「백엔드 기반 설계 보완」 §4, BE flows 02]

1. 목록은 URL에 상태·정렬·페이지. 화면 1페이지 = API `page=0`. 필터가 바뀌면 1페이지로.
2. 상세 성공 뒤 근거 거래를 따로 조회(페이징). 현재 초안은 상세 응답에 합쳐 오는 게 기본안 〔확인 필요: FE-5〕 — **초안이 없는 정상 상태와 초안 조회 실패를 구분**해요.
3. AI 요약은 없거나 사용자가 새로고침을 누를 때 별도 요청(최대 90초, `03_api.md` §4). 요약 실패가 거래 열람·배정·메모를 막지 않아요. 요약이 지금 입력 기준인지(`is_current`)는 서버 값을 보여 줘요.
4. 쓰기 성공 뒤 응답이 상세면 캐시 교체, 아니면 상세 재조회 + 목록·이력 무효화.

## 5. 메모 — 동시 수정 [FE 코드 `CaseMemoEditor.jsx`]

지금 들어 있는 동작이에요. 실제 API로 바꿔도 유지해요.

- 메모 입력은 background refetch·409로 **덮어쓰지 않아요.** 쓰기 시작한 기준 `version`을 같이 들고 있어요.
- `CONCURRENT_UPDATE`(지금은 〔임시〕 `CASE_VERSION_CONFLICT`)면 입력 유지 → 최신 내용을 따로 불러와 나란히 비교 → 사용자가 고른 뒤 **새 버전으로 명시적 재저장**.
- 다른 409(`INVALID_CASE_TRANSITION` 등)엔 충돌 비교 화면을 띄우지 않고 코드별 안내 + 재조회.
- 400 `INVALID_REQUEST`의 필드 오류를 입력칸에. 메모는 최대 10,000자(BE 01 §7).
- 미저장 메모가 있으면 새로고침·탭 닫기 때 확인(`beforeunload`). **앱 안 경로 이동 확인은 아직** 〔후속〕.
- 저장 응답이 늦게 왔는데 그사이 계정이 바뀌었으면 캐시에 반영하지 않아요(`context.session` 비교).

## 6. 테스트에 있어야 하는 것

있음: 목록 → 상세 → 메모 저장 → STR 이동, 충돌 시 입력 보존·비교·재저장, 읽기 전용, 빈 필터 결과, 조회 실패 후 재시도, CSRF 오류 분리, 필드 오류, 새로고침 확인 (`src/test/cases.test.jsx`).
실제 API로 바꿀 때 추가: 1페이지 ↔ `page=0`, 비담당자 버튼 숨김 + 직접 호출 403 `NOT_ASSIGNEE`, 종료·에스컬레이션 사유 필수, 요약만 실패해도 상세는 정상.
