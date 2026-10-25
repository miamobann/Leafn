# Leafn 통합 DB 프레임 (초안)

> 상태: 논의용 초안 · 2026-10-22 · 팀 합의 전. 합의 전까지 테이블 정의는 [CLAUDE.md](../CLAUDE.md) 5장이 기준이고, 작업 규칙은 [DB_RULES.md](DB_RULES.md)를 따른다
> 확정된 절: 2장 "진출 실행" (2026-10-23). 확정된 절은 이 문서가 기준이다
> 근거: `apps/web/lib/schemas` (Zod 11개), `docs/prototype-plan.md` 8장(스키마 제안 18개)·11장, `docs/CODING_RULES.md` 7장

## 0. 이 문서의 범위

지금 정하는 것은 **실제 데이터가 들어와도 바뀌지 않는 뼈대**다.

- 정한다: 테이블 목록, PK·FK 관계, `workspace_id` 여부, RLS 패턴, 수집 데이터의 공통 칸, 테이블 이름 규칙
- 미룬다: 화면별 세부 필드, 수집 API마다 다른 값. 이런 값은 `raw jsonb`에 그대로 담아 두고, 화면에서 자주 쓰게 되면 컬럼으로 꺼낸다 (새 마이그레이션 파일로)
- `ad_checks`의 세부 필드는 TAB 3 담당자 안을 따른다. 프레임에는 FK 자리만 둔다

프로토타입 동안 화면은 계속 `lib/data/` → `lib/mock/`을 쓴다. 나중에 `lib/data/` 함수의 내부만 Supabase 쿼리로 바꾸면 된다.

## 1. 공통 규칙

| 항목 | 규칙 |
| --- | --- |
| PK | 업무 테이블은 `id uuid default gen_random_uuid()`. 기준표 `platforms`만 slug(`text`) PK |
| 공통 칸 | `id`, `created_at timestamptz default now()`. 수정되는 테이블은 `updated_at`도 둔다 |
| 팀 데이터 | `workspace_id uuid not null references workspaces` + RLS `is_member(workspace_id)` |
| 공용 데이터 | `workspace_id` 없음. 로그인한 사용자는 누구나 읽기 가능, 쓰기는 서버(service role)만 |
| 수집 데이터 공통 칸 | `source`(수집 방법: `scraper` · `api` · `csv` · `manual`), `platform_id`(어느 플랫폼에서), `external_id`(플랫폼 쪽 ID), `raw jsonb`(원본), `collected_at` |
| 중복 방지 | 수집 테이블은 `unique (workspace_id, platform_id, external_id)` 또는 공용이면 `unique (platform_id, external_id)` |
| AI 결과 | `model`, `prompt_version` 필수 (CLAUDE.md 5장) |
| 고정 값 목록 | Postgres enum 대신 `text` + `check (... in (...))`. 값을 바꿀 때 마이그레이션이 쉽다 |
| 이름 | 테이블은 복수형 snake_case, FK는 `<단수>_id` |

## 2. 테이블 목록

### 기반

| 테이블 | 범위 | 핵심 칸 | 비고 |
| --- | --- | --- | --- |
| `workspaces` | — | name, invite_code | |
| `profiles` | 사용자 | `id = auth.users.id`, display_name, title | 8장 16번. Auth 메타데이터 대신 테이블로 (조인·표시가 쉬움) |
| `workspace_members` | 팀 | workspace_id, user_id → profiles, role(`owner`·`member`) | `unique (workspace_id, user_id)` |
| `activity_log` | 팀 | actor_id, action, target_type, target_id | target_id는 FK 없이 uuid (여러 테이블을 가리킴) |

### 프로젝트 · 제품 (확정 · 2026-10-24 · 총괄)

워크스페이스(팀) → 프로젝트(제품군, 예: Leaf& Dew) → 제품. 화면 헤더에서 프로젝트를 고르고, 그 안의 제품은 탭을 나누지 않고 한 화면에서 다룬다. 마이그레이션 `20261024104911_projects_products.sql`이 이 정의를 따른다.

| 테이블 | 범위 | 핵심 칸 | 비고 |
| --- | --- | --- | --- |
| `projects` | 팀 | name, platform_id(FK 없음, 진출 실행 테이블과 같은 이유), description, created_by → profiles, updated_at | `unique (workspace_id, name)`, `unique (id, workspace_id)` (복합 FK 대상) |

- **제품은 `products`에 칸을 더한다** (별도 테이블을 만들지 않음): `project_id`, `sale_status`(`on_sale`·`in_development`), `skin_line`(`dry`·`oily`·`combo`). `(project_id, workspace_id)` → projects 복합 FK, 프로젝트를 지우면 `project_id`만 null (`on delete set null (project_id)`). 한 프로젝트 안에서 제품 이름은 겹치지 않는다 (부분 unique 인덱스).
- `products` 테이블 자체는 TAB 2 마이그레이션 `20261023202113_create_products_reviews.sql`(PR #48)이 만든다. 이 마이그레이션은 그 뒤에 칸만 더하므로 #48 다음에 적용한다.
- `skin_line`은 제품이 겨냥하는 피부 라인이다. 설문의 `skin_type`(진단 결과, 5종)과는 다른 값이다.
- 홈 진행 현황판의 가짜 데이터는 코드에서 `boardProjects`(현황판 한 줄 = 자사 제품 하나)로 이름을 바꿨다. DB 테이블은 대시보드 작업에서 제품 단위로 정한다.
- 시작 데이터(Leaf& Dew 6종)는 `supabase/seeds/projects_leaf_dew.sql`. DB 관리자가 마이그레이션 적용 뒤 참여 코드를 넣어 실행한다.

### 기준표 (공용)

| 테이블 | 핵심 칸 | 비고 |
| --- | --- | --- |
| `platforms` | `id text` (qoo10, rakuten, amazon_jp, cosme, …), name_ja, name_ko, channel_type(`ec`·`review_sns`·`offline`), rating_scale | 처음엔 코드 상수와 같은 slug로 시드. 리뷰 평점 척도(8장 8번)도 여기에 |

### TAB 2 리뷰 · 제품

| 테이블 | 범위 | 핵심 칸 | 비고 |
| --- | --- | --- | --- |
| `products` | 팀 | kind(`own`·`competitor`), brand, name, category, platform_id → platforms, url, price_jpy, price_kind, volume_ml, ingredients `text[]`, features `text[]`, image_path, raw, **project_id**, **sale_status**, **skin_line** | ml당 가격은 저장하지 않음 (8장 11번). project_id · sale_status · skin_line은 2026-10-24 추가 (위 "프로젝트 · 제품") |
| `reviews` | 팀 | product_id, **platform_id**, **source**, external_id, lang, rating, body, body_ko, reviewer_attrs `jsonb`, posted_at, raw, collected_at | 지금 Zod의 `source`(cosme·rakuten·…·csv)를 플랫폼과 수집 방법 둘로 나눈다 |
| `review_analyses` | 팀 | **workspace_id**, review_id (unique), sentiment, keywords `jsonb` [{text, category}], pain_points, repurchase_factors, model, prompt_version | Zod에는 workspace_id가 없음 → 추가 (RLS를 단순하게) |
| `review_insights` | 팀 | product_id, kind, label, label_ko, count, evidence_review_ids `uuid[]` | 분석을 다시 돌리면 다시 만들어지는 파생 데이터 |
| `review_translations` | 팀 | **workspace_id**, review_id, text_ja, ad_check_id → ad_checks, status | workspace_id 추가 |

### TAB 3 광고 검토 (확정 · 2026-10-24 · 총괄)

| 테이블 | 범위 | 핵심 칸 | 비고 |
| --- | --- | --- | --- |
| `ad_checks` | 팀 | created_by → profiles, source (`manual`·`content_guide`), input_text, input_lang, usage, product_category, overall_risk, overall_action, final_text, review_status, is_expert_review_requested, reviewer_id → profiles, reviewer_note, reviewed_at, product_id → products, promo_event_id → promo_events, model, prompt_version, deleted_at | 판정 시 자동 저장, 승인/반려(`update`)는 `owner`만 가능 (`docs/tab3-db-plan.md`) |
| `ad_check_lines` | 팀 | ad_check_id → ad_checks, line_index, block_key, original, action, findings `jsonb`, ingredient_check, translated_text, back_translation_ko, localized_note | 검토 한 건의 줄별 판정·번역·역번역·현지화 메모 |
| `content_guides` | 팀 | created_by → profiles, product_id → products, promo_event_id → promo_events, channel, post_type, input `jsonb`, title `jsonb`, body `jsonb`, lint_hits `jsonb`, ad_check_id → ad_checks, model, prompt_version | 콘텐츠 제작 가이드 본문 생성 시 별도 테이블로 자동 저장 |

**TAB 3 담당자 안 (2026-10-22, 팀 합의 전)** — 기존 칸은 바꾸지 않고 열만 추가한다. Zod는 `lib/schemas/ad-check.ts`에 `.nullable()`로 반영함.

| 칸 | 타입 | 내용 |
| --- | --- | --- |
| `overall_action` | text check (`must_fix`·`should_fix`·`expert`·`ok`) | 행동 기준 4단계 전체 판정. `overall_risk`는 그대로 둔다 |
| `line_results` | `jsonb` [{line_index, original, action, ingredient_check, translated_text, back_translation_ko, localized_note}] | 여러 줄 입력의 줄별 판정 |
| `is_expert_review_requested` | boolean | 전문가 확인 요청 여부. `review_status`(pending·approved·rejected)는 공용 값 그대로 두고, 화면에서 approved를 "내부 검토 완료"로 표시한다 |
| `usage` 선택지 | text check | `notify_button`(알림받기 버튼) 추가 |
| `findings[]` 안 | jsonb 항목 | `line_index`, `action`, `basis_status`(`confirmed`·`needs_check`), `suggestion_rechecks` [{text, text_ko, recheck(`pass`·`needs_rework`), recheck_reason}] 추가. `text`는 일본어 대체 표현, `text_ko`는 그 한국어 번역(2026-10-23 추가, 프롬프트 v5). 기존 `suggestions`(문자열 목록)는 유지 |

판정 근거 자료: `knowledge/yakkiho/`. 마이그레이션 SQL은 프레임 합의 후 `..._ad_checks.sql`로 만든다.

### TAB 1 시장

| 테이블 | 범위 | 핵심 칸 | 비고 |
| --- | --- | --- | --- |
| `trend_snapshots` | **공용** | platform_id, category, captured_at, data `jsonb` {ranking[], ingredients[]} | 라쿠텐 랭킹은 공개 데이터라 팀마다 따로 모을 필요가 없음. 지금 Zod의 workspace_id는 빼는 쪽 |
| `geo_snapshots` | 팀 | engine, query, answer, brands_mentioned `text[]`, captured_at, model | 자사 브랜드 질의라 팀 데이터 |

### 진출 실행 (확정 · 2026-10-23 · 총괄)

이 절의 테이블 3개는 확정이다. 마이그레이션 `..._launch.sql`은 이 정의를 그대로 따른다. 다른 절은 아직 초안이다.

- **플랫폼 칸:** `platform_id text`로 두되, **지금은 FK를 걸지 않는다.** `platforms` 테이블과 slug 목록은 다른 탭의 DB가 나온 뒤 맞추기로 미뤘다 (2026-10-23 결정). 그때 새 마이그레이션에서 FK 제약만 추가한다 (칸 이름은 바뀌지 않는다).
- **RLS:** 세 테이블 모두 기반 마이그레이션의 `is_member(workspace_id)`로 정책 4개 (4장 패턴).
- **`prep_due_date`는 칸으로 두지 않는다.** 준비 마감은 모두 `promo_milestones`의 행이다. 화면의 "준비 마감"은 가장 이른 미완료 마감이다.

**`platform_notes`** — 팀이 보는 플랫폼별 메모 (H)

| 칸 | 타입 | 비고 |
| --- | --- | --- |
| `id`, `created_at`, `updated_at` | 공통 | |
| `workspace_id` | `uuid not null` → workspaces, `on delete cascade` | 인덱스 |
| `platform_id` | `text not null` | FK는 나중에 (위 참고) |
| `status` | `text` · check `reviewing`·`preparing`·`live` | null = 아직 안 봄 |
| `strengths`, `audience` | `text` | 샘플 문구는 화면에서 "샘플" 표시 |
| `fees_note` | `text` | 공식 자료 확인 전에는 null |
| `fees_source_url`, `fees_checked_at` | `text`, `date` | 틀리면 해가 되는 수치라 출처와 확인일을 함께 둔다 |
| `memo` | `text` | 팀 메모 |
| `updated_by` | `uuid` → profiles, `on delete set null` | |
| | `unique (workspace_id, platform_id)` | 워크스페이스마다 플랫폼 하나에 메모 하나 |

**`promo_events`** — 플랫폼 행사와 자사 캠페인 (I)

| 칸 | 타입 | 비고 |
| --- | --- | --- |
| `id`, `created_at`, `updated_at` | 공통 | |
| `workspace_id` | `uuid not null` → workspaces, `on delete cascade` | 인덱스 `(workspace_id, start_date)` |
| `platform_id` | `text` | 자사 캠페인이면 null 허용 |
| `kind` | `text not null` · check `platform_event`·`own_campaign` | |
| `title` | `text not null` | |
| `start_date`, `end_date` | `date not null` · check `end_date >= start_date` | |
| `is_confirmed` | `boolean not null default false` | false = 과거 패턴으로 넣은 예상 일정 |
| `source_url` | `text` | 공식 공지 링크 |
| `memo` | `text` | |
| `created_by` | `uuid` → profiles, `on delete set null` | |
| | `unique (id, workspace_id)` | `promo_milestones`가 같은 워크스페이스의 행사에만 붙도록 복합 FK의 대상 |

**`promo_milestones`** — 행사 하나의 준비 마감들 (참가 신청, 할인 설정, 입고, 문구 승인 등)

| 칸 | 타입 | 비고 |
| --- | --- | --- |
| `id`, `created_at`, `updated_at` | 공통 | |
| `workspace_id` | `uuid not null` → workspaces, `on delete cascade` | RLS를 단순하게. 인덱스 `(workspace_id, due_date)` |
| `promo_event_id` | `uuid not null` | 인덱스. FK는 아래 복합 키로 건다 |
| `label` | `text not null` | |
| `due_date` | `date not null` | |
| `done_at` | `timestamptz` | null = 미완료. 완료 시각도 남는다 |
| | `foreign key (promo_event_id, workspace_id) references promo_events (id, workspace_id) on delete cascade` | 두 팀에 속한 사람이 다른 팀 행사에 마감을 붙이지 못하게 한다 (RLS는 `workspace_id`만 본다) |

**다른 탭과의 연결 (이 절에서 만들지 않음)**
- `ad_checks.promo_event_id` → promo_events (`on delete set null`): TAB 3 담당자 테이블. 담당자 안이 확정되면 그쪽 마이그레이션에서 추가한다.

### 소비자 설문

| 테이블 | 범위 | 핵심 칸 | 비고 |
| --- | --- | --- | --- |
| `surveys` | 팀 | public_slug (unique), title_ja, questions `jsonb`, is_open | 새로 추가. 공개 링크 → 어느 팀 설문인지 찾는 용도 |
| `survey_responses` | 팀 | survey_id, answers `jsonb`, skin_type, consent_at, locale | 공개 페이지에서 익명 insert만 허용 |

## 3. 관계 요약

```
workspaces ─┬─ workspace_members ── profiles (= auth.users)
            ├─ projects ── products (project_id)
            ├─ products ──┬─ reviews ──┬─ review_analyses
            │             │            └─ review_translations ── ad_checks
            │             ├─ review_insights
            │             └─ ad_checks ── promo_events ── promo_milestones
            ├─ platform_notes
            ├─ geo_snapshots
            ├─ surveys ── survey_responses
            └─ activity_log

platforms (공용) ← products, reviews, platform_notes, promo_events, trend_snapshots
trend_snapshots (공용)
```

## 4. RLS 패턴

모든 팀 테이블에 같은 정책 4개를 건다. 6명 팀 기준으로 처음에는 역할 구분 없이 "멤버면 읽기·쓰기"로 시작하고, 필요해지면 좁힌다.

```sql
-- 한 번만
create function public.is_member(ws uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

-- 팀 테이블마다 (예: products)
alter table products enable row level security;
create policy "members read"   on products for select using (is_member(workspace_id));
create policy "members insert" on products for insert with check (is_member(workspace_id));
create policy "members update" on products for update using (is_member(workspace_id));
create policy "members delete" on products for delete using (is_member(workspace_id));
```

예외:

- `workspace_members`: 읽기는 멤버, 추가·삭제는 `owner`만
- `platforms`, `trend_snapshots`: `select`는 `auth.role() = 'authenticated'`, 쓰기 정책 없음 (수집기가 service role로 씀)
- `survey_responses`: anon에게 `insert`만, 대상 설문이 `is_open`일 때. 읽기는 멤버
- 수집기(GitHub Actions의 Python)는 service role 키로 RLS를 우회해 쓴다. 대신 `workspace_id`를 코드에서 꼭 넣는다

## 5. 마이그레이션 파일 나누기 (제안)

CODING_RULES 7장에 따라 새 파일로만 추가한다. 실제 파일은 `npx supabase migration new <이름>`으로 만들고, 아래 `...`에는 CLI가 붙이는 14자리 시각이 들어간다.

1. `..._base.sql`: workspaces, profiles, workspace_members, `is_member()`, activity_log
2. `..._platforms.sql`: platforms + 시드 (slug 목록)
3. `..._reviews.sql`: products, reviews, review_analyses, review_insights
4. `..._ad_checks.sql`: ad_checks, review_translations (TAB 3 안 확정 후)
5. `..._market.sql`: trend_snapshots, geo_snapshots
6. `..._launch.sql`: platform_notes, promo_events, promo_milestones
7. `..._survey.sql`: surveys, survey_responses

각 파일에 해당 테이블의 RLS 정책을 함께 넣는다.

## 6. Zod 스키마와 달라지는 점 (프레임 확정 시 함께 고칠 것)

| Zod | 프레임 |
| --- | --- |
| `Product.platform: string` | `platform_id` (platforms FK) |
| `Review.source` = cosme·rakuten·qoo10·oliveyoung·csv | `platform_id` + `source`(scraper·api·csv·manual)로 분리 |
| `ReviewAnalysis`, `ReviewTranslation`에 workspace_id 없음 | workspace_id 추가 |
| `TrendSnapshot`에 workspace_id 있음 | 공용으로 빼고 `source` → `platform_id` |
| `PromoEvent.prep_due_date`, `milestones[]` | `promo_milestones` 테이블 (확정) |
| `WorkspaceMember.display_name`, `title` | `profiles`로 이동 |
| 설문 문항이 mock에만 있음 | `surveys.questions` |
| ID가 문자열 (`p-own-1` 등) | uuid. mock은 그대로 둬도 됨 (Zod `Id`가 문자열이라 통과) |

## 7. 아직 열린 질문

- 한 회사 = 한 워크스페이스로 볼지, 한 사용자가 여러 워크스페이스에 속할 수 있게 할지 (프레임은 여러 개를 허용하는 구조)
- 광고 검토 승인을 아무 멤버나 할 수 있는지, 검토자 역할을 따로 둘지 → TAB 3 담당자
- 리뷰 원문을 얼마나 보관할지 (저작권·이용약관 확인 항목과 연결, prototype-plan 11장)
- 이미지 파일: Supabase Storage 버킷을 워크스페이스별 폴더(`<workspace_id>/...`)로 나눌지
