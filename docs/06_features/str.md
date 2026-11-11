# str — STR 초안·수정·검증·승인 요청

> v0.1 · 2026-10-31 · 초안(팀 확인 중) · 정리 지윤

- 프론트 폴더: `src/features/str/` · 백엔드 짝: `str` (BE `06_features/str.md`, STR 명세 〔초안〕)
- 지금: `/cases/:caseId/str`은 케이스의 지금 초안(`current_draft_no` 〔확인 필요 — 케이스 상세 API 필드 이름〕)을 불러와 **서술부를 읽기 전용으로** 그려요. 섹션은 서버가 준 목록·순서 그대로, 제목은 `label` → `shared/str/sectionTitles.js`(7항목 + 옛 6섹션, 시연 화면과 같은 표, label이 빈 값이어도 표로) → 섹션 이름 순서예요(SCRUM-115). 그 아래 **검증 결과 패널**(SCRUM-116)이 `latest_verification`을 보여 줘요. 수정·검증 실행·승인 요청은 아직이고, 시연(`/demo/cases/:caseId/str`)에서 합성 데이터로 볼 수 있어요.
- **남은 STR 화면 이슈(SCRUM-114·116·117·118·121)는 실제 `/cases/:caseNo/str` 화면에 만들어요(11/10).** `DemoStrPage`는 없앨 예정이라 고치지 않아요.

## 1. 화면 — `/cases/:caseNo/str`

| 영역      | 보이는 것                                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| facts     | 금액·건수·기간 등 **서버(AI)가 계산한 값.** 프론트가 다시 계산하거나 본문 숫자로 덮어쓰지 않아요. 수정 불가                                           |
| 본문      | 섹션별 텍스트 편집기. 섹션 ID·순서·제목은 서버 응답 그대로 〔초안: 섹션 DTO〕. 섹션당 최대 5,000자 〔확인 필요: AI 검증 1,200자와 차이 — BE 미결 24〕 |
| 수정 이력 | `revision_no`별 전·후 본문 (1 = AI 원문, 처음 고친 본 = 2 — IF-VRF-02, BE PR #14. 화면 글자는 `shared/str/revisionLabel.js`)                          |
| 검증 결과 | 통과 · 실패(항목별) · 검증 불가(`VERIFY_UNAVAILABLE`) · 미검증 — 넷을 구별. **어느 수정본을 검증한 결과인지** 같이 표시                               |
| 반려 이력 | 반려 코드(보완 요청 / 보고 안 함) + 사유                                                                                                              |

- AI 본문은 **글자로만** 그려요(`dangerouslySetInnerHTML` 금지).
- 본문 열람은 담당 조사역·승인자만. 그 밖의 사람에겐 상태·날짜만 보여요(`04_auth_session.md` §4).

### 검증 결과 패널 — `components/VerificationPanel.jsx` 〔SCRUM-116, FR-VRF-02~08〕

- 항목은 `features/str/verificationLabels.js` 표대로 **늘 11개** — 코드 검사 6개(금액 `AMOUNT_MATCH`·날짜 `DATE_MATCH`·건수 `COUNT_MATCH`·계좌 `ACCOUNT_ID_MATCH`·근거 범위 `EVIDENCE_IN_SCOPE`·종합의견 `OPINION_PRESENT` — 종합의견 공란 거부, narrative_v2만), AI 평가 5개(1~5점 + 한 줄 코멘트). **표에 없는 이름이 응답에 오면 숨기지 않고 이름 그대로** 표 뒤에 보여 줘요(개수를 고정하지 않아요 — "코드 검사 실패"인데 실패 항목이 안 보이는 일을 막아요). 옛 `GROUNDING`만 뺍니다.
- **실패한 항목을 위로**, 나머지는 표 순서. 코드 검사는 같은 검사가 여러 줄 올 수 있어(날짜 하나당 한 줄) 한 줄이라도 `match: false`면 실패, 틀린 줄마다 사유·섹션·본문 값·원본 값. 줄의 `section`이 `null`이면 "초안 전체"(건수·근거 범위처럼 초안 전체를 본 검사).
- 사유는 `불일치(MISMATCH)`·`읽지 못함(UNPARSED)`·`빠짐(MISSING)`·`근거 범위 밖(OUT_OF_SCOPE)`을 나눠요. 줄이 하나도 없으면 "통과"가 아니라 **"검사 없음"**(예: SCRUM-60 전 `COUNT_MATCH`).
- AI 평가는 4점 이상 통과·미만 "미달". `llm_checks: null`이면 표의 5개 모두 **"평가 안 함"**이고, 이유는 `status`로 나눠요 — `CODE_FAILED`는 "코드 검사가 실패해서 AI 평가를 돌리지 않았어요", `VERIFY_UNAVAILABLE`은 "AI 평가를 하지 못했어요(평가 서비스 오류). 검증 실패가 아니에요". 배열에 빠진 항목은 "결과 없음".
- 맨 위 결과(통과·코드 검사 실패·AI 평가 미달·검증 못 함)는 **서버 `status`·`passed` 그대로**예요 — 화면이 줄 결과로 다시 계산하지 않아요. 통과 기준 "코드 검사 전부 통과 + AI 평가 전부 4점 이상"은 글자로만 보여 줘요.
- 어느 수정본을 검증했는지 표시하고, `is_current: false`거나 지금 수정본 번호와 다르면 "이전 수정본을 검증한 결과" 안내.
- 검증 기록이 없으면 "아직 검증하지 않았어요". [다시 검증]·검증 못 함 유지는 SCRUM-117.
- MSW: `DRF-000124`(케이스 1001)에 코드 검사 실패 예시(날짜 못 읽음·빠짐, 건수 줄 없음, AI 평가 null). 테스트 `src/test/strVerification.test.jsx`.

## 2. 순서와 버튼 [BE flows 03, 안건 17·23·24]

```
초안 생성(최대 90초) → 섹션 수정·저장 → 지금 저장된 본문 검증(최대 90초) → 통과면 승인 요청
```

| 초안·케이스 상태                    | 담당 조사역 버튼                                                     |
| ----------------------------------- | -------------------------------------------------------------------- |
| 케이스 `ESCALATED`, 초안 없음       | 초안 생성                                                            |
| 초안 `ACTIVE`, 케이스 `DRAFTED`     | 섹션 저장 · 검증 · 승인 요청(조건부) · 재생성 · 초안 있는 종료(사유) |
| 케이스 `PENDING_APPROVAL`           | 없음 — 읽기 전용                                                     |
| 케이스 `REJECTED` + `NEED_REVISION` | 섹션 저장 · 검증 · 승인 요청(**본문을 고친 뒤에만**) · 재생성        |
| 초안 `LOCKED` / `SUPERSEDED`        | 없음 — 읽기 전용, 과거 초안은 조회만                                 |

**승인 요청 버튼을 켜는 조건** — 미저장 편집이 없고, 서버의 최신 검증이 **지금 저장된 수정본**을 대상으로 `passed=true`일 때만. 본문을 바꾸면 이전 통과 표시를 지워요. 서버가 승인 요청·승인 직전에 다시 검사해요(본문 해시로 찾기).

- 생성 직후 자동 검증 없음 — 버튼이 따로예요(안건 17).
- 미저장 편집이 있는데 검증·승인 요청을 누르면 먼저 저장하라고 안내.
- 재생성이 성공하면 새 `draft_no`로 바꾸고, 이전 초안 캐시·선택한 수정본·검증 표시를 갱신해요.
- 반려 뒤 같은 본문으로 다시 요청하면 409 `NARRATIVE_UNCHANGED` — 편집 상태 유지.

## 3. API 〔초안 — STR 명세, BE `06_features/str.md`〕

| #   | API                                                                    | 화면             | 프론트                      |
| --- | ---------------------------------------------------------------------- | ---------------- | --------------------------- |
| 1   | `POST /cases/{case_no}/str-drafts` (최대 90초)                         | 초안 생성·재생성 | 없음                        |
| 2   | `GET /str-drafts/{draft_no}`                                           | 초안 보기        | `strApi.getDraft` (MSW)     |
| 3   | `PUT /str-drafts/{draft_no}/revisions` (고친 섹션만)                   | 섹션 저장        | 없음                        |
| 4   | `GET /str-drafts/{draft_no}/revisions?revision_no=`                    | 수정 이력        | `strApi.getRevisions` (MSW) |
| 5   | `POST /str-drafts/{draft_no}/verify` (body `{}`)                       | 검증             | 없음                        |
| 6   | `POST /str-drafts/{draft_no}/submit` `{case_version, verification_id}` | 승인 요청        | 없음                        |
| 9   | `POST /cases/{case_no}/close-with-draft`                               | 초안 있는 종료   | 없음                        |

승인·반려(7·8)는 `approvals.md`. 확정본 PDF는 STR 명세 〔후속〕.

Query key 〔제안〕: `["draft", draftNo]`, `["draft", draftNo, "revisions"]`, `["draft", draftNo, "revisions", revisionNo]` (`useStrDraft`·`useStrRevisions`·`useStrRevision`).

응답 모양은 **STR API 명세 1·2·4·5번 예시 그대로**예요 — `narrative[]`(`section`·`text`·`evidence_ids`), 서술부 7항목(`SUBJECT`·`DATE`·`PLACE`·`INSTRUMENT`·`METHOD`·`GROUNDS`·`OPINION`), `current_revision_no`(1 = AI 원문), `facts`, `latest_verification`. MSW 시드는 `src/mocks/strDrafts.js`.

번호는 경로·응답 모두 **`draft_no`**(`DRF-` + 6자리, 예 `DRF-000123`)예요. `case_no`·`alert_no`와 같은 규칙이고 DB 숫자 id는 밖으로 안 나와요. [계약서 2.2, 11/4 채영]

검증 결과(`latest_verification`)는 AI 응답 그대로예요 [계약서 S5, 규약 §5.3]. `code_checks[]`는 `{ check, section, draft_value, source_value, match, reason }`(`reason`: `MISMATCH`·`UNPARSED`·`MISSING`·`OUT_OF_SCOPE`), `llm_checks[]`는 `{ check, comment, score }`(1~5점)이고 코드 검사가 실패하면 `llm_checks: null`. 프론트는 `null`을 빈 배열로 바꾸지 않아요.

S2에 더해진 필드(11/4 채영): `narrative[].label`(서식 항목 제목), `last_rejection { reason_code, comment, revision_no, decided_by, decided_at, narrative_unchanged }`(없으면 `null`), `suspicion_types`·`suspicion_types_recommended`(문자열 배열), `suspicion_level_branch`·`suspicion_level_hq`(1~5), `available_actions`(케이스 상세와 같은 이름, 계약서 Q16). 프론트 `toDraft`가 camelCase로 옮기고, MSW 시드엔 키만 두고 값은 비워 뒀어요. 〔확인 필요 — 채영〕 `report`·`references`는 모양이 아직 없어 옮기지 않아요.

`facts`는 **AI facts 그대로** 넘어와요(통화별 `inbound`/`outbound`, `period` 등, 화면용으로 줄이지 않음) [계약서 Q15, 11/4 채영]. 프론트도 키를 camelCase로 바꾸지 않고 그대로 둬요 — 본문 `cites`가 `inbound.amount.USD`·`counterparties.count`처럼 AI fact 키 이름(snake_case)이라, 키를 그대로 둬야 `cites`와 값을 바로 맞춰 볼 수 있어요. MSW 시드의 `facts`는 AI 리포 `contracts/examples/draft_response.json`의 `facts`를 그대로 옮겼어요(규약 §6.4).

### 본문 열람 제한 〔SCRUM-110, FR-APR-02·NFR-APR-01·권한 매트릭스 14번 — 11/3 확정, 필드 11/4 채영〕

본문을 볼 수 있는 사람은 **그 케이스의 담당 조사역**과 **승인자(APPROVER)**뿐이에요. **관리자와 비담당 조사역은 상태·날짜만** 받아요(ADMIN은 조사역·승인자 권한을 물려받지 않음). STR 명세 §2의 "담당이 아닌 조사역은 403 `NOT_ASSIGNEE`"는 채영님이 이 결정에 맞춰 고쳐요.

| 누가                   | `GET /str-drafts/{draft_no}`                                                                                                                                                                                                 | `GET /str-drafts/{draft_no}/revisions`                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 담당 조사역 · 승인자   | 200 명세 1번 모양 전체 + `access: "FULL"`                                                                                                                                                                                    | 200 목록 `{ draft_no, items }`(본문 없음), `?revision_no=`면 그 행의 `narrative_before`·`narrative_after` |
| 관리자 · 비담당 조사역 | 200 **제한 응답** `access: "META_ONLY"` — `draft_no`·`case_no`·`status`·`case_status`·`produced_at`만 값이 있고 `facts`·`narrative`·`latest_verification`·`last_rejection`·`references`는 `null`(키는 빼지 않음, 계약서 2.3) | 403 — 관리자 `FORBIDDEN`, 비담당 조사역 `NOT_ASSIGNEE`                                                    |

- 제한 응답도 `strView` 열람 기록 한 줄을 남겨요(BE `03_shared` §9).
- 서버는 제한 응답을 **허용 필드만 골라** 만들어요. 프론트 `toDraft`도 `access`가 `"FULL"`이 아니면(없거나 모르는 값 포함) 본문 필드를 화면 모델로 옮기지 않아요.
- 화면은 `contentVisible`로 "본문 보기"와 "상태·날짜만 보기"를 고르고, 역할로 다시 계산하지 않아요.
- 수정 이력은 제한 응답 없이 **403**(관리자 `FORBIDDEN`, 비담당 조사역 `NOT_ASSIGNEE`), 없는 `revision_no`는 **404 `REVISION_NOT_FOUND`**예요 [계약서 Q13, 11/4 채영].

## 4. 실패 처리 [BE 03 §2, BE flows 04]

| 상황                                                                | 화면                                                                                                |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 409 `DRAFT_IN_PROGRESS`                                             | "초안을 만드는 중이에요" — 장애 안내 아님. 잠시 뒤 초안 재조회 버튼                                 |
| 409 `VERIFY_IN_PROGRESS` 〔초안〕                                   | "검증 중이에요"                                                                                     |
| 409 `DRAFT_NOT_VERIFIED`·`DRAFT_LOCKED`·`DRAFT_SUPERSEDED` 〔초안〕 | 코드별 안내 + 초안 재조회                                                                           |
| 409 `CONCURRENT_UPDATE`                                             | 편집 내용 유지 + 최신 수정본 비교 (cases 메모와 같은 방식)                                          |
| 502 `AI_*`·`LLM_*`                                                  | 생성·검증 영역에만 실패 안내 + 수동 다시 시도. **검증 통신 실패를 "내용 부적합"으로 표시하지 않음** |
| 응답 없음·timeout                                                   | 최신 초안·검증 상태를 먼저 조회 (같은 초안이 두 번 생길 수 있음 — BE 미결 21)                       |

## 5. 테스트에 있어야 하는 것

본문 변경 뒤 재검증 강제, 오래된 검증으로 승인 요청 막힘, 승인 대기 중 읽기 전용, 재생성 뒤 새 초안 선택 + 이전 초안 이력, 반려(보완 요청) 뒤 수정·재검증, `DRAFT_IN_PROGRESS`와 502 구분, AI 응답 유실 뒤 중복 생성 안 함.
