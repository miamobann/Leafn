# Leafn DB 규칙

> 상태: 시안 · 2026-10-22 · 갱신 2026-10-25 (실제 DB 기준으로 정리, 정리 전 원문은 [archive/pre_DB_RULES.md](archive/pre_DB_RULES.md))
> 읽는 사람: 팀원 6명, 그리고 팀원이 쓰는 AI 코딩 에이전트
> 관련 문서: [SUPABASE_SETUP.md](SUPABASE_SETUP.md) (팀원 연동 방법) · [CLAUDE.md](../CLAUDE.md) 5장 (테이블 목록) · [db-frame.md](db-frame.md) (현재 DB 지도: 칸 정의) · [CODING_RULES.md](CODING_RULES.md) 7장
>
> **기준의 우선순위:** 테이블과 칸의 정의는 `supabase/migrations/`의 실제 파일이 기준이고, 그것을 사람이 읽기 쉽게 옮긴 것이 `docs/db-frame.md`(현재 DB 지도)다. 둘이 다르면 마이그레이션이 맞고 db-frame을 고친다. 예전의 "(프레임 후)" 표시는 2026-10-25에 풀었다. `platform_id` 칸·`is_member()`·`promo_milestones`·`surveys`는 이미 있고, **`platforms` 기준표만 아직 없다** (그래서 `platform_id`에는 FK가 없다).

## AI 에이전트에게 먼저

DB, `lib/schemas/`, `lib/mock/`, `lib/data/`, `supabase/`, `collectors/` 중 하나라도 건드리는 작업이면 아래 순서를 지킨다.

1. 이 문서를 끝까지 읽는다.
2. 작업이 **열 추가 · 테이블 추가 · 행 추가 · 수정 · 삭제** 중 무엇인지 사용자에게 한 줄로 말한다.
3. 아래 **금지** 항목에 걸리면 작업을 멈추고 사용자에게 알린다. 우회하지 않는다.
4. 끝나면 맨 아래 **PR 체크리스트**(7장)를 PR 본문에 붙이고 항목마다 체크한다.

모르는 게 있으면 추측해서 컬럼을 만들지 말고 사용자에게 묻는다. 잘못 만든 컬럼은 지우기가 만들기보다 훨씬 어렵다.

---

## 1. 절대 하지 않는 것 (금지)

| # | 금지 | 이유 |
| --- | --- | --- |
| 1 | `supabase/migrations/`의 **기존 파일 수정·삭제** | 이미 적용된 DB와 파일이 어긋난다. 바꿀 게 있으면 새 파일로 |
| 2 | 컬럼·테이블 **이름 변경, 삭제, 타입 변경**을 혼자 결정 | 다른 팀원 브랜치와 화면이 바로 깨진다. 채팅에서 합의 후 총괄 리뷰 |
| 3 | `workspace_id` 없는 팀 데이터 테이블 | 다른 회사 데이터가 섞인다 (예외 없음. `trend_snapshots`도 팀 데이터로 만들었다. 나중에 `platforms` 기준표를 만들면 그것만 공용) |
| 4 | RLS 없이 테이블 만들기 | anon 키로 누구나 읽고 쓸 수 있게 된다 |
| 5 | `SUPABASE_SERVICE_ROLE_KEY`를 브라우저 코드·`NEXT_PUBLIC_` 변수에 넣기 | 모든 회사의 데이터 마스터키가 노출된다 |
| 6 | Supabase 대시보드에서 손으로 테이블·컬럼 만들기 | 마이그레이션 파일에 안 남아서 다른 사람 DB에는 없다 |
| 7 | 이미 쓰인 플랫폼 slug 변경 (`rakuten` → `rakuten_jp` 등) | 그 slug를 가리키는 모든 행이 고아가 된다 |
| 8 | 실제 리뷰 원문 대량 데이터, 개인정보, 키를 커밋 | CODING_RULES 2장 |
| 9 | `ad_checks` 세부 칸을 TAB 3 담당자 합의 없이 추가 | 담당자 안을 따르기로 했다 |

---

## 2. 열(컬럼)을 추가할 때

### 2.1 먼저 판단: 정말 컬럼이 필요한가?

```
새 값이 필요하다
 ├─ 수집 API가 주는 값인데 아직 화면 한 곳에서만 쓴다 → raw jsonb에 그대로 두고 화면에서 꺼내 쓴다
 ├─ 다른 값에서 계산할 수 있다 (ml당 가격, 감성 비율 등) → 저장하지 말고 계산한다
 ├─ 모양이 자주 바뀌는 목록 (findings, keywords) → jsonb 컬럼 하나 + Zod로 모양 고정
 └─ 필터·정렬·조인에 쓰거나 여러 화면이 쓴다 → 컬럼으로 추가 (아래 순서)
```

### 2.2 한 번에 같이 바꿔야 하는 4곳

컬럼 하나를 추가하면 **같은 PR 안에서** 4곳을 모두 맞춘다. 하나라도 빠지면 타입 검사나 빌드에서 깨지거나, 더 나쁘게는 조용히 값이 사라진다.

| 순서 | 파일 | 할 일 |
| --- | --- | --- |
| 1 | `npx supabase migration new <설명>`으로 만든 새 파일 (`supabase/migrations/<YYYYMMDDHHMMSS>_<설명>.sql`) | `alter table ... add column ...` |
| 2 | `apps/web/lib/schemas/<도메인>.ts` | Zod 필드 추가 |
| 3 | `apps/web/lib/mock/<도메인>.ts` | 가짜 데이터에 값 채우기 (가상 브랜드만) |
| 4 | `apps/web/lib/data/index.ts` | 필터·정렬에 쓰면 함수 인자 추가 |

### 2.3 컬럼 추가 규칙

- **기존 행이 있어도 안전하게:** 새 컬럼은 `null` 허용으로 추가하거나 `default`를 준다. `not null`만 단독으로 붙이면 기존 행 때문에 마이그레이션이 실패한다.
- **Zod는 `.nullable()`로:** DB에서 빈 값은 `undefined`가 아니라 `null`로 온다. DB 컬럼에 대응하는 Zod 필드는 `.optional()`이 아니라 `.nullable()`을 쓴다. 지금 스키마의 `.optional()` 제안 필드들은 DB로 옮길 때 `.nullable()`로 바꾼다.
- **이름 규칙**

  | 종류 | 규칙 | 예 |
  | --- | --- | --- |
  | 일반 | 영어 snake_case, 줄임말 피하기 | `localized_note` |
  | 외래 키 | `<가리키는 테이블 단수>_id` | `product_id`, `promo_event_id`, `platform_id` |
  | 시각 | `_at` + `timestamptz` | `reviewed_at`, `collected_at` |
  | 날짜만 | `_date` + `date` | `start_date`, `due_date` |
  | 참/거짓 | `is_` 또는 `has_` + `boolean` | `is_open` |
  | 금액 | 단위를 이름에 + `integer` | `price_jpy` |
  | 언어별 텍스트 | `_ko`, `_ja` 접미사 | `body_ko`, `label_ko` |

- **정해진 선택지:** Postgres enum 대신 `text` + `check`. 선택지를 늘릴 때는 새 마이그레이션에서 check 제약을 지우고 다시 만든다. Zod의 `z.enum([...])`도 같이 고친다.
- **외래 키는 지울 때 동작까지 정한다:**
  - 부모와 운명을 같이하는 자식 → `on delete cascade` (제품을 지우면 그 리뷰도)
  - 참고만 하는 링크 → `on delete set null` (행사를 지워도 광고 검토는 남는다)
- **외래 키 컬럼에는 인덱스를 같이 만든다.** Postgres는 자동으로 만들어 주지 않는다.
- **AI가 만든 값을 담는 컬럼**이면 그 테이블에 `model`, `prompt_version`이 있는지 확인한다.

### 2.4 예시

```sql
-- supabase/migrations/20261022143000_products_add_launch_status.sql
alter table products
  add column launch_status text
    check (launch_status in ('planning', 'live', 'paused'));  -- null 허용: 기존 행 안전

comment on column products.launch_status is '일본 판매 상태. 화면: 경쟁제품 비교 필터';
```

```ts
// apps/web/lib/schemas/product.ts
launch_status: z.enum(["planning", "live", "paused"]).nullable(),
```

---

## 3. 테이블을 추가할 때

2장 규칙에 더해:

1. 기본 칸: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`, 수정되는 테이블이면 `updated_at`.
2. 팀 데이터면 `workspace_id uuid not null references workspaces on delete cascade` + 인덱스.
3. **같은 파일 안에서** RLS를 켜고 정책 4개(select, insert, update, delete)를 `is_member(workspace_id)`로 만든다. 템플릿은 아래.
4. 수집 데이터면 공통 칸을 넣는다: `platform_id`(또는 `source`), `external_id`, `raw jsonb`, `collected_at`, 그리고 중복 방지 unique 키. 지금 테이블은 `products`가 `(workspace_id, platform_id, external_id)`, `reviews`가 `(workspace_id, source, external_id)`를 쓴다. 새 테이블은 `platform_id` 쪽을 따른다.
5. `lib/schemas/`에 새 파일, `common.ts`의 `WorkspaceRow`를 확장한다.
6. `docs/db-frame.md` 2장 표에 칸 정의를, CLAUDE.md 5장 표에 테이블 이름과 역할 한 줄을 추가한다.

```sql
-- supabase/migrations/20261022150000_create_influencers.sql
create table influencers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references workspaces on delete cascade,
  platform_id text not null,  -- platforms 기준표가 생기면 FK를 새 마이그레이션으로 추가
  handle text not null,
  memo text
);
create index on influencers (workspace_id);
create index on influencers (platform_id);

alter table influencers enable row level security;
create policy "members read"   on influencers for select using (is_member(workspace_id));
create policy "members insert" on influencers for insert with check (is_member(workspace_id));
create policy "members update" on influencers for update using (is_member(workspace_id));
create policy "members delete" on influencers for delete using (is_member(workspace_id));
```

---

## 4. 행(데이터)을 추가할 때

### 4.1 누가 어디로 넣나

| 넣는 쪽 | 방법 | 주의 |
| --- | --- | --- |
| 화면 (팀원) | `lib/data/`의 함수 → Supabase 클라이언트 (anon 키 + 로그인) | `workspace_id`는 현재 워크스페이스로 서버에서 채운다. 화면 입력값을 그대로 믿지 않는다 |
| 수집기 (Python, `collectors/collect_to_db.py`) | service role 키 | RLS를 우회하므로 **`workspace_id`를 코드에서 반드시 넣는다**. `insert` 대신 테이블의 unique 키로 `upsert` (위 3장 4번) |
| 공개 설문 (일본 소비자) | anon 키, `survey_responses`·`survey_reco_events` insert와 `record_survey_minor()`만 (열린 설문일 때) | 개인정보는 동의한 범위만. 이메일 등은 APPI 검토 전 받지 않는다 |
| 시작 데이터 (시드) | `supabase/seeds/<이름>.sql`을 PR로 올리고, 머지 후 DB 관리자가 SQL Editor에서 실행 | 워크스페이스 참여 코드 같은 값은 자리표시로 두고 실행할 때 넣는다. 다시 실행해도 행이 늘지 않게(upsert 또는 같은 값 덮어쓰기) 쓴다 |
| (나중에) 기준 데이터 (`platforms`) | 마이그레이션 파일의 `insert` | 새 플랫폼 = 코드 상수 + 시드 마이그레이션을 같은 PR에서 |

### 4.2 행 규칙

- `platform_id`에는 코드 상수 `apps/web/lib/platforms.ts`의 `PLATFORMS`에 있는 slug만 쓴다 (지금 `qoo10`, `rakuten`). 데모는 `qoo10`만 쓰고, 다른 slug는 확장용으로 남긴다.
- `id`는 직접 만들지 않는다 (DB가 uuid를 만든다). 가짜 데이터의 `p-own-1` 같은 문자열 ID는 mock 안에서만 쓴다.
- 같은 리뷰를 두 번 수집해도 행이 두 개가 되지 않게 `(workspace_id, source, external_id)`로 upsert한다. `external_id`만으로 upsert하면 다른 워크스페이스의 행을 덮어쓴다.
- 다른 행을 가리키는 ID(`evidence_review_ids` 같은 배열 포함)는 실제로 있는 행만 넣는다. 배열은 FK 검사가 안 되므로 넣는 코드에서 확인한다.
- 수정이 많은 행(광고 검토 승인 등)은 `updated_at`을 갱신한다. 누가 바꿨는지는 그 테이블의 `reviewer_id`·`updated_by` 같은 칸에 남긴다 (`activity_log`는 아직 없다).
- 지우기 전에 `on delete cascade`로 같이 지워지는 자식이 있는지 확인한다. 리뷰 원본을 지우면 분석·번역도 사라진다.

### 4.3 가짜 데이터(`lib/mock/`) 행

- 가상 브랜드만 쓴다 (2026-10-21 결정, `archive/pre_prototype-plan.md` 11장). 자사 제품은 `lib/own-products.ts`의 Leaf& Dew 6종만 쓴다.
- Zod 검증과 교차 참조 검사를 통과해야 빌드된다. 없는 `product_id`를 가리키면 빌드가 막히는 게 정상이다.
- 화면 테스트용이어도 실제 플랫폼 slug, 실제 값의 형식(엔화 정수, ISO 날짜)을 지킨다. 나중에 실제 데이터로 바꿀 때 화면이 그대로 돌아가야 한다.

---

## 5. 여러 명이 동시에 작업할 때

- 마이그레이션 파일을 만들기 직전에 `git pull origin sub_main`을 하고, 파일은 `npx supabase migration new <설명>`으로 만든다. 이름에 **만드는 순간**의 시각(14자리)이 자동으로 붙는다.
- 같은 테이블을 두 사람이 고치면 PR 순서대로 머지하고, 늦은 쪽이 sub_main을 받아 다시 확인한다.
- 한 마이그레이션 파일에는 한 가지 목적만 넣는다 (기능 하나 = 파일 하나).
- 남의 탭 테이블에 컬럼을 넣어야 하면 먼저 채팅에서 담당자에게 말하고, PR 리뷰어로 넣는다.

| 테이블 | 담당 |
| --- | --- |
| workspaces, workspace_members, profiles, projects | 총괄 |
| products (자사 제품 칸: project_id · sale_status · skin_line · source_raw.spec) | 총괄 |
| products (경쟁 제품), product_competitors, reviews, review_analyses, collection_runs 외 수집 테이블 3개 | 리뷰 분석 (TAB 2) |
| trend_snapshots, search_snapshots, geo_snapshots, sns_trend_analyses | 시장 분석 (TAB 1) |
| ad_checks, ad_check_lines, content_guides | 광고 검토 (TAB 3) |
| promo_events, promo_milestones, platform_notes | 총괄 (홈 캘린더) |
| surveys, survey_responses, survey_minor_counts, survey_reco_events | 소비자 설문 |
| (다음) member_tabs, tab_submissions, submission_versions, submission_reviews, ai_analyses | 총괄 (`docs/team-approval-ai-analysis.md`) |

---

## 6. Supabase 프로젝트 운영

팀은 Supabase 프로젝트 **하나**(`Leaf&`, 도쿄 리전)를 같이 쓴다. 연결 방법은 [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

| 항목 | 규칙 |
| --- | --- |
| DB 개수 | 6명이 같은 DB 하나를 쓴다. 각자 따로 프로젝트를 만들지 않는다 |
| 테스트 데이터 | 팀원마다 자기 워크스페이스 행을 하나씩 만들어 그 안에서만 테스트한다. 남의 워크스페이스 데이터를 지우거나 고치지 않는다 |
| 마이그레이션 적용 | 실제 DB에 SQL을 적용하는 사람은 **DB 관리자 1명**(Min)뿐이다. 다른 사람은 `supabase/migrations/` 파일을 PR로 올리고, sub_main에 머지된 뒤 관리자가 적용한다. 적용은 `supabase db push`로 한다 (MCP `apply_migration`은 적용 시각을 버전으로 기록해 파일 이름과 어긋난다) |
| 대시보드 권한 | 대시보드(테이블 편집기, SQL Editor)는 보기용이다. 대시보드에서 테이블·컬럼·정책을 손으로 만들거나 바꾸지 않는다 (1장 6번) |
| 키 공유 | URL과 publishable(anon) 키는 팀 채팅으로 공유해도 된다. **service_role(secret) 키는 채팅·문서·코드 어디에도 붙이지 않는다.** Vercel 환경 변수와 GitHub Actions Secrets에만 관리자가 넣는다 |
| 키 유출 시 | 바로 관리자에게 알린다. 관리자가 Supabase 대시보드에서 키를 교체하고 팀에 새 값을 공지한다 |
| 데이터 초기화 | 테이블을 비우거나(`truncate`) 지우는(`drop`) 작업은 채팅에서 미리 알리고 관리자만 한다 |

**AI 에이전트에게:** Supabase MCP나 CLI로 원격 DB에 접근할 수 있어도 `apply_migration`, `execute_sql`로 스키마나 데이터를 바꾸지 않는다. 마이그레이션 파일만 만들고, 적용은 사용자(관리자)에게 넘긴다. 읽기 조회(`select`, 테이블 목록)는 괜찮다.

---

## 7. PR 체크리스트 (DB를 건드린 PR 본문에 붙인다)

```markdown
### DB 체크리스트
- [ ] 기존 마이그레이션 파일은 수정하지 않았다 (새 파일만, `supabase migration new`로 생성)
- [ ] 이름 변경·삭제·타입 변경이 없다 (있으면 합의한 채팅 링크: )
- [ ] 새 컬럼은 null 허용이거나 default가 있다
- [ ] 새 테이블에 workspace_id + 인덱스 + RLS 정책이 있다 (공용 테이블이면 이유: )
- [ ] docs/db-frame.md와 CLAUDE.md 5장 표를 같이 고쳤다
- [ ] 외래 키에 on delete 동작과 인덱스를 정했다
- [ ] lib/schemas Zod를 같이 고쳤다 (DB 컬럼은 .nullable())
- [ ] lib/mock 가짜 데이터를 같이 고쳤고 빌드가 통과한다
- [ ] 수집·upsert 키에 workspace_id가 들어 있다
- [ ] platform_id는 코드 상수의 slug만 쓴다 (데모는 qoo10)
- [ ] service role 키는 서버 코드에서만 쓴다
- [ ] 원격 DB에 직접 적용하지 않았다 (적용은 머지 후 DB 관리자가)
- [ ] 다른 탭 테이블을 건드렸으면 그 담당자를 리뷰어로 넣었다
- [ ] npm run typecheck / lint / build 통과
```
