-- 광고 검토(TAB 3): 약기법 검토 · 줄별 판정 · 콘텐츠 제작 가이드 결과물
-- 근거: docs/tab3-db-plan.md (TAB 3 담당자 안) · docs/db-frame.md 2장 ad_checks · 5장 4번 파일 · docs/DB_RULES.md 3장
-- 선행: 20261022082907_base_workspaces.sql (is_member) · 20261023030000_launch.sql (set_updated_at, promo_events) · 20261023202113_create_products_reviews.sql
-- review_translations(참조 F)는 F를 만들 때 따로 추가한다 (CLAUDE.md 1장)

-- 1. 검토 한 건 -------------------------------------------------------------

create table public.ad_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'content_guide')),
  input_text text not null check (char_length(btrim(input_text)) >= 1),
  input_lang text not null check (input_lang in ('ko', 'ja')),
  usage text check (usage in ('detail_page', 'sns', 'banner', 'survey_result', 'notify_button')),
  product_category text check (product_category in ('general_cosmetic', 'quasi_drug')),
  product_id uuid,
  promo_event_id uuid,
  overall_risk text check (overall_risk in ('high', 'medium', 'low')),
  overall_action text check (overall_action in ('must_fix', 'should_fix', 'expert', 'ok')),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references public.profiles (id) on delete set null,
  reviewer_note text,
  reviewed_at timestamptz,
  final_text text,
  is_expert_review_requested boolean not null default false,
  model text not null,
  prompt_version text not null,
  deleted_at timestamptz,
  unique (id, workspace_id),
  -- 제품·행사는 참고 링크라서 지워져도 검토 기록은 남는다 (그 칸만 비운다)
  foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete set null (product_id),
  foreign key (promo_event_id, workspace_id) references public.promo_events (id, workspace_id) on delete set null (promo_event_id)
);
comment on table public.ad_checks is '약기법 검토 한 건. 판정할 때 자동 저장. 줄별 결과는 ad_check_lines';
comment on column public.ad_checks.source is 'manual = 새 검토 화면, content_guide = 콘텐츠 가이드가 자동으로 돌린 검사. 검토 이력은 기본으로 manual만 보여 준다';
comment on column public.ad_checks.deleted_at is '화면의 삭제 = 숨김. 약기법 검토는 증거로 남기려고 행을 지우지 않는다. 복구는 DB 관리자가 한다';
comment on column public.ad_checks.final_text is '담당자가 확정한 문구';
comment on column public.ad_checks.model is 'AI 결과는 어떤 모델·프롬프트로 만들었는지 남긴다 (CLAUDE.md 5장)';
create index ad_checks_workspace_idx on public.ad_checks (workspace_id, created_at desc);
create index ad_checks_product_idx on public.ad_checks (product_id);
create index ad_checks_promo_event_idx on public.ad_checks (promo_event_id);
create index ad_checks_created_by_idx on public.ad_checks (created_by);
create index ad_checks_reviewer_idx on public.ad_checks (reviewer_id);

-- 2. 줄별 판정 --------------------------------------------------------------

create table public.ad_check_lines (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  ad_check_id uuid not null,
  line_index integer not null check (line_index >= 1),
  block_key text,
  original text not null,
  action text not null check (action in ('must_fix', 'should_fix', 'expert', 'ok')),
  findings jsonb not null default '[]',
  ingredient_check text,
  translated_text text,
  back_translation_ko text,
  localized_note text,
  unique (ad_check_id, line_index),
  -- 줄은 같은 워크스페이스의 검토에만 붙는다. 검토 행을 지우면(관리자만) 줄도 함께 지워진다
  foreign key (ad_check_id, workspace_id) references public.ad_checks (id, workspace_id) on delete cascade
);
comment on table public.ad_check_lines is '검토 한 건의 줄별 판정. 검토를 숨기면 줄도 화면에서 함께 숨는다 (행은 남음)';
comment on column public.ad_check_lines.findings is '[{ text, risk, reason, basis, suggestions, action, basis_status, suggestion_rechecks }]. 모양은 lib/schemas/ad-check.ts AdFinding';
comment on column public.ad_check_lines.block_key is '콘텐츠 가이드 검사일 때 어느 블록인지 (content_guides.body의 blocks[].key). 새 검토는 null';
create index ad_check_lines_workspace_idx on public.ad_check_lines (workspace_id);
-- ad_check_id 조회는 unique (ad_check_id, line_index) 인덱스가 맡는다

-- 3. 콘텐츠 제작 가이드 결과물 ------------------------------------------------

create table public.content_guides (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  product_id uuid,
  promo_event_id uuid,
  channel text not null check (channel in ('qoo10_detail', 'instagram', 'x', 'banner')),
  post_type text not null check (post_type in ('general', 'mega_sale', 'season')),
  input jsonb not null,
  title jsonb not null,
  body jsonb not null,
  lint_hits jsonb not null default '[]',
  ad_check_id uuid,
  model text not null,
  prompt_version text not null,
  unique (id, workspace_id),
  foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete set null (product_id),
  foreign key (promo_event_id, workspace_id) references public.promo_events (id, workspace_id) on delete set null (promo_event_id),
  -- 결과물을 지워도 검사 기록(ad_checks)은 남는다
  foreign key (ad_check_id, workspace_id) references public.ad_checks (id, workspace_id) on delete set null (ad_check_id)
);
comment on table public.content_guides is '콘텐츠 제작 가이드 결과물. 만들 때 자동 저장. 화면의 삭제 = 행 삭제';
comment on column public.content_guides.input is '제작 요청 (lib/schemas/content-guide.ts ContentGuideInput)';
comment on column public.content_guides.title is '고른 제목 (GuideTitle)';
comment on column public.content_guides.body is '본문 결과 (GuideBodyResult)';
comment on column public.content_guides.ad_check_id is '이 결과물을 약기법 판정에 통과시킨 검사 (ad_checks.source = content_guide)';
create index content_guides_workspace_idx on public.content_guides (workspace_id, created_at desc);
create index content_guides_product_idx on public.content_guides (product_id);
create index content_guides_promo_event_idx on public.content_guides (promo_event_id);
create index content_guides_ad_check_idx on public.content_guides (ad_check_id);
create index content_guides_created_by_idx on public.content_guides (created_by);

-- 4. 트리거 ---------------------------------------------------------------

create trigger ad_checks_set_updated_at before update on public.ad_checks
  for each row execute function public.set_updated_at();

-- 5. RLS (db-frame 4장: 멤버면 읽기·쓰기) -------------------------------------

alter table public.ad_checks enable row level security;
create policy "members read" on public.ad_checks
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.ad_checks
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.ad_checks
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
-- delete 정책 없음: 화면의 삭제는 deleted_at을 채우는 update. 행 삭제는 DB 관리자만

alter table public.ad_check_lines enable row level security;
create policy "members read" on public.ad_check_lines
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.ad_check_lines
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.ad_check_lines
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
-- delete 정책 없음: 검토와 같은 이유

alter table public.content_guides enable row level security;
create policy "members read" on public.content_guides
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.content_guides
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.content_guides
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.content_guides
  for delete to authenticated using (public.is_member(workspace_id));
