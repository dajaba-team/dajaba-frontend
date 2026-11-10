# 03. API 연동

> v0.2 · 2026-11-08 · 초안(팀 확인 중) · 정리 지윤 · 11/8 초안 있는 종료(SCRUM-112)

백엔드 API를 화면에 붙일 때 보는 문서예요. 백엔드 쪽 규칙은 [BE 03 §2·§3]이 정본이고, 여기는 **프론트가 그걸 어떻게 받는지**를 적어요.

## 1. 경계 — API 모듈이 하는 일 [FE 코드 `authApi.js`, BE `application.yml`]

```
페이지/컴포넌트 ── 훅(useQuery·useMutation) ── features/{기능}/api/{기능}Api.js ── shared/api/apiClient ── /api/v1/...
      camelCase만 봄                                  ↑ 여기서 한 번 변환
```

- 백엔드 JSON은 전역 **snake_case**예요(Jackson 설정, DTO에 `@JsonProperty` 없음). API 모듈이 받자마자 camelCase로 바꿔 넘겨요. 예: `authApi.me()` → `{ id, loginId, displayName, role }`.
- 요청 body·쿼리도 API 모듈에서 snake_case로 바꿔 보내요(`{ caseVersion }` → `{ case_version }`).
- **화면 페이지는 1부터, API `page`는 0부터.** 변환은 API 모듈에서. 필터가 바뀌면 화면 1페이지로 돌아가요.
- 값이 없으면 백엔드는 필드를 빼지 않고 `null`, 빈 목록은 `[]`을 줘요. 프론트는 `undefined`와 `null`을 같은 "없음"으로 다뤄요.
- `signal`을 받아 axios에 넘겨요. 계정 전환·화면 이탈 때 TanStack Query가 취소할 수 있게.

## 2. 공통 모양 [BE 코드 `PageResponse`·`ErrorResponse`, BE 03 §3]

**목록** — `{ "items": [...], "page": 0, "size": 20, "total": 143 }`

- 전체 페이지 수는 **`Math.ceil(total / size)`**. `total_pages`·`total_items`·`has_next`는 없어요(SCRUM-39, 10/29).
- `size` 기본 20, 최대 100(넘으면 400). 정렬 `sort=created_at,desc` — 허용 컬럼은 API마다 정해져 있어요.
- 필터는 쿼리 파라미터 — `status=OPEN,REVIEWING&assignee=me&from=…&to=…`.

**에러** — `{ "error": { "code": "INVALID_CASE_TRANSITION", "message": "…", "details": { … } } }`

- `details`가 없으면 `{}`. 400 `INVALID_REQUEST`면 `details`에 필드별 오류가 와요 → 그 입력칸 옆에 표시.
- 응답 헤더 `X-Request-Id`는 지원 문의용. 다른 출처에서 읽으려면 CORS expose 설정이 필요해요 〔확인 필요: FE-9〕.

**경로** — `/api/v1/{리소스 복수}/{사람이 보는 번호}/{동사}`. 상태 변경은 항상 `POST …/{동사}`, PATCH로 `status`를 바꾸는 API는 없어요. 번호는 `CASE-2022-000057`·`DRF-…` 같은 문자열이라 **`encodeURIComponent`** 해서 넣어요. 예외: 배치 `batch_run_id`, 거래 `transaction_id`는 숫자.

**동시 수정** — 변경 요청에 화면이 읽은 `version`(STR 쪽은 `case_version`도)을 보내요. 다르면 409 `CONCURRENT_UPDATE`.

**시각** [BE 미결 27, 10/30] — 시스템 시각(`created_at` 등)은 UTC에 `Z`를 붙여 초 단위까지(`2026-10-30T05:12:00Z`) 와요. 원천 거래 시각(`ts`)은 시간대 없는 문자열(`2022-09-01T00:20:00`) 그대로예요. 화면은 **`Z`가 붙은 값만 로컬 시각으로 바꿔** 보여 주고, 데이터 시각(`ts`·`transaction_ts`·`window_*`·`reference_ts`)은 받은 문자열 그대로 표시해요(시간대를 붙이거나 변환하지 않음). 표시는 `shared/format/time.js`의 `formatSystemTime`·`formatDataTime`만 써요 — 데이터 시각을 `new Date()`로 해석하면 브라우저 시간대가 붙어서 안 돼요. [SCRUM-21]

**금액** — 숫자 + `currency` 쌍. 서로 다른 통화를 더하지 않아요(환산 없음). 표시는 `Intl.NumberFormat`, 계산은 하지 않아요. 통화 코드는 원천 값 그대로이고, 별칭은 인터페이스 규약 1.6 통화 기준표를 따라요(임의로 ISO 코드로 바꾸지 않음) [BE 미결 7].

## 3. 에러 코드 → 화면 처리 [BE 03 §2, BE 04 §5, FE 코드 `apiClient.js`]

| HTTP | `code`                                                                                  | 화면에서                                                                                                                 | 지금 코드               |
| ---- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| 400  | `INVALID_REQUEST`                                                                       | `details` 필드 오류를 해당 입력칸에. 입력 유지                                                                           | 메모에서 처리           |
| 401  | `UNAUTHENTICATED`                                                                       | 업무 캐시 정리 → 로그인 안내, **지금 URL 기억**. 실패한 쓰기를 다시 보내지 않음                                          | 처리 (`queryClient.js`) |
| 401  | `LOGIN_FAILED`                                                                          | "아이디 또는 비밀번호가 맞지 않아요." 한 가지 문구. 세션 끊김 안내와 구분                                                | 처리 (`apiClient`)      |
| 403  | `FORBIDDEN`                                                                             | 화면 유지, 그 동작 자리(확인창·칸)에 "실행 권한이 없어요" — 서버 문구보다 먼저 (SCRUM-200)                               | 처리                    |
| 403  | `CSRF_INVALID`                                                                          | 입력 유지, "현재 사용자를 다시 확인한 뒤 시도" — 권한 부족과 다른 문구. 자동 반복 없음                                   | 처리                    |
| 403  | `NOT_ASSIGNEE`                                                                          | "담당자만 할 수 있어요" + 상세 재조회                                                                                    | 처리                    |
| 404  | `CASE_NOT_FOUND`, `DRAFT_NOT_FOUND` …                                                   | 대상 없음 안내 + 목록으로                                                                                                | 처리 (404 공통)         |
| 404  | `NOT_FOUND`                                                                             | 주소 자체가 없음(아직 서버에 없는 API, 백엔드 #67). "아직 서버에 없는 기능이에요" + 입력 유지                            | 처리 (`apiClient`)      |
| 409  | `CONCURRENT_UPDATE`                                                                     | **입력·기준 버전 유지**, 최신 내용을 따로 불러 비교, 사용자가 고른 뒤 새 버전으로 명시적 재저장                          | 처리                    |
| 409  | `INVALID_CASE_TRANSITION`                                                               | "현재 상태에서 할 수 없어요" + 상세 재조회, 그 동작이 빠지면 열린 폼 닫기                                                | 처리                    |
| 409  | `INVALID_ASSIGNEE` (·404 `USER_NOT_FOUND`)                                              | 담당자 입력칸 아래(`aria-invalid`·`aria-describedby`), 입력 유지. 담당자 변경 확인창은 그 안에 안내 + 조사역 목록 재조회 | 처리 (SCRUM-200)        |
| 409  | `SELF_APPROVAL`                                                                         | "본인이 담당한 케이스는 승인할 수 없어요"                                                                                | 문구만                  |
| 409  | `NARRATIVE_UNCHANGED`                                                                   | "반려된 본문을 고친 뒤 다시 요청해 주세요" (재조회 없이 편집 유지)                                                       | 문구만                  |
| 409  | `DRAFT_IN_PROGRESS`                                                                     | "초안을 만드는 중이에요" — AI 장애(502)와 다른 안내. 자동 재시도 없음                                                    | 문구만                  |
| 409  | `DRAFT_NOT_VERIFIED`, `DRAFT_LOCKED`, `DRAFT_SUPERSEDED`, `VERIFY_IN_PROGRESS` 〔초안〕 | 코드별 안내 + 초안 재조회                                                                                                | 아직                    |
| 409  | `BATCH_RUNNING`, `BATCH_ALREADY_DONE`                                                   | 배치 화면 안내 + 상태 재조회                                                                                             | 아직                    |
| 409  | 그 밖                                                                                   | 일반 업무 안내 + 재조회. **`CONCURRENT_UPDATE` 충돌 화면을 띄우지 않음**                                                 | 처리                    |
| 502  | `AI_UNAVAILABLE`, `AI_TIMEOUT`, `AI_BAD_RESPONSE`, `LLM_*`, `MODEL_UNAVAILABLE` …       | 그 영역(요약·초안·검증)에만 실패 안내 + 수동 다시 시도. 나머지 화면은 계속 씀                                            | 문구만 (502 공통)       |

케이스 목록·상세는 위 코드를 MSW로 한 번씩 띄워 점검했어요(`src/test/caseErrors.test.jsx`, SCRUM-200). 오류는 그 동작의 확인창·폼·칸 안에만 보이고 다른 칸·버튼은 막지 않아요.

표에 코드별 문구가 없는 응답은 서버가 준 `error.message`를 먼저 보여 주고, 없을 때만 상태별 기본 문구(403 "실행 권한이 없어요" 등)를 써요.
| 500 | `INTERNAL_ERROR` | 일반 실패 안내 | 처리 |
| (응답 없음) | timeout·네트워크 | "성공했는지 모름" — **쓰기였다면 최신 상태를 먼저 조회**하고 다시 할지 판단 | 처리 |

- 코드 목록 전체와 확정 여부는 BE 03 §2 표. 새 코드를 처리하면 `getErrorMessage`와 이 표에 같이 추가해요.
- 옛 MSW 이름 `INVALID_TRANSITION`·`CASE_VERSION_CONFLICT`와 최상위 `code` 호환은 실제 cases API로 바꾸면서 지웠어요(FE-1, SCRUM-103).
- 403은 "토스트 + 화면 유지", 409는 "메시지 + 재조회"가 기본이에요(BE flows 05). 위 표가 그 위에 코드별로 덧붙인 것.

## 4. 긴 AI 요청 [BE 08 10/29, 안건 17·21·23]

요약 갱신·초안 생성·검증은 백엔드가 AI를 부르고 기다려요. **백엔드 쪽 한도가 재시도 포함 전체 90초**예요.

- 지금 `apiClient` timeout은 15초라 AI 요청엔 짧아요. AI 요청은 **전용 설정**(90초 + 여유)으로 따로 보내요 〔확인 필요: 프록시·Vercel 한도 포함 최종 값 — FE-8〕.
- 요청 중엔 진행 안내 + **같은 버튼 다시 누르기 막기**. 자동 재시도·폴링 없음.
- 화면을 떠나도 서버 작업은 계속될 수 있어요. "취소됐다"고 표시하지 않아요.
- 응답이 없거나 timeout이면 **최신 초안·검증·상태를 먼저 조회**하고 나서 다시 할지 정해요(같은 초안이 두 번 생길 수 있음 — BE 미결 21).
- 생성과 검증은 버튼이 따로예요. 생성 직후 자동 검증하지 않아요(안건 17).
- 적재 배치만 `202 + batch_run_id` 비동기 → 상태 조회 폴링. 간격·최대 시간은 API 계약으로 정해요. 룰 스캔·점수·케이스 생성은 동기라 폴링을 가정하지 않아요.

## 5. 지금 연결된 API

### 실제 백엔드와 같은 것 [BE 코드 `AuthController`·`JsonLoginFilter`(BE PR #20, SCRUM-19), BE 04 §3]

| 동작        | API                                                     | 응답                                                                                               | 프론트                        |
| ----------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------- |
| 현재 사용자 | `GET /api/v1/auth/me`                                   | `{ id, login_id, display_name, role }`, 비로그인 401                                               | `authApi.me` — 401이면 `null` |
| 로그인      | `POST /api/v1/auth/login` `{login_id, password}` (JSON) | 200 `{ id, login_id, display_name, role }`, 틀리면 401 `LOGIN_FAILED`, 빈 값 400 `INVALID_REQUEST` | `authApi.login`               |
| 로그아웃    | `POST /api/v1/auth/logout`                              | 204 (본문 없음)                                                                                    | `authApi.logout`              |

### 케이스 — 실제 백엔드와 같은 것 [계약서 v0.2 C1·C2·C7·A1·A3·A4·A5·A6·A7, BE `CaseController`(SCRUM-106·175), FE 코드 `casesApi.js`·`mocks/cases.js`, SCRUM-103·112·175]

| 동작           | API                                                                                           | 응답                                                                                                                                                                                                                   | 프론트                                 |
| -------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 목록           | `GET /api/v1/cases?status=A,B&assignee=me\|login_id&from=&to=&sort=&page=(0부터)&size=`       | `{ items, page, size, total }` — 화면에는 page 1부터. 줄마다 `available_actions`(목록 버튼도 이것만). 필터·정렬·페이지는 주소 query에 두고 상세 링크 state로 돌아와요(SCRUM-181). 시작일 > 종료일이면 부르지 않고 안내 | `casesApi.list`                        |
| 상세           | `GET /api/v1/cases/{case_no}`                                                                 | C2 모양 + `available_actions`, 없으면 404 `CASE_NOT_FOUND`                                                                                                                                                             | `casesApi.detail`                      |
| 배정           | `POST …/assign` `{version}` · 관리자 `{assignee, version}`                                    | 공통 변경 응답 M → 상세·목록 다시 조회                                                                                                                                                                                 | `casesApi.assign`                      |
| 담당자 변경    | `POST …/reassign` `{assignee, comment?, version}` (ADMIN만, BE SCRUM-177)                     | M. 같은 담당자면 그대로, 비활성·조사역 아님 409 `INVALID_ASSIGNEE` → 확인창이 조사역 목록(`GET /admin/users?role=INVESTIGATOR&is_active=true`)을 다시 불러요                                                           | `casesApi.reassign` · `ReassignDialog` |
| 에스컬레이션   | `POST …/escalate` `{comment, version}`                                                        | M                                                                                                                                                                                                                      | `casesApi.escalate`                    |
| 종료(초안 X)   | `POST …/close` `{close_reason, comment, version}`                                             | M. 초안이 있으면 409 `CLOSE_REQUIRES_STR`                                                                                                                                                                              | `casesApi.close`                       |
| 종료(초안 O)   | `POST …/close-with-draft` `{close_reason, comment, version}` — **BE 아직 없음**(str 컨트롤러) | M (MSW만). 서버가 초안을 `SUPERSEDED`로 바꿈 〔초안〕                                                                                                                                                                  | `casesApi.closeWithDraft`              |
| 메모           | `PUT …/notes` `{investigator_notes, version}` (BE SCRUM-176)                                  | M. 같은 내용이면 version 그대로, `""`는 비우기                                                                                                                                                                         | `casesApi.saveNotes`                   |
| 메모 이력      | `GET …/note-histories?page&size` (C8, BE SCRUM-176)                                           | `{items:[{before_text, after_text, case_version_before, created_by, created_at}], page, size, total}`, 최신 먼저                                                                                                       | `casesApi.noteHistories`               |
| 근거 거래      | `GET …/transactions?scope&page&size` (C3, BE SCRUM-179)                                       | `{items:[{transaction_id, from/to_account_ref·no, ts, amount_paid·currency_paid, amount_received·currency_received, payment_format, direction, scope}], page, size, total}`                                            | `casesApi.transactions`                |
| 거래 원본      | `GET …/evidence/{transaction_id}` (C4)                                                        | `{case_no, transaction, source{dataset, record_id, is_synthetic}, eligible_for_str}`, 이 케이스 거래가 아니면 404 `EVIDENCE_NOT_FOUND`                                                                                 | `casesApi.evidence`                    |
| 그래프         | `GET …/graph` (C5)                                                                            | `{nodes, edges, returned_transaction_count, total_transaction_count, truncated}`                                                                                                                                       | `casesApi.graph`                       |
| 이력 전체      | `GET …/histories?page&size` (C6)                                                              | 상세 `history`와 같은 줄, NOTE 제외                                                                                                                                                                                    | `casesApi.histories`                   |
| 요약 생성·갱신 | `POST …/refresh-summary` `{version}` (A7, 담당만)                                             | 201 `{case_no, summary, case_version}` → 상세 다시 조회. 실패(502 `SUMMARY_CODE_CHECK_FAILED` 등)면 기존 요약 그대로                                                                                                   | `casesApi.refreshSummary`              |
| 현재 요약      | `GET …/summary` (C7, 조회 3역할)                                                              | `{case_no, summary}` — 없으면 `summary: null`. 상세 `latest_summary`와 같은 값                                                                                                                                         | `casesApi.summary`                     |

- 상세 `aggregates`는 근거 거래 전체로 서버가 계산해요(통화별, 경유·자기계좌 제외, SCRUM-179). 화면은 더하지 않아요.
- 상세 `alert`·`latest_score`는 BE `GetAlertSummary`(SCRUM-152)로 채워져 와요. `latest_score.score_status`가 PENDING·FAILED면 점수 칸은 null이라 화면은 상태(산출 전·산출 실패)를 보여 줘요. 맨 위 `score`·`score_band`·`policy_version`은 계약서 Q2 MVP대로 `latest_score`와 같은 값으로 와요(BE #78 리뷰). `latest_score.score_band`는 서버가 지금 운영 정책으로 계산하고, 정책이 없으면 null이라 화면은 등급 없이 점수만 보여 줘요.

- AI 조사 요약 칸(`CaseSummaryPanel`, SCRUM-175)은 상세 `latest_summary`를 그대로 보여 줘요. `is_current`가 true면 "현재 입력 기준", false면 "입력 변경됨", null이면 다시 생성 안내. 버튼은 `REFRESH_SUMMARY`가 있을 때만 — 요약이 없으면 [요약 생성], 있으면 [요약 갱신]. 실패는 그 칸에만 보여 주고, 기존 요약은 "이전에 만든 요약"으로 구분해요. 갱신하면 `case_version`이 +1이라 상세를 다시 불러요.
- 계좌는 서버가 가린 `account_no`와 구별용 `account_ref`만 와요. 버튼은 `available_actions`만 보고 켜요(`CaseActions`).
- 종료 버튼은 하나예요. `available_actions`에 `CLOSE`가 있으면 `close`, `CLOSE_WITH_DRAFT`가 있으면 `close-with-draft`를 불러요 — 초안이 있는지 화면이 따로 판단하지 않아요(SCRUM-112). 백엔드가 아직 없으면 404 `NOT_FOUND` 안내("아직 서버에 없는 기능이에요.") — 입력은 폼에 그대로 남아요.
- 변경 응답(M)은 상세 전체가 아니라서 성공 뒤 상세·목록을 무효화해 다시 불러요(`useCaseCommand`). `CONCURRENT_UPDATE`·`INVALID_CASE_TRANSITION`·`NOT_ASSIGNEE`면 입력을 두고 상세만 다시 불러요.
- 400 `details`의 필드 이름은 요청 JSON 이름(snake_case, 예: `investigator_notes`) 하나로 와요(BE SCRUM-167 #76).

### 〔초안〕 STR 초안 조회 — MSW 계약 [STR API 명세 2·4번, 계약서 S2·S4·S5(11/4 채영), FE 코드 `strApi.js`·`mocks/strDrafts.js`, SCRUM-110]

백엔드 str API가 아직 없어 **명세 예시 JSON 그대로** MSW가 답해요. 본문 열람 제한 규칙은 `06_features/str.md` §3.

| 동작           | API                                                         | 응답                                                                                                              | 프론트                |
| -------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------- |
| 초안 보기      | `GET /api/v1/str-drafts/{draft_no}`                         | 명세 1번 모양 또는 상태·날짜만의 제한 응답(`access: "META_ONLY"`, 본문 필드 `null`), 없으면 404 `DRAFT_NOT_FOUND` | `strApi.getDraft`     |
| 수정 이력 목록 | `GET /api/v1/str-drafts/{draft_no}/revisions`               | `{ draft_no, items }` (본문 없음). 열람 권한 없으면 403 `FORBIDDEN`·`NOT_ASSIGNEE`                                | `strApi.getRevisions` |
| 수정본 한 행   | `GET /api/v1/str-drafts/{draft_no}/revisions?revision_no=n` | `narrative_before`·`narrative_after`, 없는 번호 404                                                               | `strApi.getRevision`  |
