# 탭별 시안 제출 · 팀장 결재 · AI 분석 — 구현 설계안

> 작성 2026-10-25 · 요청·결정: Min (총괄) · 상태: **설계 확정, 아직 구현 전**
> 원본 토론 문서: https://claude.ai/artifact/Csd6g1Uz6iFkRfdPZg8Wmp · 화면 목업(D안): https://claude.ai/artifact/F3rLS9FrEKjNEDBZi83tw8
> 이 문서를 AI 코딩 도구에 넘길 때는 `CLAUDE.md`, `docs/DB_RULES.md`를 함께 읽게 한다.
> 2026-10-25부터 이 레포 사본(`docs/team-approval-ai-analysis.md`)이 기준이다. 프로젝트 파일의 사본은 참고용이다.

## 1. 한 줄 요약

각 탭(시장 분석 · 리뷰 분석 · 광고 검토)의 결과를 **모든 탭이 같이 쓰는 "시안 → 버전 → 결재" 층**에 올린다. 팀원은 담당 탭에서 버전을 제출하고, 팀장은 결재함에서 버전을 미리 보고 승인·반려하며, AI 분석은 탭별 승인본만 모아서 실행하고 결과를 팀 전체에 공유한다. 기존 탭 테이블(리뷰 분석, 경쟁 제품, `ad_checks`)은 원천 데이터로 그대로 둔다.

## 2. 확정된 결정 (2026-10-25, Min)

| 항목 | 결정 |
| --- | --- |
| 팀장 | 워크스페이스 `owner` = 팀장. owner는 여러 명 둘 수 있다 |
| 탭 담당 | 팀장이 설정 화면에서 멤버별로 담당 탭(권한)을 준다 |
| 담당이 아닌 탭 | 팀원은 **자기 담당 탭에만** 시안을 올릴 수 있다 (화면 + DB 규칙 둘 다 막는다) |
| 팀장 자기 결재 | 허용. 결재 기록에 "자기 결재"로 표시한다 |
| 결재함 | 단순 목록이 아니라 **버전별 미리보기 페이지**에서 내용을 보고 결재한다 |
| 반려 | 반려 사유 필수 |
| AI 분석 결과 | "AI 결과 · 팀장 확인 전" 라벨을 붙이고, 팀장이 확인하면 라벨이 바뀐다 |
| 개발 중 제품 | 진행 표와 시안 대상에서 뺀다 (`sale_status = on_sale`만). 판매를 시작하면 들어온다 |
| 시장 분석 단위 | 제품 단위와 프로젝트(라인) 전체 단위 둘 다 허용 (보완 6 그대로) |
| 데모 범위 | 아래 7장의 1~4단계 |
| 그 밖 | 8장 결점 보완안대로 진행 |

## 3. 전체 흐름

제품 하나 × 탭 하나 = 시안 하나 (예: Deep Skin × 리뷰 분석). 시장 분석은 프로젝트 전체 시안도 가능.

1. **팀원 작업**: 담당 탭에서 분석한 뒤 "시안으로 저장"을 누른다. 한 줄 결론 · 메모 · 근거(리뷰 분석 결과, 경쟁 제품, 광고 검토 건)가 묶여 임시 버전(v1)이 된다.
2. **제출**: "제출"을 누르면 그 버전은 고정된다. 고치려면 새 버전(v2)을 만든다.
3. **팀장 결재**: 결재함에서 버전 미리보기 페이지를 열어 내용 · 근거 · 이전 버전과의 차이를 보고 승인 또는 반려(사유 필수)한다.
4. **반려되면**: 팀원에게 표시되고, 팀원은 사유를 보며 새 버전을 만들어 2번으로 돌아간다.
5. **AI 분석**: 제품을 고르고 탭별 승인본을 하나씩 고른다 (기본값은 최신 승인본). 실행하면 결과와 입력 버전 목록이 저장된다.
6. **공유**: 저장된 AI 분석은 워크스페이스 전원이 본다. 다시 돌리면 새 결과가 쌓이고 이전 결과도 남는다.

## 4. 역할과 권한

| 행동 | 팀원 (member) | 팀장 (owner) |
| --- | --- | --- |
| 담당 탭에서 시안·버전 만들기, 임시 버전 수정·삭제 | 가능 (담당 탭만) | 가능 (모든 탭) |
| 버전 제출, 결재 전 제출 취소 | 자기 버전만 | 가능 |
| 승인 · 반려 | 불가 | 가능 (자기 결재는 표시) |
| 멤버별 담당 탭 설정 | 불가 | 가능 (설정 화면) |
| AI 분석 실행 · 저장 | 가능 | 가능 |
| AI 분석 "팀장 확인" | 불가 | 가능 |
| 모든 시안 · 버전 · AI 분석 읽기 | 가능 | 가능 |

DB 규칙(RLS)으로 강제한다. 기존 `is_member(ws)` · `is_owner(ws)`에 더해 `has_tab(ws, tab)`(멤버가 그 탭 담당인지, owner는 항상 true) 함수를 새로 만든다.

## 5. 새 테이블 (컬럼 계획)

모두 `workspace_id` + RLS, `created_at`/`updated_at`. DB_RULES대로 새 마이그레이션으로만 추가하고 기존 테이블은 이름·타입을 바꾸지 않는다.

| 테이블 | 주요 컬럼 | 역할 |
| --- | --- | --- |
| `member_tabs` | workspace_id, user_id, tab (`market` / `review` / `ad`), granted_by · unique(workspace_id, user_id, tab) | 탭 담당 권한. 팀장이 설정 화면에서 준다 |
| `tab_submissions` (시안) | workspace_id, project_id, product_id (null = 프로젝트 전체, 시장 분석만), tab, title, owner_id, approved_version_id, status (`draft` / `in_review` / `approved` / `rejected`), deleted_at | 제품 × 탭 한 칸. D안 셀이 이 행을 읽는다 |
| `submission_versions` (버전) | workspace_id, submission_id, version_no, author_id, summary (한 줄 결론), body jsonb (탭별 결과 스냅샷), evidence jsonb (근거 id 목록), data_as_of timestamptz (근거 데이터 기준 시각), note, status (`draft` / `submitted` / `approved` / `rejected` / `withdrawn`), submitted_at, deleted_at · unique(submission_id, version_no) | 버전 히스토리. 제출 후 내용 수정 불가 |
| `submission_reviews` (결재 기록) | workspace_id, version_id, reviewer_id, decision (`approved` / `rejected`), reason (반려 시 필수), is_self_review boolean, decided_at | 누가 언제 왜 결재했는지. 지우지 않는다 |
| `ai_analyses` | workspace_id, project_id, product_id, title, input_version_ids uuid[], result jsonb, summary, model, prompt_version, created_by, lead_checked_by, lead_checked_at, deleted_at | AI 분석 결과. 멤버 전원 읽기 |

- `body`의 모양은 탭마다 Zod 스키마 하나로 고정한다 (`lib/schemas/submission.ts`: `MarketBody`, `ReviewBody`, `AdBody`). AI 분석은 이 모양만 읽는다.
- 광고 검토는 같은 제품의 `ad_checks`만 근거로 묶는다. 시안 결재와 원본 약기법 검토는 별개이므로 버전 승인·반려가 `ad_checks.review_status`를 바꾸지 않는다.

## 6. 버전 · 결재 규칙

- **임시 버전 (draft)**: 작성자가 자유롭게 수정·삭제한다.
- **제출된 버전**: 내용 수정 불가. "이 버전에서 새 버전 만들기"로 v+1을 만든다. 결재 전이면 작성자가 제출 취소(withdrawn) 가능.
- **삭제**: 화면의 삭제 = 숨김(`deleted_at`). 승인된 버전과 AI 분석 입력으로 쓰인 버전은 숨길 수도 없다.
- **결재**: 한 시안에 대기 버전이 여럿이면 팀장이 하나를 골라 승인한다. 나머지는 히스토리에 남는다.
- **반려**: 사유가 비면 저장 안 됨. 반려 사유는 다음 버전을 만들 때 화면에 보인다.
- **승인 후 새 버전**: 올릴 수 있다. 새 버전이 승인되기 전까지 이전 승인본이 기준이다.

## 7. 화면과 만드는 순서 (PR 단위)

데모 범위는 1~4단계. 단계마다 PR 하나 (`minseo` → `sub_main`). 1단계 마이그레이션은 총괄이 원격 DB에 적용한 뒤 2단계를 시작한다.

| 단계 | 내용 | 주요 파일 |
| --- | --- | --- |
| 1. 권한 · 테이블 | 위 5개 테이블 마이그레이션 + RLS + `has_tab()`, Zod, mock, `lib/data` 읽기 함수, **설정 화면의 멤버별 담당 탭 설정** | `supabase/migrations/`, `lib/schemas/submission.ts`, `lib/mock/submissions.ts`, `lib/data/submissions.ts`, `settings/` |
| 2. 시안 제출 · 히스토리 | 리뷰 분석 · 광고 검토 결과 화면에 "시안으로 저장 / 제출", 버전 히스토리 패널(보기 · 수정 · 삭제 · 반려 사유). 담당이 아닌 탭에서는 버튼 숨김 | `reviews/`, `ad-check/`, `components/common/submission-*` |
| 3. 팀장 결재함 + 제품 화면 | 결재함 목록 → **버전 미리보기 페이지**(내용 · 근거 · 이전 버전 비교 · 승인/반려). 제품 × 탭 진행 표(D안, 판매 중 제품만) | `app/(internal)/(dashboard)/approvals/`, `projects/` |
| 4. AI 분석 탭 | 제품 선택 → 탭별 승인본 선택(기준 날짜 표시, 차이 30일 넘으면 경고) → 실행 → 저장 · 공유 · 팀장 확인 라벨 | `app/(internal)/(dashboard)/ai-analysis/`, `lib/ai/integrated-analysis/`, `prompts/integrated-analysis.v1.md` (호출은 `callAi`, 정밀 등급) |
| 5. 나중에 | 시장 분석 탭 연결, 대리 결재자, 알림, "새 데이터 있음" 표시 | |

## 8. 구조의 결점과 보완 (채택)

| # | 결점 | 보완 |
| --- | --- | --- |
| 1 | 버전을 자유롭게 수정·삭제하면 결재 내용과 AI 근거가 사라짐 | 제출 후 고정, 수정 = 새 버전, 삭제 = 숨김, 승인본·AI 입력 버전은 숨김도 막음 |
| 2 | 탭별 결재본을 각각 고르면 시점이 다른 결론이 섞임 | 선택 화면에 버전별 `data_as_of` 표시, 30일 넘게 차이 나면 경고, 기본값은 최신 승인본 |
| 3 | 결재 뒤 새 리뷰·랭킹이 들어와도 승인본은 옛 결론 | `data_as_of` 이후 새 데이터가 있으면 "새 데이터 있음" 표시 (5단계) |
| 4 | 팀장 한 사람에게 결재가 몰림 | owner 여러 명 허용, 대기 2일 넘으면 홈에 표시, 대리 결재자는 5단계 |
| 5 | 팀장이 자기 작업을 결재 | 허용하되 `is_self_review`로 표시 |
| 6 | 시장 분석은 제품 단위가 아닐 때가 많음 | `product_id` 비우면 프로젝트 전체 시안. AI 분석은 둘 다 읽음 |
| 7 | 팀장 결재가 약기법 검토를 대신하는 것처럼 보임 | 위험 high 또는 전문가 검토 요청이 있으면 승인 버튼 옆 경고 + 확인 체크 필수 |
| 8 | AI 분석 결과에 확인 단계가 없음 | "AI 결과 · 팀장 확인 전" 라벨, 결과 문장마다 근거 버전 링크 |

## 9. 지키는 규칙 (팀원 · AI 도구 공통)

- DB 변경은 새 마이그레이션 파일로만, 원격 적용은 총괄만 (`docs/DB_RULES.md`).
- 새 테이블은 Zod · mock · data · 마이그레이션 4곳을 같은 PR에서 맞춘다.
- AI 호출은 `lib/ai/`의 `callAi`로만, 프롬프트는 `prompts/`에만.
- 개발 중 제품(`sale_status = in_development`)은 시안 · 진행 표 · AI 분석 대상에서 뺀다.
- 자사 제품명은 `lib/own-products.ts` 상수만 쓴다.

## 10. AI 분석 프롬프트 설계 — 나중에 고칠 수 있게 (2026-10-25, Min 요청)

목표: 팀이 분석 관점·말투·금지 사항을 바꾸고 싶을 때 **프롬프트 파일만 새 버전으로 만들면** 되게 한다. 코드·DB를 고치는 일은 입력·출력의 모양이 바뀔 때뿐이다.

**파일과 버전**
- 원문: `apps/web/prompts/integrated-analysis.v1.md` (초안이 이미 있다. 4단계 PR에서 확정한다).
- 읽기: 기존 `loadPrompt("integrated-analysis", 버전)` (`lib/ai/prompts.ts`). 머리말(`---` 앞)은 사람용 설명이고 본문만 보낸다.
- 쓰는 버전: `lib/ai/integrated-analysis/config.ts`의 상수 `PROMPT_VERSION` 한곳. 고칠 때는 v1을 v2로 복사해 고치고 이 상수만 바꾼다. 이미 쓴 버전 파일은 고치지 않는다 (결과 재현을 위해).
- 결과 행 `ai_analyses.prompt_version`에 `integrated-analysis.v2`처럼 남는다. 화면은 결과마다 버전을 작게 보여준다.

**프롬프트 안을 두 구역으로 나눈다**

| 구역 | 절 | 고칠 때 |
| --- | --- | --- |
| 자유 구역 | `#역할`, `#분석 관점`, `#말투`, `#하지 말 것`, `#예시` | 새 버전 파일만 만든다. 코드 수정 없음 |
| 고정 구역 | `#입력 형식`, `#출력 형식` | 같은 PR에서 입력 조립 코드와 Zod를 함께 고친다 |

**분석 관점은 데이터로 둔다**
- `#분석 관점` 절의 한 줄 = 관점 하나: `- key: positioning · 이름: 포지셔닝 · 설명: …`.
- 코드(`lib/ai/integrated-analysis/prompt.ts`)는 이 줄들을 읽어 관점 목록(key · 이름)을 만든다. 이 목록으로 (1) AI 응답의 `sections[].key`가 프롬프트와 같은지 검사하고, (2) 화면의 섹션 제목을 정한다. 그래서 관점을 더하거나 빼도 화면 코드는 그대로다.
- 출력 Zod(`lib/schemas/ai-analysis.ts`)는 관점 이름을 모르는 일반 모양이다: `sections: [{ key, title, points: [{ text, basis: string[] }] }]`, `conflicts`, `data_gaps`, `actions: [{ text, tab, priority, basis }]`, `summary`.
- 한 번 결과에 쓴 key의 뜻은 바꾸지 않는다. 뜻이 바뀌면 새 key를 쓴다 (예전 결과와 섞이지 않게).
- 본문에 `#분석 관점`·`#출력 형식` 절이 없거나 관점 줄을 하나도 못 읽으면 호출 전에 오류를 낸다 (리뷰 분석 `buildSystemPrompt`와 같은 방식).

**근거 연결**
- 입력의 각 승인본에 `ref`(예: `review@v2`)를 붙여 보내고, 결과의 `basis`는 이 ref만 쓰게 한다. 코드는 응답의 ref를 `input_version_ids`의 실제 버전 ID로 바꿔 저장하고, 입력에 없는 ref가 오면 그 문장을 버리지 않고 "근거 확인 필요"로 표시한다 (보완 8).

**나중에 (5단계 이후)**
- 화면에서 팀장이 관점을 고르는 기능: 관점 목록이 데이터라서, 실행할 때 고른 key만 프롬프트에 남기는 방식으로 붙일 수 있다.
- 워크스페이스별 프롬프트: 필요해지면 `ai_prompt_versions` 같은 테이블을 따로 설계한다. 지금은 파일 버전만 쓴다.

