# Leafn DB 규칙

> 상태: 시안 · 2026-10-22 · 팀 합의 후 확정
> 읽는 사람: 팀원 6명, 그리고 팀원이 쓰는 AI 코딩 에이전트
> 관련 문서: [SUPABASE_SETUP.md](SUPABASE_SETUP.md) (팀원 연동 방법) · [CLAUDE.md](../CLAUDE.md) 5장 (DB 스키마 초안) · [db-frame.md](db-frame.md) (통합 DB 프레임 초안) · [CODING_RULES.md](CODING_RULES.md) 7장
>
> **기준의 우선순위:** 테이블과 컬럼의 정의는 프레임이 합의되기 전까지 CLAUDE.md 5장이 기준이다. 이 문서에 나오는 `platforms`, `platform_id`, `promo_milestones`, `surveys`, `is_member()` 같은 이름은 db-frame.md 초안 기준이라서, 합의 전에는 만들지 않는다. 대신 이 문서의 절차 규칙(1·2·4·5·6·7장)은 지금부터 바로 지킨다.

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
| 3 | `workspace_id` 없는 팀 데이터 테이블 | 다른 회사 데이터가 섞인다 (예외는 공용 테이블 2개뿐: `platforms`, `trend_snapshots`) |
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
| 1 | `supabase/migrations/<YYYYMMDDHHMM>_<설명>.sql` (새 파일) | `alter table ... add column ...` |
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
-- supabase/migrations/202610221430_products_add_launch_status.sql
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
4. 수집 데이터면 공통 칸을 넣는다: `platform_id`, `source`, `external_id`, `raw jsonb`, `collected_at`, 그리고 중복 방지 `unique (workspace_id, platform_id, external_id)`.
5. `lib/schemas/`에 새 파일, `common.ts`의 `WorkspaceRow`를 확장한다.
6. CLAUDE.md 5장 표(프레임 합의 후에는 `docs/db-frame.md` 2장 표)에 한 줄 추가한다.

```sql
-- supabase/migrations/202610221500_create_influencers.sql
create table influencers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references workspaces on delete cascade,
  platform_id text not null references platforms,
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
| 수집기 (Python, GitHub Actions) | service role 키 | RLS를 우회하므로 **`workspace_id`를 코드에서 반드시 넣는다**. `insert` 대신 `upsert` (on conflict `external_id`) |
| 공개 설문 (일본 소비자) | anon 키, `survey_responses` insert만 | 개인정보는 동의한 범위만. 이메일 등은 APPI 검토 전 받지 않는다 |
| 기준 데이터 (`platforms`) | 마이그레이션 파일의 `insert` | 새 플랫폼 = 코드 상수 + 시드 마이그레이션을 같은 PR에서 |

### 4.2 행 규칙

- `platform_id`에는 `platforms`에 있는 slug만 쓴다. 새 플랫폼이 필요하면 4.1 마지막 줄대로 먼저 추가한다.
- `id`는 직접 만들지 않는다 (DB가 uuid를 만든다). 가짜 데이터의 `p-own-1` 같은 문자열 ID는 mock 안에서만 쓴다.
- 같은 리뷰를 두 번 수집해도 행이 두 개가 되지 않게 `external_id`로 upsert한다.
- 다른 행을 가리키는 ID(`evidence_review_ids` 같은 배열 포함)는 실제로 있는 행만 넣는다. 배열은 FK 검사가 안 되므로 넣는 코드에서 확인한다.
- 수정이 많은 행(광고 검토 승인 등)은 `updated_at`을 갱신한다. 누가 바꿨는지 남겨야 하면 `activity_log`에도 한 줄 넣는다.
- 지우기 전에 `on delete cascade`로 같이 지워지는 자식이 있는지 확인한다. 리뷰 원본을 지우면 분석·번역도 사라진다.

### 4.3 가짜 데이터(`lib/mock/`) 행

- 가상 브랜드만 쓴다 (prototype-plan 11장 결정).
- Zod 검증과 교차 참조 검사를 통과해야 빌드된다. 없는 `product_id`를 가리키면 빌드가 막히는 게 정상이다.
- 화면 테스트용이어도 실제 플랫폼 slug, 실제 값의 형식(엔화 정수, ISO 날짜)을 지킨다. 나중에 실제 데이터로 바꿀 때 화면이 그대로 돌아가야 한다.

---

## 5. 여러 명이 동시에 작업할 때

- 마이그레이션 파일을 만들기 직전에 `git pull origin sub_main`을 한다. 파일 이름의 시각은 **만드는 순간**의 시각으로 한다.
- 같은 테이블을 두 사람이 고치면 PR 순서대로 머지하고, 늦은 쪽이 sub_main을 받아 다시 확인한다.
- 한 마이그레이션 파일에는 한 가지 목적만 넣는다 (기능 하나 = 파일 하나).
- 남의 탭 테이블에 컬럼을 넣어야 하면 먼저 채팅에서 담당자에게 말하고, PR 리뷰어로 넣는다.

| 테이블 | 담당 |
| --- | --- |
| workspaces, workspace_members, profiles, activity_log | 총괄 |
| trend_snapshots, geo_snapshots | 시장 분석 (TAB 1) |
| products, reviews, review_analyses, review_insights | 리뷰 분석 (TAB 2) |
| ad_checks, review_translations | 광고 검토 (TAB 3) |
| platforms, platform_notes, promo_events, promo_milestones | 진출 실행 |
| surveys, survey_responses | 소비자 설문 |

---

## 6. Supabase 프로젝트 운영

팀은 Supabase 프로젝트 **하나**(`Leaf&`, 도쿄 리전)를 같이 쓴다. 연결 방법은 [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

| 항목 | 규칙 |
| --- | --- |
| DB 개수 | 6명이 같은 DB 하나를 쓴다. 각자 따로 프로젝트를 만들지 않는다 |
| 테스트 데이터 | 팀원마다 자기 워크스페이스 행을 하나씩 만들어 그 안에서만 테스트한다. 남의 워크스페이스 데이터를 지우거나 고치지 않는다 |
| 마이그레이션 적용 | 실제 DB에 SQL을 적용하는 사람은 **DB 관리자 1명**(Min)뿐이다. 다른 사람은 `supabase/migrations/` 파일을 PR로 올리고, sub_main에 머지된 뒤 관리자가 적용한다 |
| 대시보드 권한 | 대시보드(테이블 편집기, SQL Editor)는 보기용이다. 대시보드에서 테이블·컬럼·정책을 손으로 만들거나 바꾸지 않는다 (1장 6번) |
| 키 공유 | URL과 publishable(anon) 키는 팀 채팅으로 공유해도 된다. **service_role(secret) 키는 채팅·문서·코드 어디에도 붙이지 않는다.** Vercel 환경 변수와 GitHub Actions Secrets에만 관리자가 넣는다 |
| 키 유출 시 | 바로 관리자에게 알린다. 관리자가 Supabase 대시보드에서 키를 교체하고 팀에 새 값을 공지한다 |
| 데이터 초기화 | 테이블을 비우거나(`truncate`) 지우는(`drop`) 작업은 채팅에서 미리 알리고 관리자만 한다 |

**AI 에이전트에게:** Supabase MCP나 CLI로 원격 DB에 접근할 수 있어도 `apply_migration`, `execute_sql`로 스키마나 데이터를 바꾸지 않는다. 마이그레이션 파일만 만들고, 적용은 사용자(관리자)에게 넘긴다. 읽기 조회(`select`, 테이블 목록)는 괜찮다.

---

## 7. PR 체크리스트 (DB를 건드린 PR 본문에 붙인다)

```markdown
### DB 체크리스트
- [ ] 기존 마이그레이션 파일은 수정하지 않았다 (새 파일만)
- [ ] 이름 변경·삭제·타입 변경이 없다 (있으면 합의한 채팅 링크: )
- [ ] 새 컬럼은 null 허용이거나 default가 있다
- [ ] 새 테이블에 workspace_id + 인덱스 + RLS 정책 4개가 있다 (공용 테이블이면 이유: )
- [ ] 외래 키에 on delete 동작과 인덱스를 정했다
- [ ] lib/schemas Zod를 같이 고쳤다 (DB 컬럼은 .nullable())
- [ ] lib/mock 가짜 데이터를 같이 고쳤고 빌드가 통과한다
- [ ] platform_id는 platforms의 slug만 쓴다
- [ ] service role 키는 서버 코드에서만 쓴다
- [ ] 원격 DB에 직접 적용하지 않았다 (적용은 머지 후 DB 관리자가)
- [ ] 다른 탭 테이블을 건드렸으면 그 담당자를 리뷰어로 넣었다
- [ ] npm run typecheck / lint / build 통과
```
