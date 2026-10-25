-- 검색 자동완성 스냅샷 (B 확장 · 미래 트렌드): 시드 검색어 1개 × 수집 1회 = 1행
-- 근거: docs/DB_RULES.md 3장 템플릿 · 모양: apps/web/lib/schemas/search.ts
-- 매주 쌓아서 어떤 성분·피부 고민이 자동완성에 새로 나오거나 위로 올라오는지 본다

create table public.search_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  engine text not null check (engine in ('google_autocomplete')),
  seed text not null,
  gl text not null,
  hl text not null,
  captured_at timestamptz not null,
  suggestions jsonb not null default '[]'::jsonb,
  unique (workspace_id, engine, seed, gl, hl, captured_at)
);
comment on table public.search_snapshots is '검색 자동완성 수집 결과 (SerpApi). 화면: 성분 관심도 > 미래 트렌드';
comment on column public.search_snapshots.suggestions is '[{ value, position, relevance }]. serpapi_link 등 원본의 다른 칸은 저장하지 않는다';

create index search_snapshots_workspace_id_idx on public.search_snapshots (workspace_id);

alter table public.search_snapshots enable row level security;

create policy "search_snapshots read members" on public.search_snapshots
  for select to authenticated using (public.is_member(workspace_id));
create policy "search_snapshots insert members" on public.search_snapshots
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "search_snapshots update members" on public.search_snapshots
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "search_snapshots delete members" on public.search_snapshots
  for delete to authenticated using (public.is_member(workspace_id));
