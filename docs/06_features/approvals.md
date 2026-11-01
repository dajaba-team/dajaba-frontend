# approvals — 승인함·승인·반려

> v0.1 · 2026-10-31 · 초안(팀 확인 중) · 정리 지윤

- 프론트 폴더: `src/features/approvals/` · 백엔드 짝: `str` 승인 API (BE `06_features/str.md`)
- 지금: 시연(`/demo/approvals`, APPROVER 역할)만. 실제 화면 없음.

## 1. 화면

| 경로 〔제안〕                                 | 보이는 것                                                 | 누가                    |
| --------------------------------------------- | --------------------------------------------------------- | ----------------------- |
| `/approvals`                                  | 승인 대기 케이스·초안 목록                                | APPROVER, ADMIN(조회만) |
| `/approvals/:draftId` 또는 STR 화면 읽기 전용 | 대상 초안·수정본·최신 검증·이전 반려 사유, 승인·반려 버튼 | APPROVER                |

- 메뉴는 APPROVER·ADMIN에게만. ADMIN에겐 버튼 없이 목록만.
- **담당 조사역 본인이었던 케이스엔 승인·반려 버튼을 숨겨요.** 서버도 409 `SELF_APPROVAL`로 막아요.

## 2. 버튼 [BE flows 06, 안건 24]

| 케이스 상태        | 승인자 버튼                                     |
| ------------------ | ----------------------------------------------- |
| `PENDING_APPROVAL` | 승인 · 반려(보완 요청) · 반려(보고 안 함)       |
| `APPROVED`         | 모의 제출 (→ `REPORTED`) 〔초안 — 서식 안건 4〕 |
| 그 밖              | 없음                                            |

- 반려는 **`reason_code`(`NEED_REVISION` / `NOT_REPORTABLE`) + `comment` 둘 다 필수**. 없으면 400 — 화면에서 먼저 막고 서버 400도 입력칸에 표시. comment 최대 2,000자.
- 승인·반려 모두 확인 단계. 성공 응답 뒤 상세를 다시 불러 `APPROVED`·`LOCKED`를 확인해요(낙관적 변경 없음).

## 3. API

| #    | API                                                                        | 비고                                       |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------ |
| 16   | `GET /approvals`                                                           | GET은 ADMIN·APPROVER (10/29 메서드별 권한) |
| 7    | `POST /approvals/{draft_id}/approve`                                       | APPROVER, 담당 본인 제외                   |
| 8    | `POST /approvals/{draft_id}/reject` `{case_version, reason_code, comment}` | APPROVER                                   |
| 12-2 | `POST /approvals/{draft_id}/report`                                        | 모의 제출 〔초안〕                         |

경로 번호는 **`{draft_id}`** 로 정해졌어요(BE 미결 1, 10/30). 예전 프론트 문서·CASES 명세의 `{case_no}` 안은 쓰지 않아요.

## 4. 테스트에 있어야 하는 것

자기 승인 버튼 숨김 + 직접 호출 409 `SELF_APPROVAL`, 반려 코드·사유 없으면 막힘, 승인 뒤 잠금 표시, ADMIN은 목록만, 승인 사이 다른 사람이 먼저 처리했을 때 409 안내 + 재조회.
