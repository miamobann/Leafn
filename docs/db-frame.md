# Leafn 통합 DB 프레임 (초안)

> 상태: 논의용 초안 · 2026-10-22 · 팀 합의 전. 합의 전까지 테이블 정의는 [CLAUDE.md](../CLAUDE.md) 5장이 기준이고, 작업 규칙은 [DB_RULES.md](DB_RULES.md)를 따른다
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

### 기준표 (공용)

| 테이블 | 핵심 칸 | 비고 |
| --- | --- | --- |
| `platforms` | `id text` (qoo10, rakuten, amazon_jp, cosme, …), name_ja, name_ko, channel_type(`ec`·`review_sns`·`offline`), rating_scale | 처음엔 코드 상수와 같은 slug로 시드. 리뷰 평점 척도(8장 8번)도 여기에 |

### TAB 2 리뷰 · 제품

| 테이블 | 범위 | 핵심 칸 | 비고 |
| --- | --- | --- | --- |
| `products` | 팀 | kind(`own`·`competitor`), brand, name, category, platform_id → platforms, url, price_jpy, price_kind, volume_ml, ingredients `text[]`, features `text[]`, image_path, raw | ml당 가격은 저장하지 않음 (8장 11번) |
| `reviews` | 팀 | product_id, **platform_id**, **source**, external_id, lang, rating, body, body_ko, reviewer_attrs `jsonb`, posted_at, raw, collected_at | 지금 Zod의 `source`(cosme·rakuten·…·csv)를 플랫폼과 수집 방법 둘로 나눈다 |
| `review_analyses` | 팀 | **workspace_id**, review_id (unique), sentiment, keywords `jsonb` [{text, category}], pain_points, repurchase_factors, model, prompt_version | Zod에는 workspace_id가 없음 → 추가 (RLS를 단순하게) |
| `review_insights` | 팀 | product_id, kind, label, label_ko, count, evidence_review_ids `uuid[]` | 분석을 다시 돌리면 다시 만들어지는 파생 데이터 |
| `review_translations` | 팀 | **workspace_id**, review_id, text_ja, ad_check_id → ad_checks, status | workspace_id 추가 |

### TAB 3 광고 검토

| 테이블 | 범위 | 핵심 칸 (프레임) | 비고 |
| --- | --- | --- | --- |
| `ad_checks` | 팀 | input_text, input_lang, findings `jsonb`, overall_risk, review_status, reviewer_id → profiles, reviewed_at, product_id → products, promo_event_id → promo_events, model, prompt_version | 나머지(final_text, usage, product_category, 번역·역번역 등)는 TAB 3 담당자 안 확정 후 추가 |

**TAB 3 담당자 안 (2026-10-22, 팀 합의 전)** — 기존 칸은 바꾸지 않고 열만 추가한다. Zod는 `lib/schemas/ad-check.ts`에 `.nullable()`로 반영함.

| 칸 | 타입 | 내용 |
| --- | --- | --- |
| `overall_action` | text check (`must_fix`·`should_fix`·`expert`·`ok`) | 행동 기준 4단계 전체 판정. `overall_risk`는 그대로 둔다 |
| `line_results` | `jsonb` [{line_index, original, action, ingredient_check, translated_text, back_translation_ko, localized_note}] | 여러 줄 입력의 줄별 판정 |
| `is_expert_review_requested` | boolean | 전문가 확인 요청 여부. `review_status`(pending·approved·rejected)는 공용 값 그대로 두고, 화면에서 approved를 "내부 검토 완료"로 표시한다 |
| `usage` 선택지 | text check | `notify_button`(알림받기 버튼) 추가 |
| `findings[]` 안 | jsonb 항목 | `line_index`, `action`, `basis_status`(`confirmed`·`needs_check`), `suggestion_rechecks` [{text, recheck(`pass`·`needs_rework`), recheck_reason}] 추가. 기존 `suggestions`(문자열 목록)는 유지 |

판정 근거 자료: `knowledge/yakkiho/`. 마이그레이션 SQL은 프레임 합의 후 `..._ad_checks.sql`로 만든다.

### TAB 1 시장

| 테이블 | 범위 | 핵심 칸 | 비고 |
| --- | --- | --- | --- |
| `trend_snapshots` | **공용** | platform_id, category, captured_at, data `jsonb` {ranking[], ingredients[]} | 라쿠텐 랭킹은 공개 데이터라 팀마다 따로 모을 필요가 없음. 지금 Zod의 workspace_id는 빼는 쪽 |
| `geo_snapshots` | 팀 | engine, query, answer, brands_mentioned `text[]`, captured_at, model | 자사 브랜드 질의라 팀 데이터 |

### 진출 실행

| 테이블 | 범위 | 핵심 칸 | 비고 |
| --- | --- | --- | --- |
| `platform_notes` | 팀 | platform_id, strengths, audience, fees_note, status(`reviewing`·`preparing`·`live`), updated_by | `unique (workspace_id, platform_id)` |
| `promo_events` | 팀 | platform_id (자사 캠페인이면 null 허용), kind, title, start_date, end_date, memo, source_url | |
| `promo_milestones` | 팀 | promo_event_id, label, due_date, done | Zod의 `milestones[]` · `prep_due_date`를 표로. 캘린더에서 "이번 주 마감"을 조회하기 쉬움 |

### 소비자 설문

| 테이블 | 범위 | 핵심 칸 | 비고 |
| --- | --- | --- | --- |
| `surveys` | 팀 | public_slug (unique), title_ja, questions `jsonb`, is_open | 새로 추가. 공개 링크 → 어느 팀 설문인지 찾는 용도 |
| `survey_responses` | 팀 | survey_id, answers `jsonb`, skin_type, consent_at, locale | 공개 페이지에서 익명 insert만 허용 |

## 3. 관계 요약

```
workspaces ─┬─ workspace_members ── profiles (= auth.users)
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

CODING_RULES 7장에 따라 새 파일로만 추가한다.

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
| `PromoEvent.prep_due_date`, `milestones[]` | `promo_milestones` 테이블 |
| `WorkspaceMember.display_name`, `title` | `profiles`로 이동 |
| 설문 문항이 mock에만 있음 | `surveys.questions` |
| ID가 문자열 (`p-own-1` 등) | uuid. mock은 그대로 둬도 됨 (Zod `Id`가 문자열이라 통과) |

## 7. 아직 열린 질문

- 한 회사 = 한 워크스페이스로 볼지, 한 사용자가 여러 워크스페이스에 속할 수 있게 할지 (프레임은 여러 개를 허용하는 구조)
- 광고 검토 승인을 아무 멤버나 할 수 있는지, 검토자 역할을 따로 둘지 → TAB 3 담당자
- 리뷰 원문을 얼마나 보관할지 (저작권·이용약관 확인 항목과 연결, prototype-plan 11장)
- 이미지 파일: Supabase Storage 버킷을 워크스페이스별 폴더(`<workspace_id>/...`)로 나눌지
