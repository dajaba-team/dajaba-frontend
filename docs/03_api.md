# 03. API 연동

> v0.1 · 2026-10-31 · 초안(팀 확인 중) · 정리 지윤

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

| HTTP | `code`                                                                                  | 화면에서                                                                                        | 지금 코드                 |
| ---- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------- |
| 400  | `INVALID_REQUEST`                                                                       | `details` 필드 오류를 해당 입력칸에. 입력 유지                                                  | 메모에서 처리             |
| 401  | `UNAUTHENTICATED`                                                                       | 업무 캐시 정리 → 로그인 안내, **지금 URL 기억**. 실패한 쓰기를 다시 보내지 않음                 | 처리 (`queryClient.js`)   |
| 401  | `LOGIN_FAILED`                                                                          | "아이디 또는 비밀번호를 확인해 주세요" 한 가지 문구                                             | 정식 로그인 때            |
| 403  | `FORBIDDEN`                                                                             | 화면 유지, "실행 권한이 없어요" 토스트                                                          | 처리                      |
| 403  | `CSRF_INVALID`                                                                          | 입력 유지, "현재 사용자를 다시 확인한 뒤 시도" — 권한 부족과 다른 문구. 자동 반복 없음          | 처리                      |
| 403  | `NOT_ASSIGNEE`                                                                          | "담당자만 할 수 있어요" + 상세 재조회                                                           | 아직 (서버 문구로 떨어짐) |
| 404  | `CASE_NOT_FOUND`, `DRAFT_NOT_FOUND` …                                                   | 대상 없음 안내 + 목록으로                                                                       | 처리 (404 공통)           |
| 409  | `CONCURRENT_UPDATE`                                                                     | **입력·기준 버전 유지**, 최신 내용을 따로 불러 비교, 사용자가 고른 뒤 새 버전으로 명시적 재저장 | 처리                      |
| 409  | `INVALID_CASE_TRANSITION`                                                               | "현재 상태에서 할 수 없어요" + 상세 재조회                                                      | 처리                      |
| 409  | `SELF_APPROVAL`                                                                         | "본인이 담당한 케이스는 승인할 수 없어요"                                                       | 문구만                    |
| 409  | `NARRATIVE_UNCHANGED`                                                                   | "반려된 본문을 고친 뒤 다시 요청해 주세요" (재조회 없이 편집 유지)                              | 문구만                    |
| 409  | `DRAFT_IN_PROGRESS`                                                                     | "초안을 만드는 중이에요" — AI 장애(502)와 다른 안내. 자동 재시도 없음                           | 문구만                    |
| 409  | `DRAFT_NOT_VERIFIED`, `DRAFT_LOCKED`, `DRAFT_SUPERSEDED`, `VERIFY_IN_PROGRESS` 〔초안〕 | 코드별 안내 + 초안 재조회                                                                       | 아직                      |
| 409  | `BATCH_RUNNING`, `BATCH_ALREADY_DONE`                                                   | 배치 화면 안내 + 상태 재조회                                                                    | 아직                      |
| 409  | 그 밖                                                                                   | 일반 업무 안내 + 재조회. **`CONCURRENT_UPDATE` 충돌 화면을 띄우지 않음**                        | 처리                      |
| 502  | `AI_UNAVAILABLE`, `AI_TIMEOUT`, `AI_BAD_RESPONSE`, `LLM_*`, `MODEL_UNAVAILABLE` …       | 그 영역(요약·초안·검증)에만 실패 안내 + 수동 다시 시도. 나머지 화면은 계속 씀                   | 문구만 (502 공통)         |

표에 코드별 문구가 없는 응답은 서버가 준 `error.message`를 먼저 보여 주고, 없을 때만 상태별 기본 문구(403 "실행 권한이 없어요" 등)를 써요.
| 500 | `INTERNAL_ERROR` | 일반 실패 안내 | 처리 |
| (응답 없음) | timeout·네트워크 | "성공했는지 모름" — **쓰기였다면 최신 상태를 먼저 조회**하고 다시 할지 판단 | 처리 |

- 코드 목록 전체와 확정 여부는 BE 03 §2 표. 새 코드를 처리하면 `getErrorMessage`와 이 표에 같이 추가해요.
- `INVALID_TRANSITION`·`CASE_VERSION_CONFLICT`는 **옛 이름·MSW 전용**이에요. `apiClient.js`가 호환으로 받고 있지만 새 코드에서 쓰지 않아요. 실제 cases API로 바꿀 때 지워요(FE-1).
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

### 실제 백엔드와 같은 것 [BE 코드 `AuthController`·`MockLoginController`, BE 04 §3]

| 동작                       | API                                           | 응답                                                 | 프론트                                  |
| -------------------------- | --------------------------------------------- | ---------------------------------------------------- | --------------------------------------- |
| 현재 사용자                | `GET /api/v1/auth/me`                         | `{ id, login_id, display_name, role }`, 비로그인 401 | `authApi.me` — 401이면 `null`           |
| 테스트 로그인 (local 전용) | `POST /api/v1/auth/mock-login?login_id=inv01` | 200, `SESSION`·`XSRF-TOKEN` 쿠키                     | `authApi.mockLogin`, 개발 모드에서만 UI |
| 로그아웃                   | `POST /api/v1/auth/logout`                    | 204 (본문 없음)                                      | `authApi.logout`                        |

### 〔임시〕 케이스 — MSW 전용 계약 [FE 코드 `casesApi.js`·`handlers.js`]

화면을 먼저 만들려고 정한 계약이에요. **실제 백엔드 명세가 아니에요.**

| 동작 | 임시 API                  | 요청                        | 성공 후                            |
| ---- | ------------------------- | --------------------------- | ---------------------------------- |
| 목록 | `GET /api/cases`          | `status`, `page`(**1부터**) | `{ items, has_next }` 표시         |
| 상세 | `GET /api/cases/:id`      | 문자열 ID                   | 상세 표시                          |
| 메모 | `PUT /api/cases/:id/memo` | `{ memo, case_version }`    | 응답 상세로 캐시 교체, 목록 무효화 |

상세 응답: `id`, `title`, `status`, `evidence`, `memo`(string) · `assignee_name`(string|null) · `case_version`(number) · `allowed_actions`(string[], `SAVE_MEMO` 등) · `history`(string[]). 충돌은 409 `CASE_VERSION_CONFLICT`.

### 실제 계약으로 바꿀 때 달라지는 것

| 항목      | 〔임시〕 지금                        | 실제 (백엔드)                                                                                                           | 출처                              |
| --------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 경로      | `/api/cases`, `/api/cases/:id`       | `/api/v1/cases`, `/api/v1/cases/{case_no}`                                                                              | BE 04 §4 2·3번                    |
| 페이지    | `page` 1부터, `has_next`             | `page` 0부터, `{items, page, size, total}`                                                                              | BE `PageResponse`                 |
| 메모      | `PUT …/memo` 한 칸 교체, 문자열 이력 | `PUT /cases/{case_no}/notes` → `case_history` NOTE 행 추가 〔초안〕                                                     | BE 04 §4 8번, BE 미결 8           |
| 이력      | `string[]`                           | actor·action·시각·버전이 있는 객체 〔초안〕                                                                             | BE cases                          |
| 충돌 코드 | `CASE_VERSION_CONFLICT`              | `CONCURRENT_UPDATE`                                                                                                     | BE 03 §2                          |
| 버튼 근거 | `allowed_actions`                    | 상세 응답 `available_actions` 〔초안 — CASES 명세 API-02〕 또는 `role` + `assignee` + `status` 계산 〔확인 필요: FE-4〕 | BE cases API 02, BE 04 §4 읽는 법 |
| 계좌      | (없음)                               | 화면엔 가린 값(`010_****BD30`)만, 여러 계좌 구별은 `account_ref`. 원본 `account_key`는 쓰지 않음                        | BE 미결 19 (10/30)                |

바꿀 때는 `casesApi.js` · `useCases.js` · `handlers.js` · `cases.test.jsx` · 이 절을 **한 PR에서** 고쳐요. 기능별로 붙을 API 목록은 `06_features/`에.
