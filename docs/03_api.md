# 03. API 연동

> v0.4 · 2026-11-22 · 초안(팀 확인 중) · 정리 지윤 · 11/19 계약서 v0.2(11/19본) 대조 반영(SCRUM-315~318) · 11/22 참고 사례 찾기 〔임시〕(SCRUM-333)

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

| HTTP | `code`                                                                                                                                            | 화면에서                                                                                                                                                                                                                                                                                                          | 지금 코드                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 400  | `INVALID_REQUEST`                                                                                                                                 | `details` 필드 오류를 해당 입력칸에(키는 요청 JSON snake_case, 중첩은 `items[0].transaction_id`). 입력 유지. 쿼리·경로 오류는 `details.parameter`에 파라미터 이름만 와요(BE #76) → "{필터 이름} 값이 올바르지 않아요"(감사 기록 필터 이름 포함, `getParameterLabel`)                                              | 메모·계정·감사 기록 필터, `parameter`는 `apiClient` (SCRUM-318) |
| 401  | `UNAUTHENTICATED`                                                                                                                                 | 업무 캐시 정리 → 로그인 안내, **지금 URL 기억**. 실패한 쓰기를 다시 보내지 않음                                                                                                                                                                                                                                   | 처리 (`queryClient.js`)                                         |
| 401  | `LOGIN_FAILED`                                                                                                                                    | "아이디 또는 비밀번호가 맞지 않아요." 한 가지 문구. 세션 끊김 안내와 구분                                                                                                                                                                                                                                         | 처리 (`apiClient`)                                              |
| 403  | `FORBIDDEN`                                                                                                                                       | 화면 유지, 그 동작 자리(확인창·칸)에 "실행 권한이 없어요" — 서버 문구보다 먼저 (SCRUM-200)                                                                                                                                                                                                                        | 처리                                                            |
| 403  | `CSRF_INVALID`                                                                                                                                    | 입력 유지, "현재 사용자를 다시 확인한 뒤 시도" — 권한 부족과 다른 문구. 자동 반복 없음                                                                                                                                                                                                                            | 처리                                                            |
| 403  | `NOT_ASSIGNEE`                                                                                                                                    | "담당자만 할 수 있어요" + 상세 재조회                                                                                                                                                                                                                                                                             | 처리                                                            |
| 404  | `CASE_NOT_FOUND`, `DRAFT_NOT_FOUND` …                                                                                                             | 대상 없음 안내 + 목록으로                                                                                                                                                                                                                                                                                         | 처리 (404 공통)                                                 |
| 404  | `NOT_FOUND`                                                                                                                                       | 주소 자체가 없음(아직 서버에 없는 API, 백엔드 #67). "아직 서버에 없는 기능이에요" + 입력 유지                                                                                                                                                                                                                     | 처리 (`apiClient`)                                              |
| 405  | `METHOD_NOT_ALLOWED`                                                                                                                              | 그 주소에 안 되는 메서드(백엔드 #67, `Allow` 헤더). 보통 안 보여야 정상 — 일반 실패 안내                                                                                                                                                                                                                          | 처리 (`apiClient`, SCRUM-318)                                   |
| 409  | `CONCURRENT_UPDATE`                                                                                                                               | **입력·기준 버전 유지**, 최신 내용을 따로 불러 비교, 사용자가 고른 뒤 새 버전으로 명시적 재저장                                                                                                                                                                                                                   | 처리                                                            |
| 409  | `INVALID_CASE_TRANSITION`                                                                                                                         | "현재 상태에서 할 수 없어요" + 상세 재조회, 그 동작이 빠지면 열린 폼 닫기                                                                                                                                                                                                                                         | 처리                                                            |
| 409  | `INVALID_ASSIGNEE` (·404 `USER_NOT_FOUND`)                                                                                                        | 담당자 입력칸 아래(`aria-invalid`·`aria-describedby`), 입력 유지. 담당자 변경 확인창은 그 안에 안내 + 조사역 목록 재조회                                                                                                                                                                                          | 처리 (SCRUM-200)                                                |
| 409  | `SELF_APPROVAL`                                                                                                                                   | "본인이 담당한 케이스는 승인할 수 없어요"                                                                                                                                                                                                                                                                         | 문구만                                                          |
| 409  | `NARRATIVE_UNCHANGED`                                                                                                                             | "반려된 본문을 고친 뒤 다시 요청해 주세요" (재조회 없이 편집 유지)                                                                                                                                                                                                                                                | 문구만                                                          |
| 409  | `DRAFT_IN_PROGRESS`                                                                                                                               | "초안을 만드는 중이에요" — AI 장애(502)와 다른 안내. 자동 재시도 없음                                                                                                                                                                                                                                             | 문구만                                                          |
| 409  | `DRAFT_NOT_VERIFIED`, `DRAFT_LOCKED`, `DRAFT_SUPERSEDED`, `VERIFY_IN_PROGRESS` 〔초안〕                                                           | 코드별 안내 + 케이스·초안 재조회, 입력 유지                                                                                                                                                                                                                                                                       | 처리 (`useStrCommand`)                                          |
| 409  | `BATCH_RUNNING`, `BATCH_ALREADY_DONE`                                                                                                             | 배치 화면 안내 + 상태 재조회                                                                                                                                                                                                                                                                                      | 케이스 생성 카드 확인창 안 (SCRUM-180)                          |
| 409  | `LOGIN_ID_TAKEN`, `ASSIGNEE_HAS_ACTIVE_CASES`                                                                                                     | 계정 발급 아이디 칸 아래 / 역할 변경 확인창 안 "진행 중인 담당 케이스가 N건" + [담당 케이스 보기]                                                                                                                                                                                                                 | 처리 (계정 관리)                                                |
| 409  | `ACCOUNT_CHANGE_NOT_ALLOWED` (`details.reason` `SELF`·`SYSTEM`)                                                                                   | 보통 안 보여야 정상(버튼 숨김이 먼저). 오면 `reason`에 따라 "본인 계정은 바꿀 수 없어요." / "시스템 계정은 바꿀 수 없어요."(모르는 값은 "이 계정은 바꿀 수 없어요.") + 계정 목록 재조회                                                                                                                           | 처리 (SCRUM-318)                                                |
| 409  | 그 밖                                                                                                                                             | 일반 업무 안내 + 재조회. **`CONCURRENT_UPDATE` 충돌 화면을 띄우지 않음**                                                                                                                                                                                                                                          | 처리                                                            |
| 502  | `AI_UNAVAILABLE`, `AI_TIMEOUT`, `AI_BAD_RESPONSE`, `AI_DRAFT_NOT_FOUND`, `AI_INVALID_REQUEST`, `AI_UNAUTHENTICATED`, `LLM_*`, `MODEL_UNAVAILABLE` | 그 영역(요약·초안·검증·질문)에만 실패 안내 + 수동 다시 시도. 나머지 화면은 계속 씀. 서버 문구보다 화면 문구가 먼저 — `AI_TIMEOUT`은 "AI 응답이 늦어…", 나머지는 "AI 요청을 처리하지 못했어요…". `AI_`가 붙은 404·400·401은 백엔드 자체 코드와 다르니 입력칸 오류·로그인 화면으로 보내지 않아요(SCRUM-128, BE #80) | 처리 (`apiClient`, SCRUM-318)                                   |

케이스 목록·상세는 위 코드를 MSW로 한 번씩 띄워 점검했어요(`src/test/caseErrors.test.jsx`, SCRUM-200). 오류는 그 동작의 확인창·폼·칸 안에만 보이고 다른 칸·버튼은 막지 않아요.

표에 코드별 문구가 없는 응답은 서버가 준 `error.message`를 먼저 보여 주고, 없을 때만 상태별 기본 문구(403 "실행 권한이 없어요" 등)를 써요.

| HTTP        | `code`           | 화면에서                                                                    | 지금 코드 |
| ----------- | ---------------- | --------------------------------------------------------------------------- | --------- |
| 500         | `INTERNAL_ERROR` | 일반 실패 안내                                                              | 처리      |
| (응답 없음) | timeout·네트워크 | "성공했는지 모름" — **쓰기였다면 최신 상태를 먼저 조회**하고 다시 할지 판단 | 처리      |

- 429 `QUESTION_RATE_LIMITED`(질문하기 A8, `details.retry_after_seconds`)는 계약서에 처음 생기는 상태 코드예요. `getErrorMessage`는 "요청 한도를 초과했습니다. 잠시 후 다시 시도하세요."를, `getRetryAfterSeconds`는 남은 초를 줘요. 질문 패널은 입력 칸 아래에 남은 초를 세어 보여 주고 입력을 남겨요(SCRUM-303).

- 코드 목록 전체와 확정 여부는 BE 03 §2 표. 새 코드를 처리하면 `getErrorMessage`와 이 표에 같이 추가해요.
- 옛 MSW 이름 `INVALID_TRANSITION`·`CASE_VERSION_CONFLICT`와 최상위 `code` 호환은 실제 cases API로 바꾸면서 지웠어요(FE-1, SCRUM-103).
- 403은 "토스트 + 화면 유지", 409는 "메시지 + 재조회"가 기본이에요(BE flows 05). 위 표가 그 위에 코드별로 덧붙인 것.

## 4. 긴 AI 요청 [BE 08 10/29, 안건 17·21·23]

요약 갱신·초안 생성·검증은 백엔드가 AI를 부르고 기다려요. **백엔드 쪽 한도가 재시도 포함 전체 90초**예요.

- 지금 `apiClient` timeout은 15초라 AI 요청엔 짧아요. AI 요청 세 개(요약 갱신 A7·초안 생성 S1·검증 S5)는 요청마다 `AI_REQUEST_TIMEOUT_MS`(100초)로 보내요 〔확인 필요: 프록시·Vercel 한도 포함 최종 값 — FE-8〕. 요약 갱신이 15초에 끊겨 서버엔 저장되는데 화면은 실패로 보이던 것을 11/19에 고쳤어요(SCRUM-315).
- 요청 중엔 진행 안내 + **같은 버튼 다시 누르기 막기**. 자동 재시도·폴링 없음.
- 화면을 떠나도 서버 작업은 계속될 수 있어요. "취소됐다"고 표시하지 않아요.
- 응답이 없거나 timeout이면 **최신 초안·검증·상태를 먼저 조회**하고 나서 다시 할지 정해요(같은 초안이 두 번 생길 수 있음 — BE 미결 21). 케이스 작업(`useCaseCommand`)은 응답이 없으면 상세·목록을 다시 불러요. 요약 갱신은 다시 불러온 요약의 `produced_at`이 누르기 전과 다르면 저장된 것으로 보고 실패 안내를 띄우지 않아요.
- 질문하기(A8)만 한도가 30초라 timeout `ASK_REQUEST_TIMEOUT_MS`(35초)예요(계약서 2.6, SCRUM-303). 응답 없이 끊기면 지난 질문(C9)을 다시 불러 저장됐는지 먼저 봐요.
- 참고 사례 `excerpt`(S2 `references[]`·S9 `items[]`, SCRUM-427) — 영어 원문 관련 구절. NFC 뒤 UTF-16 코드 단위 300 이하(AI가 자르고 BE가 확인). 화면 경계(`strApi.js`)는 문자열이 아니거나 빈 값·공백이거나 300을 넘으면 `null`로, 값은 받은 그대로. 원문 `text`는 계속 응답에 없어요. 화면 문구는 "이 자료의 관련 구절"("AI가 참고한 문장" 류 금지). 화면은 excerpt가 있는 카드 오른쪽 위에 공통 `InfoTip` ⓘ(검증 항목 ⓘ와 같은 모양, 말풍선 첫 줄 "이 자료의 관련 구절" + 구절)를 붙이고, 그 목록 안내를 "카드의 ⓘ에 마우스를 올리면 관련 구절이 보여요. …"로 바꿔요(`StrReferencePanel.jsx`)
- 참고 사례 찾기만 timeout `REFERENCE_SEARCH_TIMEOUT_MS`(10초)예요(BE 8초 + 여유, 설계 문서 A 7.3). 조회라 응답 없이 끊겨도 저장 확인 없이 [다시 시도]만 보여 줘요. 자동 재시도·폴링 없음.
- 생성과 검증은 버튼이 따로예요. 생성 직후 자동 검증하지 않아요(안건 17).
- **배치 네 개(적재 B1·룰 스캔 B2·점수 B3·케이스 생성 B4)는 모두 `202` + RUNNING 실행**(BE SCRUM-356). 결과는 `GET /admin/batches/{batch_run_id}`(B5)·목록 `GET /admin/batches?date=`로 읽어요. 요청은 기본 timeout(15초)이고, 화면을 떠나도 서버 작업은 계속돼요.
    - `summary` — 룰 스캔 `alerts_by_rule[{rule_id, rule_version, alert_count}]`, 점수 `requested·scored·failed·retryable·chunks{total, failed}·model_versions`. 적재·케이스 생성·실행 중은 null. 점수는 **다시 보낼 실패가 남으면 `FAILED`여도 `summary`가 있어요** — 실패를 0점·저위험으로 표시하지 않아요.
    - `progress` — RUNNING인 적재·룰 스캔만 `{done, total, current}`(적재 `PATTERNS→ACCOUNTS→TRANSACTIONS→VERIFY`, 룰 스캔은 룰 ID). 화면은 "R03 환전 중계 실행 중 (3/6)"처럼 보여 줘요(`batchText.js`).
- **자동 연쇄**(BE, 항상 켜짐) — 룰 스캔 성공 → 점수 → 점수 SUCCEEDED → 케이스 생성. 화면은 [분석 일괄 실행](룰 스캔) 한 번만 부르고, 점수·케이스 생성은 실패했을 때만 [점수 재처리]·[다시 실행](같은 API, 남은 대상만)으로 불러요.
- **폴링** — 그 날짜 실행 목록(`useBatchRunsForDate`)을 RUNNING이 있는 동안 2초마다(최대 10분, 넘으면 [상태 다시 확인]), 끝난 직후 15초까지 다시 읽어요. 원천 적재는 실행 한 건(`useBatchRun`)을 같은 방식으로.
- 고른 분석 날짜는 `sessionStorage` `dajaba.batches.date.v1.{login_id}`에 둬요(`batchDate.js`) — 다른 메뉴에 갔다 오거나 새로고침해도 그 날짜 실행 목록으로 자동 처리 현황·결과 표를 다시 그려요.
- 409 — 이미 적재된 DB의 `BATCH_ALREADY_DONE`은 실패가 아니라 "이미 적재돼 있음". 그 밖의 409(`BATCH_RUNNING`·`DATASET_NOT_LOADED`·`DATE_OUT_OF_RANGE`·`NO_ACTIVE_RULES`·`RULE_SCAN_NOT_DONE` 등)는 실행 카드 안에 보여 줘요. 룰 스캔은 성공한 날짜를 다시 돌릴 수 없어요.
- **작업 추적기**(SCRUM-365, 「비동기 작업 알림 설계 문서」 7절) — 내가 시작한 비동기 작업을 화면을 옮겨도 지켜보다가 끝나면 토스트로 알려요(`shared/jobs`, `AppLayout`이 감싸요). 종류별 조회·판정은 `app/jobs/jobKinds.js`:
    - `LOAD_DATASET` — 원천 적재 202 뒤 등록, B5를 2초마다(키는 `useBatchRun`과 같아 요청이 합쳐져요)
    - `ANALYSIS` — 룰 스캔·[점수 재처리]·[다시 실행] 202 뒤 등록, 그 날짜 목록을 2초마다. 시작한 실행 이후 케이스 생성이 `SUCCEEDED`면 끝, 어느 단계든 `FAILED`면 실패
    - `REPORT_PDF` — 모의 제출(P4)·다시 만들기(P5) 뒤 등록, 상태만 주는 API가 없어 S8을 3초마다(409 `REPORT_PDF_NOT_READY` `pdf_status` PENDING 진행·FAILED 실패, 200 완성)
    - 10분이 지나도 진행 중이면 "확인 필요"(실패로 단정하지 않음) + 종 목록의 [다시 확인]. 404·403은 "확인할 수 없어요"(토스트 없음), 401은 전부 멈춤, 네트워크·5xx는 간격을 늘려 가며(최대 30초) 계속 — 작업마다 연속 실패 수를 따로 세어 2·4·8·16배, 성공하면 기본 간격(`shared/jobs/failureBackoff.js`, 9/7 점검)
    - 저장은 `sessionStorage` `aml.jobs.{login_id}`(새로고침해도 이어짐, 로그아웃하면 지움). 진행 중 최대 10개, 끝난 것 최근 5개
    - 토스트: 성공은 5초 뒤 사라지고 실패는 닫을 때까지 남아요, 둘 다 [결과 보기]. 그 작업 화면에 있거나 복구했는데 끝난 지 1분이 넘었으면 토스트 없이 종 목록에만. 문구엔 작업 이름·날짜·건수만(오류 원문 없음)
    - 토스트는 최대 3개까지 쌓이고(`show({tone, text, sticky, action})`, 기존 호출 그대로), 종은 "작업" 칸 + 안 본 끝난 작업 수를 숫자에 더하고 진행 중이면 돌아가는 표시

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
| 이력 전체      | `GET …/histories?page&size` (C6)                                                              | 상세 `history`와 같은 줄, NOTE 제외. 줄마다 `from_assignee`·`to_assignee` `{login_id, display_name}`(ASSIGN은 받은 사람만, REASSIGN은 둘 다, 그 밖 null — BE SCRUM-348)                                                | `casesApi.histories`                   |
| 요약 생성·갱신 | `POST …/refresh-summary` `{version}` (A7, 담당만)                                             | 201 `{case_no, summary, case_version}` → 상세 다시 조회. 실패(502 `SUMMARY_CODE_CHECK_FAILED` 등)면 기존 요약 그대로                                                                                                   | `casesApi.refreshSummary`              |
| 현재 요약      | `GET …/summary` (C7, 조회 3역할)                                                              | `{case_no, summary}` — 없으면 `summary: null`. 상세 `latest_summary`와 같은 값                                                                                                                                         | `casesApi.summary`                     |

- 상세 `aggregates`는 근거 거래 전체로 서버가 계산해요(통화별, 경유·자기계좌 제외, SCRUM-179). 화면은 더하지 않아요.
- 상세 `alert`·`latest_score`는 BE `GetAlertSummary`(SCRUM-152)로 채워져 와요. `latest_score.score_status`가 PENDING·FAILED면 점수 칸은 null이라 화면은 상태(산출 전·산출 실패)를 보여 줘요. 맨 위 `score`·`score_band`·`policy_version`은 계약서 Q2 MVP대로 `latest_score`와 같은 값으로 와요(BE #78 리뷰). `latest_score.score_band`는 서버가 지금 운영 정책으로 계산하고, 정책이 없으면 null이라 화면은 등급 없이 점수만 보여 줘요.

- AI 조사 요약 칸(`CaseSummaryPanel`, SCRUM-175)은 상세 `latest_summary`를 그대로 보여 줘요. `is_current`가 true면 "현재 입력 기준", false면 "입력 변경됨", null이면 다시 생성 안내. 버튼은 `REFRESH_SUMMARY`가 있을 때만 — 요약이 없으면 [요약 생성], 있으면 [요약 갱신]. 실패는 그 칸에만 보여 주고, 기존 요약은 "이전에 만든 요약"으로 구분해요. 갱신하면 `case_version`이 +1이라 상세를 다시 불러요.
- 계좌는 서버가 가린 `account_no`와 구별용 `account_ref`만 와요. 버튼은 `available_actions`만 보고 켜요(`CaseActions`).
- **ML+DL 조사 순위 `dl_rank`** (목록·상세 같은 모양, BE SCRUM-420) — `{status, reason, ml_rank, fused_rank, fallback_reason, dl_score}`. `AVAILABLE`이면 목록 「조사 순위」 칸·상세 「케이스·경보 정보」에 "결합 N위 / ML M위", ML 점수 없으면(`ML_UNSCORED`) "순위 없음", DL 근거가 덜 이어지면(`INCOMPLETE_DL_EVIDENCE`) ML 순위 유지 안내. `UNAVAILABLE`(이유 7종 — `REFERENCE_MISMATCH`·`EVIDENCE_MISMATCH` 포함)·칸 없음은 이유와 상관없이 "순위 조회 불가"(`dlRank.js`). 목업 백엔드에선 거의 다 조회 불가가 정상이고, 순위는 DB를 새로 만들고 9/7을 처음 스캔했을 때만 붙어요.
- 종료 버튼은 하나예요. `available_actions`에 `CLOSE`가 있으면 `close`, `CLOSE_WITH_DRAFT`가 있으면 `close-with-draft`를 불러요 — 초안이 있는지 화면이 따로 판단하지 않아요(SCRUM-112). 백엔드가 아직 없으면 404 `NOT_FOUND` 안내("아직 서버에 없는 기능이에요.") — 입력은 폼에 그대로 남아요.
- 변경 응답(M)은 상세 전체가 아니라서 성공 뒤 상세·목록을 무효화해 다시 불러요(`useCaseCommand`). `CONCURRENT_UPDATE`·`INVALID_CASE_TRANSITION`·`NOT_ASSIGNEE`면 입력을 두고 상세만 다시 불러요.
- 400 `details`의 필드 이름은 요청 JSON 이름(snake_case, 예: `investigator_notes`) 하나로 와요(BE SCRUM-167 #76).

### 업무 알림 [「비동기 작업 알림 설계 문서」 6.5절, 11/22 진희님 확인, BE SCRUM-355 #169, FE 코드 `notificationsApi.js`·`mocks/notifications.js`, SCRUM-334]

BE `GET /notifications`는 develop에 있어요(SCRUM-355 #169, BE `06_features/cases.md` 「업무 알림 조회」). MSW는 같은 모양으로 답해요.

| 동작    | API                                      | 응답                                                                                                                                        | 프론트                  |
| ------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 내 알림 | `GET /api/v1/notifications?since=&size=` | `{ items[{type, case_no, draft_no, reason_code, actor{login_id, display_name}, at}], total, server_time }`, 형식 오류 400 `INVALID_REQUEST` | `notificationsApi.list` |

- `since`는 **Z로 끝나는 UTC만**(`+09:00`은 400). 없으면 최근 7일, 30일보다 오래되면 30일 전으로 맞춰요. 다음 조회 `since`엔 응답 `server_time`을 그대로 넣어요(화면 시계 안 씀). API 모듈은 Z가 아닌 값을 보내지 않아요.
- `size` 1~50, 기본 20, 최신순. `total`은 `since` 뒤 전체 건수이고 **99에서 멈춰요** — 화면은 99면 "99+"(`badgeLabel`).
- **관리자는 늘 `items: []`, `total: 0`**(관리자 알림은 작업 추적기 몫). 자기가 한 일은 안 나와요.
- `draft_no`는 `APPROVAL_REQUESTED`·`STR_APPROVED`·`STR_REJECTED`·`STR_REPORTED`에만, 케이스 알림 3종(`CASE_ASSIGNED`·`CASE_REASSIGNED_TO_ME`·`CASE_REASSIGNED_AWAY`)은 `null`. `reason_code`는 `STR_REJECTED`일 때만.
- 반려 코멘트·메모·계좌·금액·DB id는 없어요. 문구·이동 경로는 화면이 `type`으로 만들어요(`features/notifications/model/notificationRules.js`, 설계 7.8 예시).
- **화면(종, `NotificationBell`)** — 위 띠 오른쪽, 모든 역할. 숫자는 `since=마지막으로 본 시각`·`size=1`로 30초마다 받은 `total`(탭이 가려지면 멈추고 보이면 바로 한 번). 열면 최근 7일 50건(`since` 없이, `size=50` 최대)을 보여 주고, 받은 `server_time`을 `localStorage` `aml.notifications.seen.{login_id}`에 저장해 본 것으로 쳐요 — 목록을 못 받으면 저장하지 않아요. 숫자가 늘면 "새 알림 n건" 토스트 하나(로그인 직후 첫 조회엔 없음). 숫자 조회 실패는 조용히 직전 숫자 유지, 목록 조회 실패는 목록 자리에만 안내 + [다시 불러오기]. 목록에선 이전에 본 시각보다 새 줄에 "새 알림" 표시. `total`이 받은 줄 수보다 크면 목록 아래 "이전 알림 n건 더 있음"(n = `total` − 줄 수, `total`이 99면 "n건 이상" — 커서가 없어 더 불러오지 않음, BE 1단계 한계). 작업 알림(추적기, 준혁님)은 아직 없어 "업무" 꼬리표만 — 생기면 같은 목록에 시간순으로 섞어요. 테스트 `notifications.test.js`·`notificationBell.test.jsx`.

### 관리자 대시보드 경보 통계 [BE SCRUM-360 #176, BE `06_features/cases.md`, FE 코드 `alertStatsApi.js`·`mocks/handlers.js`, SCRUM-345]

BE #176이 develop에 들어가야 실제 서버에서 동작해요 — 그 전 develop 서버는 이 주소를 경보 상세로 받아 404 `ALERT_NOT_FOUND`("경보가 없습니다")를 줘요. 머지 순서 BE 360 → FE 345.

| 동작           | API                                            | 응답                                            | 프론트                                                                                      |
| -------------- | ---------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 경보 등급 통계 | `GET /api/v1/admin/alerts/stats?date=` (ADMIN) | `{date, total, scored, bands{high, medium, low} | null, unscored, failed, case_opened, policy_version}`, 날짜 형식 오류 400 `INVALID_REQUEST` | `alertStatsApi.stats` |

- 대시보드는 **`date` 없이(전체 기간 누적)** 불러요(`useAlertStats`) — 미배정·승인 대기 같은 케이스 카드와 같은 누적 기준. `date`는 특정 배치일만 볼 때 쓰는 선택 값이에요.
- 등급은 케이스 생성과 같은 운영 경계값(`CasePolicy`)이라 HIGH 수 = 케이스 전환 수. 경계값이 없으면 `bands`·`policy_version`이 null — 화면은 고위험 경보 "—", 반원은 "등급 없음(경계값 미설정)" 한 조각.
- 관리자만 불러요(조사역·승인자 대시보드는 케이스 기준). 통계를 못 받으면 대시보드 대신 오류와 [다시 불러오기].

### STR — 단계별 연결 (11/10)

S1(SCRUM-183, `case_version` #89)·S2(SCRUM-205 #84)·S3·S4(SCRUM-184 #91)는 BE develop에 있어요. S5·S6·A6은 아직 MSW예요. 표는 `06_features/str.md` "백엔드 연결 상태".

- 확정본 PDF(S8 `GET /str-drafts/{draft_no}/report.pdf`, `approvalsApi.reportPdf`) 저장 파일명은 응답 `Content-Disposition`의 `filename*`·`filename`(없거나 읽지 못하면 `{draft_no}.pdf`). 다른 출처로 부르면 BE CORS가 이 헤더를 노출하지 않아 초안 번호 이름이 돼요.

### STR 초안 조회 [STR API 명세 2·4번, 계약서 S2·S4·S5(11/4 채영), BE SCRUM-184 #91, FE 코드 `strApi.js`·`mocks/strDrafts.js`, SCRUM-110]

수정 이력(S4)은 BE develop에 있어요. MSW는 같은 모양으로 답해요. 본문 열람 제한 규칙은 `06_features/str.md` §3.

| 동작           | API                                                                          | 응답                                                                                                                                                                                                                    | 프론트                    |
| -------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 초안 보기      | `GET /api/v1/str-drafts/{draft_no}`                                          | 명세 1번 모양 또는 상태·날짜만의 제한 응답(`access: "META_ONLY"`, 본문 필드 `null`), 없으면 404 `DRAFT_NOT_FOUND`. `references[]` 원소 맨 끝 `excerpt`(관련 구절, 문자열\|null·없어도 됨, SCRUM-427)                    | `strApi.getDraft`         |
| 수정 이력 목록 | `GET /api/v1/str-drafts/{draft_no}/revisions`                                | `{ draft_no, current_revision_no, items }` (본문 없음, 행마다 `ai_original`). 열람 권한 없으면 403 `NOT_ASSIGNEE`                                                                                                       | `strApi.getRevisions`     |
| 수정본 한 행   | `GET /api/v1/str-drafts/{draft_no}/revisions?revision_no=n`                  | 평평한 모양 `narrative_before`·`narrative_after`(1번은 before `[]`), 없는 번호 404 `REVISION_NOT_FOUND`                                                                                                                 | `strApi.getRevision`      |
| 참고 사례 찾기 | `POST /api/v1/str-drafts/{draft_no}/references/search` `{typologies, query}` | `{ items[{doc_title, publisher, year, page, score, typologies, source_type, excerpt}], degraded }`. 0건도 200. BE develop(SCRUM-354 #178), MSW는 같은 모양(`mocks/referenceSearch.js`). `excerpt`는 맨 끝 칸(SCRUM-427) | `strApi.searchReferences` |
