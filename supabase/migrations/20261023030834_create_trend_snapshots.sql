-- 시장 트렌드 스냅샷 (B): 楽天·Qoo10 랭킹을 출처별로 따로 저장한다
-- 근거: CLAUDE.md 5장 trend_snapshots · docs/DB_RULES.md 3장 템플릿
-- data jsonb 모양: apps/web/lib/schemas/trend.ts (ranking[] + 상위 상품의 appeal, ingredients[])

create table public.trend_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  source text not null check (source in ('rakuten_ranking', 'qoo10_ranking')),
  category text not null,
  captured_at timestamptz not null,
  data jsonb not null default '{}'::jsonb,
  -- 같은 출처·카테고리·수집 시각은 한 행 (다시 분석하면 덮어쓴다). 출처가 다르면 다른 행이라 楽天과 Qoo10이 섞이지 않는다
  unique (workspace_id, source, category, captured_at)
);
comment on table public.trend_snapshots is '랭킹 스냅샷. 화면: 시장 트렌드, 성분 관심도';
comment on column public.trend_snapshots.data is 'ranking[] (상위 상품은 이미지 분석 결과 appeal 포함), ingredients[]. 모양은 lib/schemas/trend.ts';

create index trend_snapshots_workspace_id_idx on public.trend_snapshots (workspace_id);

alter table public.trend_snapshots enable row level security;

create policy "trend_snapshots read members" on public.trend_snapshots
  for select to authenticated using (public.is_member(workspace_id));
create policy "trend_snapshots insert members" on public.trend_snapshots
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "trend_snapshots update members" on public.trend_snapshots
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "trend_snapshots delete members" on public.trend_snapshots
  for delete to authenticated using (public.is_member(workspace_id));
