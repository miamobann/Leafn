-- 리뷰 수집 요청 · 제품별 결과 · 저장 전 임시(대기) 리뷰
-- 흐름: 가져오기(수집기가 대기 리뷰를 채움 → 화면이 미리보기) → [저장] save_collection_run() → products · reviews에 확정
--       저장하지 않고 닫으면 요청을 지운다 (자식 행이 함께 지워진다). 팀 결정(2026-10-23): 임시 보관은 DB의 대기 상태, 안 저장하면 바로 삭제
-- 근거: docs/DB_RULES.md 3장 · CLAUDE.md 3장(웹과 수집기의 접점은 DB뿐)
-- 선행: 20261023202113_create_products_reviews.sql, 20261023030000_launch.sql의 public.set_updated_at()

-- 1. 테이블 -------------------------------------------------------------

create table public.collection_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  platform_id text not null,
  category text not null,
  own_product_id uuid,
  top_n smallint not null check (top_n between 1 and 50),
  max_star smallint not null check (max_star between 1 and 5),
  review_limit smallint not null check (review_limit between 1 and 200),
  status text not null default 'queued' check (status in ('queued', 'running', 'ready', 'saved', 'failed')),
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  saved_at timestamptz,
  saved_count integer check (saved_count >= 0),
  unique (id, workspace_id),
  -- 같은 워크스페이스의 자사 제품만. 제품을 지워도 수집 기록은 남는다 (자사 제품 칸만 비운다)
  foreign key (own_product_id, workspace_id) references public.products (id, workspace_id) on delete set null (own_product_id)
);
comment on table public.collection_runs is '가져오기 한 번 = 한 행. 화면의 드롭다운 값(카테고리 · TOP N · 최대 별점 · 최대 건수)과 진행 상태';
comment on column public.collection_runs.category is '수집기 카테고리 코드 (toner · serum). 저장할 때 products.category(化粧水 · 美容液)로 바꾼다';
comment on column public.collection_runs.own_product_id is '어느 자사 제품의 경쟁 제품을 모으는지. 저장하면 product_competitors에 연결된다';
comment on column public.collection_runs.status is 'queued 대기 → running 수집 중 → ready 미리보기(저장 전) → saved 저장됨. failed는 수집 실패. 저장 안 한 요청은 지운다';
comment on column public.collection_runs.saved_count is '저장할 때 새로 들어간 리뷰 수 (이미 있던 리뷰는 건너뛴다)';
create index collection_runs_created_by_idx on public.collection_runs (created_by);
create index collection_runs_own_product_idx on public.collection_runs (own_product_id, workspace_id);
-- 자사 제품 하나에 열려 있는 미리보기는 하나뿐이다. 새로 가져오려면 이전 것을 먼저 지우거나 저장해야 한다 (임시 결과가 쌓이지 않게)
create unique index collection_runs_open_idx on public.collection_runs (workspace_id, own_product_id)
  where status in ('queued', 'running', 'ready');
create index collection_runs_workspace_idx on public.collection_runs (workspace_id, created_at desc);

create table public.collection_run_products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  run_id uuid not null,
  rank integer not null check (rank >= 1),
  external_id text not null,
  brand text not null default '',
  title text not null,
  url text,
  listing_type text,
  is_set boolean not null default false,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'partial', 'failed')),
  read_count integer not null default 0 check (read_count >= 0),
  skipped_known integer not null default 0 check (skipped_known >= 0),
  stop_reason text check (stop_reason in ('max_star', 'limit', 'end_of_list')),
  site_total_count integer check (site_total_count >= 0),
  site_low_count integer check (site_low_count >= 0),
  error text,
  saved_count integer check (saved_count >= 0),
  product_id uuid,
  unique (id, workspace_id),
  unique (run_id, external_id),
  foreign key (run_id, workspace_id) references public.collection_runs (id, workspace_id) on delete cascade,
  foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete set null (product_id)
);
comment on table public.collection_run_products is '가져오기 한 번에 포함된 제품과 제품별 결과 (순위 · 상태 · 읽은 수). 저장한 뒤에도 남아 "마지막 저장" 기록이 된다';
comment on column public.collection_run_products.rank is '정렬 기준(리뷰 많은 순) 목록에서 사이트가 보여 준 순서. 세트 상품도 순서에 센다';
comment on column public.collection_run_products.external_id is '플랫폼 쪽 제품 번호 (Qoo10 goodscode)';
comment on column public.collection_run_products.listing_type is '사이트 내부 분류(goods_power 등). 광고인지는 확인되지 않아 기록만 한다';
comment on column public.collection_run_products.status is 'done 끝까지 · partial 일부만 · failed 못 읽음. 마지막 성공(done) 기준으로 "새 리뷰 수"를 센다';
comment on column public.collection_run_products.read_count is '읽은 리뷰 수 (이미 가진 id 포함)';
comment on column public.collection_run_products.site_total_count is '그 시점 사이트의 전체 리뷰 수. 사이트가 알려 줄 때만 (확인 전이라 null 허용)';
comment on column public.collection_run_products.site_low_count is '그 시점 사이트의 낮은 별점(max_star 이하) 리뷰 수. 다음 수집 때 비교해 새 리뷰 수를 구한다 (확인 전이라 null 허용)';
comment on column public.collection_run_products.saved_count is '저장할 때 이 제품에서 새로 들어간 리뷰 수';
comment on column public.collection_run_products.product_id is '저장하면 채워진다 (products의 경쟁 제품 행)';
create index collection_run_products_run_idx on public.collection_run_products (run_id, workspace_id);
create index collection_run_products_product_idx on public.collection_run_products (product_id, workspace_id);
create index collection_run_products_history_idx on public.collection_run_products (workspace_id, external_id, created_at desc);

create table public.collection_staged_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  run_product_id uuid not null,
  external_id text not null,
  lang text not null check (lang in ('ko', 'ja')),
  rating numeric(3, 1) not null check (rating >= 0),
  rating_scale smallint not null default 5 check (rating_scale > 0),
  body text not null,
  body_ko text,
  reviewer_attrs jsonb,
  posted_at timestamptz,
  raw jsonb,
  check (rating <= rating_scale),
  unique (run_product_id, external_id),
  foreign key (run_product_id, workspace_id) references public.collection_run_products (id, workspace_id) on delete cascade
);
comment on table public.collection_staged_reviews is '저장 전 미리보기용 임시 리뷰. 저장하면 reviews로 옮기고 지운다. 저장하지 않으면 요청을 지울 때 함께 지워진다';
-- run_product_id 조회는 unique (run_product_id, external_id) 인덱스가 맡는다
create index collection_staged_reviews_workspace_idx on public.collection_staged_reviews (workspace_id);

-- 2. 트리거 -------------------------------------------------------------

create trigger collection_runs_set_updated_at before update on public.collection_runs
  for each row execute function public.set_updated_at();

-- 3. 저장: 미리보기를 확정한다 ------------------------------------------------
-- 로그인한 사용자가 부르면 RLS가 그대로 적용된다 (security invoker). 한 번에 성공하거나 전부 취소된다

create function public.save_collection_run(p_run_id uuid)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  r public.collection_runs%rowtype;
  v_reviews integer;
  v_products integer;
begin
  select * into r from public.collection_runs where id = p_run_id for update;
  if not found then
    raise exception '수집 요청을 찾을 수 없습니다';
  end if;
  if r.status <> 'ready' then
    raise exception '미리보기 상태가 아니라 저장할 수 없습니다 (현재: %)', r.status;
  end if;

  -- 1) 제품: 이미 있으면 갱신, 없으면 경쟁 제품으로 추가
  insert into public.products (workspace_id, kind, brand, name, category, platform_id, external_id, url, source_raw, collected_at)
  select rp.workspace_id, 'competitor', rp.brand, rp.title,
         case r.category when 'toner' then '化粧水' when 'serum' then '美容液' else r.category end,
         r.platform_id, rp.external_id, rp.url,
         jsonb_build_object(
           'rank', rp.rank, 'sort', 'MOST_REVIEWED', 'listing_type', rp.listing_type, 'is_set', rp.is_set,
           'site_total_count', rp.site_total_count, 'site_low_count', rp.site_low_count,
           'captured_at', coalesce(r.finished_at, now())),
         now()
  from public.collection_run_products rp
  where rp.run_id = r.id and rp.status in ('done', 'partial')
  on conflict (workspace_id, platform_id, external_id) do update
    set brand = excluded.brand, name = excluded.name, url = excluded.url,
        source_raw = excluded.source_raw, collected_at = excluded.collected_at;

  update public.collection_run_products rp set product_id = p.id
  from public.products p
  where rp.run_id = r.id and rp.status in ('done', 'partial')
    and p.workspace_id = rp.workspace_id and p.platform_id = r.platform_id and p.external_id = rp.external_id;

  -- 2) 자사 제품과 경쟁 제품 연결
  if r.own_product_id is not null then
    insert into public.product_competitors (workspace_id, own_product_id, competitor_product_id)
    select r.workspace_id, r.own_product_id, rp.product_id
    from public.collection_run_products rp
    where rp.run_id = r.id and rp.product_id is not null
    on conflict (own_product_id, competitor_product_id) do nothing;
  end if;

  -- 3) 리뷰: 이미 가진 리뷰(같은 워크스페이스 · 출처 · 번호)는 건너뛴다. 제품별로 새로 들어간 수를 센다
  with inserted as (
    insert into public.reviews (workspace_id, product_id, source, external_id, lang, rating, rating_scale, body, body_ko, reviewer_attrs, posted_at, raw)
    select s.workspace_id, rp.product_id, r.platform_id, s.external_id, s.lang, s.rating, s.rating_scale, s.body, s.body_ko, s.reviewer_attrs, s.posted_at, s.raw
    from public.collection_staged_reviews s
    join public.collection_run_products rp on rp.id = s.run_product_id and rp.workspace_id = s.workspace_id
    where rp.run_id = r.id and rp.product_id is not null
    on conflict (workspace_id, source, external_id) do nothing
    returning product_id
  ), per_product as (
    select product_id, count(*)::integer as n from inserted group by product_id
  )
  update public.collection_run_products rp
  set saved_count = coalesce((select n from per_product pp where pp.product_id = rp.product_id), 0)
  where rp.run_id = r.id and rp.product_id is not null;

  select coalesce(sum(saved_count), 0)::integer, count(*)::integer into v_reviews, v_products
  from public.collection_run_products where run_id = r.id and product_id is not null;

  -- 4) 임시 리뷰를 비우고 요청을 저장됨으로 바꾼다 (제품별 결과는 "마지막 저장" 기록으로 남는다)
  delete from public.collection_staged_reviews s
  using public.collection_run_products rp
  where rp.id = s.run_product_id and rp.workspace_id = s.workspace_id and rp.run_id = r.id;

  update public.collection_runs set status = 'saved', saved_at = now(), saved_count = v_reviews where id = r.id;

  return jsonb_build_object('run_id', r.id, 'products', v_products, 'new_reviews', v_reviews);
end;
$$;
comment on function public.save_collection_run(uuid) is '미리보기(ready)를 확정한다. 제품 · 연결 · 리뷰를 한 번에 넣고 임시 리뷰를 비운다. 이미 있는 리뷰는 건너뛴다';
revoke all on function public.save_collection_run(uuid) from public, anon;
grant execute on function public.save_collection_run(uuid) to authenticated;

-- 4. RLS: 같은 워크스페이스 멤버면 읽기·쓰기·지우기 (저장 안 한 미리보기를 지우려면 delete가 필요하다) ---------
-- 수집기(service role)는 RLS를 우회하므로 workspace_id를 코드에서 반드시 넣는다 (DB_RULES 4.1)

alter table public.collection_runs enable row level security;
create policy "members read" on public.collection_runs
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.collection_runs
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.collection_runs
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.collection_runs
  for delete to authenticated using (public.is_member(workspace_id));

alter table public.collection_run_products enable row level security;
create policy "members read" on public.collection_run_products
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.collection_run_products
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.collection_run_products
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.collection_run_products
  for delete to authenticated using (public.is_member(workspace_id));

alter table public.collection_staged_reviews enable row level security;
create policy "members read" on public.collection_staged_reviews
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.collection_staged_reviews
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.collection_staged_reviews
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.collection_staged_reviews
  for delete to authenticated using (public.is_member(workspace_id));
