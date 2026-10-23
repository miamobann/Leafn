-- AI 검색 노출 (참조 GEO · Share of Model): 엔진 1회 질의 = 1행
-- 근거: CLAUDE.md 5장 geo_snapshots (engine, query, answer, brands_mentioned, captured_at) + 확장 칸 · docs/DB_RULES.md 3장 템플릿
-- 모양: apps/web/lib/schemas/geo.ts

create table public.geo_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  engine text not null check (engine in ('chatgpt', 'gemini', 'perplexity')),
  model text not null,
  prompt_version text,
  query text not null,
  query_concern text check (query_concern in ('pores', 'acne', 'dryness', 'sensitivity', 'dullness', 'aging', 'redness', 'oiliness', 'other')),
  run_index integer not null default 1 check (run_index >= 1),
  answer text not null,
  brands_mentioned text[] not null default '{}',
  brand_mentions jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null,
  unique (workspace_id, engine, query, run_index, captured_at)
);
comment on table public.geo_snapshots is 'AI 검색 답변 수집. 화면: 시장 분석 > AI 검색 노출(GEO)';
comment on column public.geo_snapshots.prompt_version is 'LLM 보조 추출(사전에 없는 브랜드·키워드)에 쓴 프롬프트. 사전 대조만 했으면 null';
comment on column public.geo_snapshots.run_index is '같은 질의 반복 회차 (repeatCount). 화면은 엔진×질의 칸마다 평균을 낸다';
comment on column public.geo_snapshots.brand_mentions is '[{ brand, rank, matched_text, source: dictionary|llm }]. llm 항목도 답변 원문 대조를 통과한 것만';
comment on column public.geo_snapshots.citations is '[{ url, domain, title }]. 엔진 API의 인용 칸에서만 채운다';
comment on column public.geo_snapshots.keywords is '[{ keyword, matched_text, source: dictionary|llm }]';

create index geo_snapshots_workspace_id_idx on public.geo_snapshots (workspace_id);

alter table public.geo_snapshots enable row level security;

create policy "geo_snapshots read members" on public.geo_snapshots
  for select to authenticated using (public.is_member(workspace_id));
create policy "geo_snapshots insert members" on public.geo_snapshots
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "geo_snapshots update members" on public.geo_snapshots
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "geo_snapshots delete members" on public.geo_snapshots
  for delete to authenticated using (public.is_member(workspace_id));
