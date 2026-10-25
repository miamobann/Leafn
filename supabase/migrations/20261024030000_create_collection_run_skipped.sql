-- 수집 요청에서 '비교 대상이 아니라 자동으로 뺀 제품' 기록 (lab 실험)
-- 왜: Qoo10 화장수 카테고리 목록에는 세트, 여러 종류를 함께 파는 시리즈, 클렌징·크림 같은 다른 종류가 섞여 있다. 수집기가 제목으로 확실한 것만 빼는데
--     (sources/qoo10.py classify_listing), 규칙이 틀릴 수 있어서 조용히 버리지 않고 이유와 함께 남겨 화면에서 사람이 볼 수 있게 한다.
--     뺀 제품은 리뷰를 읽지 않으므로 collection_run_products(제품별 결과)와 섞지 않고 따로 둔다 (save_collection_run은 건드리지 않는다).
-- 어떻게: 수집 요청(collection_runs)에 딸린 행이다. 요청을 지우면 함께 지워진다. 화면은 읽기만 한다 (뺀 제품을 다시 포함시키는 기능은 없다)
-- 선행: 20261023211500_create_collection_runs.sql. 기존 마이그레이션 파일은 고치지 않았다 (DB_RULES)

create table public.collection_run_skipped (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  run_id uuid not null,
  rank integer not null check (rank >= 1),
  external_id text not null,
  brand text not null default '',
  title text not null,
  url text,
  reason text not null check (reason in ('set', 'multi_type', 'not_toner')),
  unique (run_id, external_id),
  foreign key (run_id, workspace_id) references public.collection_runs (id, workspace_id) on delete cascade
);
comment on table public.collection_run_skipped is '비교 대상이 아니라 자동으로 뺀 제품 (제목 규칙). 리뷰는 읽지 않았다. 화면에서 "자동으로 뺀 제품"으로 보여 준다';
comment on column public.collection_run_skipped.rank is '사이트가 보여 준 순서 (collection_run_products.rank와 같은 기준). 뺀 자리도 순서에 센다';
comment on column public.collection_run_skipped.reason is 'set 세트·기획 상품 / multi_type 한 목록에서 여러 종류를 함께 파는 상품 / not_toner 수집 카테고리의 대상 종류가 아닌 제품';
-- run_id 조회는 unique (run_id, external_id) 인덱스가 맡는다
create index collection_run_skipped_workspace_idx on public.collection_run_skipped (workspace_id);

-- RLS: 같은 워크스페이스 멤버면 읽기·쓰기·지우기 (다른 수집 테이블과 같다). 수집기(service role)는 RLS를 우회하므로 workspace_id를 코드에서 반드시 넣는다 (DB_RULES 4.1)
alter table public.collection_run_skipped enable row level security;
create policy "members read" on public.collection_run_skipped
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.collection_run_skipped
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.collection_run_skipped
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.collection_run_skipped
  for delete to authenticated using (public.is_member(workspace_id));
