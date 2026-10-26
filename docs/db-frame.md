# Leafn 현재 DB 지도

> 상태: **현재 DB 기준** · 처음 초안 2026-10-22 · 2026-10-25에 실제 마이그레이션 17개 기준으로 다시 씀 (정리 전 초안: [archive/pre_db-frame.md](archive/pre_db-frame.md))
> 기준의 우선순위: `supabase/migrations/`의 실제 파일 → 이 문서 → [CLAUDE.md](../CLAUDE.md) 5장(테이블 목록). 이 문서와 마이그레이션이 다르면 마이그레이션이 맞고 이 문서를 고친다.
> 작업 절차는 [DB_RULES.md](DB_RULES.md), 화면별 연결 상태는 [DATA_CONNECTIONS.md](DATA_CONNECTIONS.md).

## 0. 이 문서의 범위

지금 원격 DB(Supabase 프로젝트 `Leaf&`)에 있는 테이블과 핵심 칸, 관계, RLS 규칙을 한곳에 모은다. 칸 하나하나의 제약(check 값, 길이)은 마이그레이션 파일을 본다.

- 모양이 일정하지 않은 값(수집 원본, AI 결과 목록)은 `jsonb` 칸 하나 + Zod로 모양을 고정한다. 화면에서 자주 쓰게 되면 새 마이그레이션으로 칸을 꺼낸다.
- 화면은 `lib/data/` 함수만 부른다. Supabase 환경 변수가 없을 때만 `lib/mock/` 샘플을 쓴다.

## 1. 공통 규칙

| 항목 | 규칙 |
| --- | --- |
| PK | `id uuid default gen_random_uuid()` (`profiles.id`만 `auth.users.id`) |
| 공통 칸 | `id`, `created_at timestamptz default now()`. 수정되는 테이블은 `updated_at` + `set_updated_at()` 트리거 |
| 팀 데이터 | 모든 테이블에 `workspace_id uuid not null references workspaces on delete cascade` + RLS. 공용 테이블은 지금 없다 |
| 같은 팀 FK | 다른 팀 행을 가리키지 못하게 `(x_id, workspace_id)` 복합 FK를 쓴다. 대상 테이블에 `unique (id, workspace_id)` |
| 수집 데이터 | `platform_id`(또는 `reviews.source`), `external_id`, 원본 `raw`/`source_raw jsonb`, `collected_at` + 팀 단위 unique 키 |
| 플랫폼 | `platform_id text` (FK 없음). slug는 코드 상수 `apps/web/lib/platforms.ts` (`qoo10`, `rakuten`). 데모는 `qoo10`만 |
| AI 결과 | `model`, `prompt_version` 필수 |
| 고정 값 목록 | Postgres enum 대신 `text` + `check (... in (...))` |
| 이름 | 테이블은 복수형 snake_case, FK는 `<단수>_id` |

## 2. 테이블 (31개)

### 기반 (`20261022082907_base_workspaces.sql`)

| 테이블 | 핵심 칸 | 비고 |
| --- | --- | --- |
| `profiles` | id = auth.users.id, display_name, title | 가입하면 `handle_new_user()` 트리거가 만든다. 같은 팀원끼리만 읽는다 |
| `workspaces` | name, invite_code (10자, 자동) | 만들기·참여는 `create_workspace()`, `join_workspace()` 함수로만 |
| `workspace_members` | workspace_id, user_id → profiles, role (`owner` = 팀장 · `member`) | `unique (workspace_id, user_id)`. owner는 여러 명일 수 있다 |

함수: `is_member(ws)`, `is_owner(ws)`, `shares_workspace(other)`, `set_updated_at()`, `set_updated_by()`.

### 프로젝트 · 제품 (`20261023202113_create_products_reviews.sql`, `20261024104911_projects_products.sql`)

워크스페이스(팀) → 프로젝트(제품군, 예: Leaf& Dew) → 제품. 화면 헤더에서 프로젝트를 고르고, 그 안의 제품은 탭을 나누지 않고 한 화면에서 다룬다 (2026-10-24 총괄 결정).

| 테이블 | 핵심 칸 | 비고 |
| --- | --- | --- |
| `projects` | name, platform_id, description, created_by → profiles, updated_at | `unique (workspace_id, name)` |
| `products` | kind (`own` · `competitor`), brand, name, category, platform_id, external_id, url, price_jpy, price_kind (`regular` · `sale`), volume_ml, ingredients `text[]`, features `text[]`, image_path, source_raw `jsonb`, collected_at, **project_id**, **sale_status** (`on_sale` · `in_development`), **skin_line** (`dry` · `oily` · `combo`), **title_ai** `jsonb` | `unique (workspace_id, platform_id, external_id)`. 자사 제품은 project_id로 프로젝트에 속하고, 프로젝트를 지우면 project_id만 null. 한 프로젝트 안에서 제품 이름은 겹치지 않는다. 자사 규격(일본어명·제형·용기 등)은 `source_raw.spec`. `title_ai`는 경쟁 제품의 긴 제목을 AI가 정리한 결과 `{brand_ko, name_short_ja, name_ko, volume, key_ingredient_ja, key_ingredient_ko, model, prompt_version}`이고 null이면 정리 전(화면은 원문 `name`을 보여 준다). 수집 저장(`save_collection_run`)은 이 칸을 덮어쓰지 않는다 |
| `product_competitors` | own_product_id → products, competitor_product_id → products | `unique (own_product_id, competitor_product_id)`. 수집 저장(`save_collection_run`)이 만든다 |

- `skin_line`은 제품이 겨냥하는 피부 라인이다. 설문의 `skin_type`(진단 결과, 5종)과는 다른 값이다.
- 개발 중 제품(`sale_status = in_development`)은 진행 표·시안·AI 분석 대상이 아니다.
- 시작 데이터: `supabase/seeds/projects_leaf_dew.sql`(프로젝트 1 + 자사 6종), `leaf_dew_product_specs.sql`(규격).

### 리뷰 · 수집 (`20261023202113`, `20261023202213`, `20261023211500`, `20261024010000`, `20261024020000`, `20261024030000`, `20261024040000`)

| 테이블 | 핵심 칸 | 비고 |
| --- | --- | --- |
| `reviews` | product_id → products, source (`cosme` · `rakuten` · `qoo10` · `oliveyoung` · `csv`), external_id, lang (`ko` · `ja`), rating, rating_scale, body, **body_ko** (일본어 리뷰의 한국어 번역), reviewer_attrs `jsonb`, posted_at, raw, collected_at, **excluded_reason** | `unique (workspace_id, source, external_id)`. excluded_reason이 있으면(배송·파손 등 제품 외 불만) 분석·집계에서 뺀다 |
| `review_analyses` | review_id → reviews (unique), sentiment, keywords `jsonb` [{text, category}], pain_points, repurchase_factors, topics `jsonb`, model, prompt_version | 리뷰 한 건 = 분석 한 행 |
| `collection_runs` | created_by, platform_id, category, own_product_id, top_n, **stars** `smallint[]`(가져올 별점), max_star, review_limit(별점마다), status (`queued` · `running` · `ready` · `saved` · `failed`), error, started_at·finished_at·saved_at, saved_count | 화면의 "경쟁 제품 불러오기" 요청. 수집기(`--worker`)가 집어 간다 |
| `collection_run_products` | run_id → collection_runs, rank, external_id, brand, title, url, status, read_count, skipped_known, stop_reason, site_total_count, site_low_count, site_low_count_exact, star_counts `jsonb`, saved_count, product_id | 요청 하나의 랭킹 상품별 진행 |
| `collection_staged_reviews` | run_product_id → collection_run_products, external_id, lang, rating, body, body_ko, raw, excluded_reason | 저장 전 임시 리뷰. `save_collection_run()`이 products·reviews·product_competitors로 옮긴다 |
| `collection_run_skipped` | run_id, rank, external_id, title, reason (`set` · `multi_type` · `not_toner`) | 수집에서 뺀 랭킹 상품과 이유 |

`review_insights`는 테이블로 만들지 않았다. `review_analyses`에서 계산하고 근거 리뷰 ID를 함께 돌려준다 (`DATA_CONNECTIONS.md`).

### 광고 검토 (`20261024130000_create_ad_checks.sql`, `20261024172221_harden_ad_review_writes.sql`)

결정의 이유는 [tab3-db-plan.md](tab3-db-plan.md).

| 테이블 | 핵심 칸 | 비고 |
| --- | --- | --- |
| `ad_checks` | created_by (기본 auth.uid()), source (`manual` · `content_guide`), input_text, input_lang, usage, product_category, product_id, promo_event_id, overall_risk, overall_action (`must_fix` · `should_fix` · `expert` · `ok`), review_status (`pending` · `approved` · `rejected`), reviewer_id, reviewer_note, reviewed_at, final_text, is_expert_review_requested, model, prompt_version, deleted_at, content_guide_id → content_guides (만든 가이드에서 온 검토) | 판정할 때 자동 저장. 새 행은 `pending`으로만 시작. 승인·반려(update)는 **owner만**. 삭제 = 숨김(`deleted_at`), delete 정책 없음 |
| `ad_check_lines` | ad_check_id → ad_checks, line_index, block_key, original, action, findings `jsonb`, ingredient_check, translated_text, back_translation_ko, localized_note | 검토 한 건의 줄별 판정. update는 owner만, delete 정책 없음 |
| `content_guides` | created_by, product_id, promo_event_id, channel (`qoo10_detail` · `instagram` · `x` · `banner`), post_type (`general` · `mega_sale` · `season`), input·title·body·lint_hits `jsonb`, ad_check_id, parent_id → content_guides (수정본의 원본), memos `jsonb` (블록별 메모), model, prompt_version | 콘텐츠 제작 가이드 결과물. 작성자 = 로그인 사용자로 강제. update·delete는 owner만. 메모는 멤버 누구나 `set_content_guide_memos()` 함수로 memos 칸만 바꾼다. 수정본은 새 행(원본은 남김) |

| `review_translations` | created_by (기본 auth.uid()), review_id → reviews (unique), ad_check_id → ad_checks, text_ja, status (`draft` · `approved`), updated_at | 국내 리뷰 한 건의 일본어 번역(상세페이지용, F). 번역은 광고 검토 AI가 낸 `ad_check_lines.translated_text`이고, 번역 한 건마다 `ad_checks` 한 건(source `manual`, usage `detail_page`)이 함께 생긴다. 승인 상태는 그 검토의 `review_status`가 기준(owner가 광고 검토 화면에서 변경). 멤버가 읽기·쓰기·삭제. 리뷰를 지우면 번역도 함께 지워지고, 검토를 지우면 `ad_check_id`만 null |

제품·행사·검토를 가리키는 칸은 참고 링크라서, 그쪽이 지워지면 그 칸만 null이 된다 (`on delete set null (칸)`).

### 시장 (`20261023030834`, `20261023030835`, `20261023050041`, `20261023064526`)

| 테이블 | 핵심 칸 | 비고 |
| --- | --- | --- |
| `trend_snapshots` | source (`rakuten_ranking` · `qoo10_ranking`), category, captured_at, data `jsonb` | 팀 데이터 (초안의 "공용" 안은 쓰지 않았다). 데모는 `qoo10_ranking` |
| `search_snapshots` | engine (`google_autocomplete` · `google_trends`), seed, gl, hl, captured_at, suggestions `jsonb` [{value, position, relevance}] | SerpApi 결과 |
| `geo_snapshots` | engine (`chatgpt` · `claude` · `gemini` · `perplexity`), model, prompt_version, category, query, query_concern, run_index, answer, brands_mentioned `text[]`, brand_mentions·citations·keywords `jsonb`, captured_at | AI 검색 응답 측정 |

### 캘린더 (`20261023030000_launch.sql`, 2026-10-23 확정)

"진출 실행" 탭은 2026-10-24에 없앴고, 캘린더는 홈으로 옮겼다. 테이블은 그대로 쓴다.

| 테이블 | 핵심 칸 | 비고 |
| --- | --- | --- |
| `promo_events` | platform_id (자사 캠페인이면 null), kind (`platform_event` · `own_campaign`), title, start_date, end_date, is_confirmed, source_url, memo, created_by | `unique (id, workspace_id)`. is_confirmed = false는 과거 패턴으로 넣은 예상 일정 |
| `promo_milestones` | promo_event_id, label, due_date, done_at | 행사 하나의 준비 마감들. `(promo_event_id, workspace_id)` 복합 FK. 화면의 "준비 마감"은 가장 이른 미완료 마감이다 (칸 `prep_due_date`는 두지 않음) |
| `platform_notes` | platform_id, status (`reviewing` · `preparing` · `live`), strengths, audience, fees_note, fees_source_url, fees_checked_at, memo, updated_by | `unique (workspace_id, platform_id)`. **화면 없음** (플랫폼별 강점 화면 제거). 확장용으로 남긴다 |

캘린더의 추가·마감 변경은 아직 DB에 저장하지 않는다 (`lib/data/launch-actions.ts`).

### 소비자 설문 (`20261023030815_survey.sql`)

| 테이블 | 핵심 칸 | 비고 |
| --- | --- | --- |
| `surveys` | public_slug (unique), title_ja, questions `jsonb`, is_open | 공개 링크 → 어느 팀 설문인지 찾는 용도. 열린 설문은 누구나 읽는다 |
| `survey_responses` | survey_id, answers `jsonb`, age_group, skin_type (`dry` · `oily` · `combo` · `inner_dry` · `normal`), is_sensitive, score_* 4개, concerns, concern_other(기타 직접 입력), concern_other_ko(그 한국어 번역, null = 번역 전), source(유입 경로), consent_at, consent_version, locale | anon은 열린 설문에 insert만. 18세 이상·동의한 응답만 |
| `survey_minor_counts` | survey_id, count_date, count | 18세 미만은 답을 저장하지 않고 날짜별 수만 센다 (`record_survey_minor()`) |
| `survey_reco_events` | survey_id, product_line, event (`shown` · `buy_click` · `notify_open`), skin_type, source(유입 경로, null = 없음) | 추천 노출·구매 클릭·출시 예정 화면 열기 횟수. `notify_open`은 알림 신청이나 고유 인원 수가 아니다. anon insert만 |

공개 설문 제출은 아직 보내지 않는다 (`app/(public)/survey/_lib/submit.ts`). 집계 화면은 DB를 읽는다.

### 탭별 시안 · 팀장 결재 · AI 분석 (`20261025115007_team_approval.sql` 및 후속 무결성 마이그레이션)

설계와 결정의 이유는 [team-approval-ai-analysis.md](team-approval-ai-analysis.md). Zod는 `lib/schemas/submission.ts`, `lib/schemas/ai-analysis.ts`.

| 테이블 | 핵심 칸 | 비고 |
| --- | --- | --- |
| `member_tabs` | user_id, tab (`market` · `review` · `ad`), granted_by | 멤버별 담당 탭. `(workspace_id, user_id)` → workspace_members 복합 FK라 팀에서 나가면 같이 지워진다. 주고 거두기는 owner만. owner는 행이 없어도 모든 탭 담당 (`has_tab()`) |
| `tab_submissions` | project_id, product_id (비우면 프로젝트 전체, 시장 분석만), tab, title, owner_id, approved_version_id → submission_versions, status (`draft` · `in_review` · `approved` · `rejected`), deleted_at | 시안 = 제품 × 탭 한 칸. 같은 칸에 숨기지 않은 시안은 하나 (`nulls not distinct` 부분 unique). 판매 중 제품만 (insert 트리거). status는 함수가 버전 상태로 다시 계산한다 |
| `submission_versions` | submission_id, version_no, author_id, summary(한 줄 결론), body `jsonb`(탭별 스냅샷), evidence `jsonb` [{kind, id}], data_as_of, note, status (`draft` · `submitted` · `approved` · `rejected` · `withdrawn`), submitted_at, deleted_at | 번호는 insert 트리거가 매긴다. 광고 근거는 같은 팀·제품만 허용한다. 제출 후 내용 수정 불가, 승인본·AI 입력 버전은 숨김 불가 |
| `submission_reviews` | version_id, reviewer_id, decision (`approved` · `rejected`), reason(반려면 필수), is_self_review, decided_at | 결재 기록. `decide_version()`으로만 쓰고 지우지 않는다 |
| `ai_analyses` | project_id, product_id, title, input_version_ids `uuid[]`, result `jsonb`, summary, model, prompt_version, created_by, lead_checked_by, lead_checked_at, deleted_at | 입력은 같은 팀·프로젝트·제품의 승인된 버전만. 결과 저장은 인증된 서버 작업의 service role만, 멤버는 읽기만. 팀장 확인 전이면 화면에 라벨 |

- 시안이 있는 프로젝트·제품은 지우지 못한다 (복합 FK, on delete 기본값). 결재 기록을 지키기 위해서다.
- 상태 바꾸기는 함수로만 한다: `submit_version()`, `withdraw_version()`, `decide_version()`, `hide_version()`, `hide_submission()`, `check_ai_analysis()`, `hide_ai_analysis()`. 시안 결재는 원본 `ad_checks`의 약기법 검토 상태를 바꾸지 않는다.

## 3. 아직 없는 테이블

| 테이블 | 상태 |
| --- | --- |
| `platforms` | slug 기준표. 만들면 `platform_id` 칸들에 FK를 새 마이그레이션으로 추가한다 (칸 이름은 그대로) |
| `activity_log` | 홈 활동 기록. 지금은 실제 모드에서 표시하지 않는다 |
| `review_insights` | 만들지 않기로 함 (계산값) |

## 4. 관계 요약

```
workspaces ─┬─ workspace_members ──┬─ profiles (= auth.users)
            │                      └─ member_tabs
            ├─ projects ── products (project_id, 자사)
            ├─ products ──┬─ product_competitors (자사 ↔ 경쟁)
            │             ├─ reviews ── review_analyses
            │             ├─ ad_checks ── ad_check_lines
            │             └─ content_guides
            ├─ collection_runs ──┬─ collection_run_products ── collection_staged_reviews
            │                    └─ collection_run_skipped
            ├─ promo_events ──┬─ promo_milestones
            │                 └─ ad_checks · content_guides (promo_event_id)
            ├─ platform_notes
            ├─ trend_snapshots · search_snapshots · geo_snapshots
            ├─ surveys ──┬─ survey_responses
            │            ├─ survey_minor_counts
            │            └─ survey_reco_events
            └─ projects · products ──┬─ tab_submissions ── submission_versions ── submission_reviews
                                     │                     (evidence → reviews · products · ad_checks · trend_snapshots)
                                     └─ ai_analyses (input_version_ids → submission_versions)
```

## 5. RLS 패턴

기본: 팀 테이블마다 정책 4개를 `is_member(workspace_id)`로 건다.

```sql
alter table products enable row level security;
create policy "members read"   on products for select using (is_member(workspace_id));
create policy "members insert" on products for insert with check (is_member(workspace_id));
create policy "members update" on products for update using (is_member(workspace_id));
create policy "members delete" on products for delete using (is_member(workspace_id));
```

예외 (지금 DB에 있는 것):

- `workspaces`: 읽기는 멤버, 수정·삭제는 owner. 만들기·참여는 함수로만
- `workspace_members`: 읽기는 멤버, 수정은 owner, 삭제는 owner 또는 본인
- `profiles`: 본인과 같은 팀원만 읽기, 수정은 본인
- `ad_checks`·`ad_check_lines`: update는 `is_owner`, delete 정책 없음. 새 검토는 `pending`으로만 insert (restrictive 정책)
- `content_guides`: update·delete는 `is_owner`, 작성자 = 로그인 사용자 (restrictive 정책)
- `surveys`: 열린 설문은 누구나 읽기. `survey_responses`·`survey_reco_events`는 anon insert(열린 설문일 때)만, 읽기는 멤버
- 수집기(Python)는 service role 키로 RLS를 우회해 쓴다. 대신 `workspace_id`를 코드에서 꼭 넣는다
- 결재 공통 층은 `has_tab(ws, tab)`(담당 탭인지, owner는 항상 true)을 더한다. 읽기는 멤버 모두이되, 버전과 결재 기록은 팀장만 전부 읽는다 (아래). 쓰기는 이렇게 좁힌다:
  - `member_tabs`: insert·delete는 owner
  - `tab_submissions`: insert는 담당 탭에서 본인 이름으로. update·delete 정책 없음 (함수로만)
  - `submission_versions`: 읽기는 owner 전부, 팀원은 자기 버전과 승인본만 (`20261026180000`, 결재함은 팀장만). insert는 담당 탭의 숨기지 않은 시안에 본인 이름으로, update는 임시 버전만 작성자(담당 탭일 때)나 owner. delete 정책 없음
  - `submission_reviews`: 읽기는 owner 전부, 팀원은 읽을 수 있는 버전(자기 버전 · 승인본)의 기록만. 쓰기 정책 없음 (`decide_version()`으로만)
  - `ai_analyses`: 멤버는 읽기만. insert는 서버의 service role로만, 팀장 확인·숨김은 함수로만

## 6. 마이그레이션 파일 (적용 순서)

| 파일 | 내용 |
| --- | --- |
| `20261022082907_base_workspaces.sql` | profiles, workspaces, workspace_members, 함수들 |
| `20261023030000_launch.sql` | platform_notes, promo_events, promo_milestones |
| `20261023030815_survey.sql` | surveys, survey_responses, survey_minor_counts, survey_reco_events |
| `20261023030834_create_trend_snapshots.sql` | trend_snapshots |
| `20261023030835_create_search_snapshots.sql` | search_snapshots |
| `20261023050041_create_geo_snapshots.sql` | geo_snapshots |
| `20261023064526_search_snapshots_add_google_trends.sql` | search_snapshots.engine에 google_trends 추가 |
| `20261023202113_create_products_reviews.sql` | products, product_competitors, reviews |
| `20261023202213_create_review_analyses.sql` | review_analyses |
| `20261023211500_create_collection_runs.sql` | collection_runs, collection_run_products, collection_staged_reviews, `save_collection_run()` |
| `20261024010000_add_review_excluded_reason.sql` | reviews·staged reviews에 excluded_reason |
| `20261024020000_add_site_low_count_exact.sql` | collection_run_products.site_low_count_exact |
| `20261024030000_create_collection_run_skipped.sql` | collection_run_skipped |
| `20261024040000_add_collection_stars.sql` | collection_runs.stars, collection_run_products.star_counts (별점별 수집) |
| `20261024104911_projects_products.sql` | projects, products에 project_id · sale_status · skin_line |
| `20261024130000_create_ad_checks.sql` | ad_checks, ad_check_lines, content_guides |
| `20261024172221_harden_ad_review_writes.sql` | 광고 검토 쓰기 권한을 owner로, 작성자 기본값 |
| `20261025115007_team_approval.sql` | member_tabs, tab_submissions, submission_versions, submission_reviews, ai_analyses, `has_tab()`, 상태 바꾸기 함수 |
| `20261026102012_ad_submission_integrity.sql` | 광고 시안 근거의 제품 일치 검사, 결재와 원본 광고 검토 상태 분리 |
| `20261026102117_ai_analysis_trusted_writes.sql` | AI 결과 직접 insert 차단, 승인본의 프로젝트·제품 일치 검사 |
| `20261026140000_create_review_translations.sql` | review_translations (상세페이지용 리뷰 번역) |
| `20261026150000_products_add_title_ai.sql` | products.title_ai (AI가 정리한 제품명) |
| `20261026160000_survey_concern_other_ko.sql` | survey_responses.concern_other_ko ('기타' 고민의 한국어 번역) |
| `20261026170000_survey_reco_events_source.sql` | survey_reco_events.source (추천 기록의 유입 경로) |
| `20261026180000_content_guides_revision_memos.sql` | content_guides.parent_id (수정본) · memos (블록별 메모), set_content_guide_memos() |
| `20261026190000_owner_only_approval_reads.sql` | 결재함은 팀장만: 팀원은 자기 버전 · 승인본과 그 결재 기록만 읽기, 버전 번호 트리거를 security definer로 |
| `20261026200000_ad_checks_content_guide.sql` | ad_checks.content_guide_id (만든 가이드에서 온 검토 → 검토 상세에서 「이 가이드에 반영」) |

새 파일은 `npx supabase migration new <이름>`으로 만들고, 원격 적용은 DB 관리자(Min)가 한다 (DB_RULES 6장).

## 7. 열린 질문

- 이미지 파일: Supabase Storage 버킷을 워크스페이스별 폴더(`<workspace_id>/...`)로 나눌지
- 리뷰 원문을 얼마나 보관할지 (저작권·이용약관 확인 항목과 연결, CLAUDE.md 11장)
- `reviews.source`(플랫폼 이름)와 `products.platform_id`(slug)의 이름이 다르다. `platforms` 기준표를 만들 때 맞출지
- 결재 공통 층의 탭별 `body` 모양 (1단계 PR에서 정한다)
