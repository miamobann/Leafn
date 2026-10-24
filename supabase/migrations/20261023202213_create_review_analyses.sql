-- 리뷰 분석(TAB 2): 리뷰 한 건당 AI 분석 결과
-- 근거: CLAUDE.md 5장 · 7장(리뷰 분석 응답) · docs/DB_RULES.md 3장 · docs/prototype-plan.md 8장 제안 6·19
-- 선행: 20261023202113_create_products_reviews.sql

create table public.review_analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  review_id uuid not null,
  sentiment text not null check (sentiment in ('positive', 'negative', 'neutral')),
  keywords jsonb not null default '[]',
  pain_points text[] not null default '{}',
  repurchase_factors text[] not null default '{}',
  topics jsonb,
  model text not null,
  prompt_version text not null,
  unique (review_id),
  -- 분석은 같은 워크스페이스의 리뷰에만 붙는다. 리뷰를 지우면 분석도 함께 지워진다
  foreign key (review_id, workspace_id) references public.reviews (id, workspace_id) on delete cascade
);
comment on table public.review_analyses is '리뷰 한 건당 분석 한 행. 분석을 다시 돌리면 이 행을 새 값으로 바꾼다';
comment on column public.review_analyses.keywords is '[{ text, category }]. category: ingredient · texture · price · scent · skin_reaction · other (8장 제안 6)';
comment on column public.review_analyses.topics is '[{ topic, polarity }]. 소구점 찾기용 주제 6개와 칭찬/불만. null = 아직 분류 안 함 (8장 제안 19)';
comment on column public.review_analyses.model is 'AI 결과는 어떤 모델·프롬프트로 만들었는지 남긴다 (CLAUDE.md 5장)';
create index review_analyses_workspace_idx on public.review_analyses (workspace_id);
-- review_id 조회는 unique (review_id) 인덱스가 맡는다

alter table public.review_analyses enable row level security;
create policy "members read" on public.review_analyses
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.review_analyses
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.review_analyses
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.review_analyses
  for delete to authenticated using (public.is_member(workspace_id));
