# approvals — 승인함·승인·반려

> v0.1 · 2026-10-31 · 초안(팀 확인 중) · 정리 지윤

- 프론트 폴더: `src/features/approvals/` · 백엔드 짝: `str` 승인 API (BE `06_features/str.md`)
- **실제 화면 `/approvals` — 구현됨 (SCRUM-241, 11/13).** 승인 대기 목록(P1)·승인(P2)·반려(P3)를 BE `ApprovalController`(SCRUM-217~219)에 붙였어요. 반려는 [보완 요청]/[보고 안 함] 두 버튼으로 나눴어요(SCRUM-113 내용 포함). 승인 완료 뒤 모의 제출 화면은 SCRUM-111(BE P4 SCRUM-240 뒤).
- **승인 완료 화면 `/approvals/:draftNo` — 구현됨 (SCRUM-111, 11/14, BE P4·S7·S8·P5 전이라 MSW).** 승인하면 여기로 와요. APPROVED: 마감 배지 · "제출 전" PDF 미리보기(S7, 화면 안 iframe) · [모의 제출](P4, 확인창). REPORTED: 모의 제출 시각 · [확정본 PDF 받기](S8) · 409 `REPORT_PDF_NOT_READY`의 `details.pdf_status`가 `PENDING`이면 "만드는 중", `FAILED`면 [PDF 다시 만들기](P5).
    - **마감 배지**(`model/deadline.js`): 승인한 한국 날짜의 다음 영업일이 1일째, **3영업일째 23:59**. 영업일은 월~금, **공휴일 미반영**을 배지에 같이 써요. 〔미결 — 서식 안건 1〕 서버가 마감을 주게 되면 그 값으로 바꿔요.
    - 승인 시각은 케이스 상세 이력의 `APPROVE` 행, 의심 정도는 S2(`suspicion_level_branch`·`_hq`)에서 읽어요. PDF 상태를 미리 알려 주는 API는 아직 없어요.
    - **〔확인 필요 — SCRUM-240〕 버튼은 지금 역할(APPROVER)·케이스 상태로 켜요** — 승인 뒤 동작은 서버 `available_actions`가 아직 없어서예요. 서버가 다시 검사하고, 액션 목록이 생기면 그걸로 바꿔요.
    - 이 경로는 승인자·관리자만 열려요. 관리자는 PDF 권한이 없어(BE `04_auth_user.md` 12-1·12-1a) 상태만 봐요. 담당 조사역의 PDF는 STR 화면 몫.
- 시연(`/demo/approvals`)은 없앨 예정이라 고치지 않아요.
- 코드: `api/approvalsApi.js`(P1~P3) · `hooks/useApprovals.js`(목록·작업 — 성공·409 뒤 승인함·케이스·초안 재조회) · `pages/ApprovalListPage.jsx` · `components/ApprovalDialog.jsx`(승인·반려 확인창). MSW는 `src/mocks/approvals.js` — 테스트는 `resetCases(user, { pendingApproval: true })`로 케이스 1001을 승인 대기로 둬요(기본 시드 4건은 그대로).

## 1. 화면

| 경로 〔제안〕                                 | 보이는 것                                                 | 누가                    |
| --------------------------------------------- | --------------------------------------------------------- | ----------------------- |
| `/approvals`                                  | 승인 대기 케이스·초안 목록                                | APPROVER, ADMIN(조회만) |
| `/approvals/:draftNo` 또는 STR 화면 읽기 전용 | 대상 초안·수정본·최신 검증·이전 반려 사유, 승인·반려 버튼 | APPROVER                |

- **지금 구현:** 목록 한 줄에 초안 번호·케이스(→ [초안 보기]로 STR 화면 `/cases/:caseNo/str`)·담당 조사역·승인 요청 시각·최신 검증(상태·수정본)·지난 반려(이 초안 기준)와 버튼. 별도 상세(`/approvals/:draftNo`)는 만들지 않았어요 — 본문은 STR 화면에서 봐요. STR 화면의 승인 버튼은 SCRUM-224(채영).
- 버튼은 서버 `available_actions`(`APPROVE`·`REJECT`)만 보고 켜요. 서버는 승인자이고 담당한 적 없을 때만 줘요 — `was_assignee`면 "내가 담당했던 케이스라 승인·반려할 수 없어요" 안내만.

- 메뉴는 APPROVER·ADMIN에게만. ADMIN에겐 버튼 없이 목록만.
- **담당 조사역 본인이었던 케이스엔 승인·반려 버튼을 숨겨요.** 서버도 409 `SELF_APPROVAL`로 막아요.

## 2. 버튼 [BE flows 06, 안건 24]

| 케이스 상태        | 승인자 버튼                                     |
| ------------------ | ----------------------------------------------- |
| `PENDING_APPROVAL` | 승인 · 반려(보완 요청) · 반려(보고 안 함)       |
| `APPROVED`         | 모의 제출 (→ `REPORTED`) 〔초안 — 서식 안건 4〕 |
| 그 밖              | 없음                                            |

- 반려는 **`reason_code`(`NEED_REVISION` / `NOT_REPORTABLE`) + `comment` 둘 다 필수**. 없으면 400 — 화면에서 먼저 막고 서버 400도 입력칸에 표시. comment 최대 2,000자.
- 승인은 **본점 의심 정도 `suspicion_level_hq` 1~5 필수, 기본값 없음**(BE `ApproveStrDraftRequest`, 계약서 5.5). 고르기 전엔 [승인]이 꺼져 있어요.
- 승인·반려 모두 확인 단계. 성공 응답 뒤 상세를 다시 불러 `APPROVED`·`LOCKED`를 확인해요(낙관적 변경 없음).

## 3. API

| #    | API                                                                        | 비고                                               |
| ---- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| 16   | `GET /approvals`                                                           | GET은 ADMIN·APPROVER (10/29 메서드별 권한)         |
| 7    | `POST /approvals/{draft_no}/approve` `{case_version, suspicion_level_hq}`  | APPROVER, 담당 본인 제외                           |
| 8    | `POST /approvals/{draft_no}/reject` `{case_version, reason_code, comment}` | APPROVER                                           |
| 12-2 | `POST /approvals/{draft_no}/report` `{case_version}`                       | 모의 제출 — BE 아직 없음(SCRUM-240), MSW           |
| S7   | `GET /str-drafts/{draft_no}/report/preview.pdf`                            | 제출 전 미리보기(APPROVED) — MSW                   |
| S8   | `GET /str-drafts/{draft_no}/report.pdf`                                    | 확정본(REPORTED), 409 `REPORT_PDF_NOT_READY` — MSW |
| P5   | `POST /approvals/{draft_no}/report/pdf` → 202 `{pdf_status}`               | PDF `FAILED`일 때만 — MSW                          |

경로 번호는 초안 번호로 정해졌고(BE 미결 1, 10/30), 이름은 **`{draft_no}`**(`DRF-` + 6자리)예요(계약서 2.2, 11/4 채영). 예전 프론트 문서·CASES 명세의 `{case_no}` 안은 쓰지 않아요.

## 4. 테스트에 있어야 하는 것

`src/test/approvalDone.test.jsx`·`deadline.test.js`(SCRUM-111) — 승인 뒤 이동·마감 배지·미리보기·모의 제출·확정본·PDF 실패·만드는 중·409·관리자·승인 전 초안. `src/test/approvals.test.jsx`(SCRUM-241) — 승인자 목록·버튼, 관리자 목록만, 예전 담당 안내, 의심 정도 없이 승인 막힘, 반려 사유 공백 막힘, 409 `CONCURRENT_UPDATE` 안내 + 입력 유지 + 재조회, 409 `SELF_APPROVAL` 문구. 아래 "승인 뒤 잠금 표시"는 STR 화면 몫(SCRUM-224).

자기 승인 버튼 숨김 + 직접 호출 409 `SELF_APPROVAL`, 반려 코드·사유 없으면 막힘, 승인 뒤 잠금 표시, ADMIN은 목록만, 승인 사이 다른 사람이 먼저 처리했을 때 409 안내 + 재조회.
