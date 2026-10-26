-- 상세페이지용 리뷰 번역 (참조 기능 F): 국내 리뷰 한 건의 일본어 번역과, 그 번역을 통과시킨 약기법 검토(ad_checks)를 잇는다.
-- 작업: 테이블 추가 (review_translations). 기존 테이블·마이그레이션은 건드리지 않는다.
-- 근거: CLAUDE.md 5장 review_translations · docs/db-frame.md 2장 · docs/DB_RULES.md 3장
-- 선행: 20261023202113_create_products_reviews.sql (reviews) · 20261024130000_create_ad_checks.sql (ad_checks)
--
-- 번역은 광고 검토 AI(prompts/ad-check)가 한국어 문구를 일본어로 옮기면서 약기법 판정을 함께 낸 결과다.
-- 그래서 번역 한 건마다 ad_checks 한 건(source = 'manual', 용도 = 상세페이지)이 생기고, 승인·반려는 기존 광고 검토 화면에서 owner가 한다.
-- 승인 상태는 ad_checks.review_status가 기준이다. 여기 status는 번역 자체의 상태(초안/승인 복사 완료 등)를 위해 CLAUDE.md 5장대로 둔다.

create table public.review_translations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  review_id uuid not null,
  ad_check_id uuid,
  text_ja text not null check (char_length(btrim(text_ja)) >= 1),
  status text not null default 'draft' check (status in ('draft', 'approved')),
  -- 리뷰 한 건에 번역은 한 건. 다시 번역하면 이 행을 새 번역과 새 검토로 바꾼다
  unique (review_id),
  -- 번역은 같은 워크스페이스의 리뷰에만 붙는다. 리뷰를 지우면 번역도 함께 지워진다
  foreign key (review_id, workspace_id) references public.reviews (id, workspace_id) on delete cascade,
  -- 검토 기록은 증거라서 남기고, 번역 쪽 링크만 비운다
  foreign key (ad_check_id, workspace_id) references public.ad_checks (id, workspace_id) on delete set null (ad_check_id)
);
comment on table public.review_translations is '국내 리뷰의 일본어 번역 (상세페이지용). 번역한 순간 약기법 검토가 함께 돌아 ad_check_id로 연결된다';
comment on column public.review_translations.text_ja is '광고 검토 AI가 낸 일본어 번역(ad_check_lines.translated_text)';
comment on column public.review_translations.ad_check_id is '이 번역을 판정한 약기법 검토. 승인 상태는 그 검토의 review_status가 기준';
create index review_translations_workspace_idx on public.review_translations (workspace_id, created_at desc);
create index review_translations_ad_check_idx on public.review_translations (ad_check_id);
create index review_translations_created_by_idx on public.review_translations (created_by);
-- review_id 조회는 unique (review_id) 인덱스가 맡는다

create trigger review_translations_set_updated_at before update on public.review_translations
  for each row execute function public.set_updated_at();

alter table public.review_translations enable row level security;
create policy "members read" on public.review_translations
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.review_translations
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.review_translations
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.review_translations
  for delete to authenticated using (public.is_member(workspace_id));
