-- TAB 3 약기법 광고 검토(ad_checks)와 콘텐츠 제작 가이드(content_guides) 테이블 생성
-- 근거: CLAUDE.md 5장 · docs/db-frame.md 2장 "TAB 3 광고 검토" · docs/DB_RULES.md 3장
-- PM 결정(2026-10-24):
--   1. 줄별 판정은 ad_checks의 findings/line_results jsonb에 저장
--   2. 콘텐츠 제작 가이드는 별도 content_guides 테이블로 분리
--   3. AI 판정/본문 생성 시 자동 저장, 승인/반려 상태 변경(update) 권한은 워크스페이스 owner만 허용

-- 1. ad_checks 테이블 --------------------------------------------------------

create table public.ad_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  promo_event_id uuid references public.promo_events (id) on delete set null,
  input_text text not null check (char_length(btrim(input_text)) >= 1),
  input_lang text not null check (input_lang in ('ko', 'ja')),
  usage text check (usage in ('detail_page', 'sns', 'banner', 'survey_result', 'notify_button')),
  product_category text check (product_category in ('general_cosmetic', 'quasi_drug')),
  overall_risk text check (overall_risk in ('high', 'medium', 'low')),
  overall_action text check (overall_action in ('must_fix', 'should_fix', 'expert', 'ok')),
  findings jsonb not null default '[]'::jsonb,
  line_results jsonb not null default '[]'::jsonb,
  translated_text text,
  back_translation_ko text,
  localized_note text,
  final_text text,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  is_expert_review_requested boolean not null default false,
  reviewer_id uuid references public.profiles (id) on delete set null,
  reviewer_note text,
  reviewed_at timestamptz,
  model text not null,
  prompt_version text not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);

comment on table public.ad_checks is '약기법 광고 문구 검토 결과 및 담당자 승인 이력 (A)';
comment on column public.ad_checks.findings is '위험 표현 및 대체 표현 재검토 목록 (jsonb)';
comment on column public.ad_checks.line_results is '여러 줄 입력의 줄별 판정·번역·역번역·현지화 메모 (jsonb)';
comment on column public.ad_checks.review_status is '검토 상태 (pending / approved / rejected). 변경은 owner만 가능';

create index ad_checks_workspace_created_idx on public.ad_checks (workspace_id, created_at desc);
create index ad_checks_product_idx on public.ad_checks (product_id);
create index ad_checks_promo_event_idx on public.ad_checks (promo_event_id);
create index ad_checks_reviewer_idx on public.ad_checks (reviewer_id);
create index ad_checks_created_by_idx on public.ad_checks (created_by);

create trigger ad_checks_set_updated_at before update on public.ad_checks
  for each row execute function public.set_updated_at();

-- 2. content_guides 테이블 ---------------------------------------------------

create table public.content_guides (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  promo_event_id uuid references public.promo_events (id) on delete set null,
  channel text not null check (channel in ('qoo10_detail', 'instagram', 'x', 'banner')),
  post_type text not null default 'general' check (post_type in ('general', 'mega_sale', 'season')),
  direction text not null default '',
  title_ja text not null,
  title_ko text not null,
  angle text not null default '',
  recommended boolean not null default false,
  reason text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  hashtags jsonb not null default '{"brand":[],"ingredient":[],"trend":[]}'::jsonb,
  gallery jsonb not null default '[]'::jsonb,
  lint_hits jsonb not null default '[]'::jsonb,
  checks jsonb not null default '[]'::jsonb,
  model text not null,
  prompt_version text not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);

comment on table public.content_guides is '콘텐츠 제작 가이드 AI 생성 결과물 (채널별 제목·본문 블록·해시태그·갤러리·약기법 검사)';

create index content_guides_workspace_created_idx on public.content_guides (workspace_id, created_at desc);
create index content_guides_product_idx on public.content_guides (product_id);
create index content_guides_promo_event_idx on public.content_guides (promo_event_id);
create index content_guides_created_by_idx on public.content_guides (created_by);

create trigger content_guides_set_updated_at before update on public.content_guides
  for each row execute function public.set_updated_at();

-- 3. RLS 정책 ----------------------------------------------------------------
-- 조회(select)와 판정 자동 저장(insert)은 워크스페이스 멤버 누구나 가능
-- 승인/반려 수정(update)과 삭제(delete)는 워크스페이스 owner만 가능 (PM 결정 2026-10-24)

alter table public.ad_checks enable row level security;

create policy "members read" on public.ad_checks
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.ad_checks
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "owners update" on public.ad_checks
  for update to authenticated using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));
create policy "owners delete" on public.ad_checks
  for delete to authenticated using (public.is_owner(workspace_id));

alter table public.content_guides enable row level security;

create policy "members read" on public.content_guides
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.content_guides
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "owners update" on public.content_guides
  for update to authenticated using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));
create policy "owners delete" on public.content_guides
  for delete to authenticated using (public.is_owner(workspace_id));

-- 직접 Data API를 호출하더라도 첫 저장은 미검토 상태이며 작성자를 위조할 수 없다.
create policy "new checks start pending" on public.ad_checks as restrictive
  for insert to authenticated with check (
    review_status = 'pending' and reviewer_id is null and reviewed_at is null
    and reviewer_note is null and not is_expert_review_requested
    and created_by = (select auth.uid())
  );
create policy "guide author matches session" on public.content_guides as restrictive
  for insert to authenticated with check (created_by = (select auth.uid()));

-- FK만으로는 다른 팀 제품을 연결할 수 있으므로 팀 일치도 강제한다.
create policy "references stay in workspace" on public.ad_checks as restrictive
  for all to authenticated using (true) with check (
    (product_id is null or exists (select 1 from public.products p where p.id = ad_checks.product_id and p.workspace_id = ad_checks.workspace_id))
    and (promo_event_id is null or exists (select 1 from public.promo_events e where e.id = ad_checks.promo_event_id and e.workspace_id = ad_checks.workspace_id))
  );
create policy "references stay in workspace" on public.content_guides as restrictive
  for all to authenticated using (true) with check (
    (product_id is null or exists (select 1 from public.products p where p.id = content_guides.product_id and p.workspace_id = content_guides.workspace_id))
    and (promo_event_id is null or exists (select 1 from public.promo_events e where e.id = content_guides.promo_event_id and e.workspace_id = content_guides.workspace_id))
  );
