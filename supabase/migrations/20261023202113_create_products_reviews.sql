-- 리뷰 분석(TAB 2): 제품, 경쟁 제품 연결, 리뷰 원문
-- 근거: CLAUDE.md 5장 · docs/DB_RULES.md 3장 · docs/prototype-plan.md 8장 제안 7·8·9·11·15
-- products는 db-frame · 진출 실행(확정)과 같은 platform_id(text, FK 없음)를 쓴다 (2026-10-23 결정). reviews.source는 CLAUDE.md 5장 이름 그대로
-- platforms 테이블이 생기면 새 마이그레이션에서 FK만 더한다 (칸 이름은 바뀌지 않는다)
-- 선행: 20261023030000_launch.sql 의 public.set_updated_at()

-- 1. 테이블 -------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('own', 'competitor')),
  brand text not null,
  name text not null check (char_length(btrim(name)) >= 1),
  category text,
  platform_id text not null,
  external_id text,
  url text,
  price_jpy integer check (price_jpy >= 0),
  price_kind text not null default 'regular' check (price_kind in ('regular', 'sale')),
  volume_ml numeric check (volume_ml > 0),
  ingredients text[] not null default '{}',
  features text[] not null default '{}',
  image_path text,
  source_raw jsonb,
  collected_at timestamptz,
  unique (id, workspace_id),
  unique (workspace_id, platform_id, external_id)
);
comment on table public.products is '자사 제품과 경쟁 제품 (E, C). ml당 가격은 저장하지 않고 화면에서 계산한다';
comment on column public.products.platform_id is 'platforms slug (qoo10, rakuten …). platforms 테이블이 생기면 FK만 더한다';
comment on column public.products.external_id is '플랫폼 쪽 제품 번호 (Qoo10 goodscode). 수집한 제품의 중복 방지용. 직접 입력한 제품은 null';
comment on column public.products.price_kind is '정가(regular)와 행사가(sale) 구분 (8장 제안 11)';
comment on column public.products.category is '化粧水 · 美容液 등. 같은 카테고리끼리 비교한다 (8장 제안 15)';
comment on column public.products.source_raw is '수집 원본과 화면이 꺼내 쓰는 값 (평점 · 리뷰 수 · 순위 · 정렬 기준 · 수집 시각). DB_RULES 2.1';
comment on column public.products.collected_at is '수집한 시각. 직접 입력한 제품은 null';
comment on constraint products_id_workspace_id_key on public.products is 'reviews · product_competitors 복합 FK의 대상';
create index products_workspace_kind_idx on public.products (workspace_id, kind);
-- workspace_id 조회는 unique (workspace_id, platform_id, external_id) 인덱스가 맡는다

create table public.product_competitors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  own_product_id uuid not null,
  competitor_product_id uuid not null,
  check (own_product_id <> competitor_product_id),
  unique (own_product_id, competitor_product_id),
  -- 두 팀에 속한 사람이 다른 팀 제품을 엮지 못하게 한다 (RLS는 workspace_id만 본다)
  foreign key (own_product_id, workspace_id) references public.products (id, workspace_id) on delete cascade,
  foreign key (competitor_product_id, workspace_id) references public.products (id, workspace_id) on delete cascade
);
comment on table public.product_competitors is '어느 경쟁 제품이 어느 자사 제품의 경쟁인지. 경쟁 제품 하나가 여러 자사 제품의 경쟁일 수 있다';
comment on column public.product_competitors.own_product_id is 'kind = own 이어야 한다. 이 규칙은 check로 못 걸어서 넣는 코드에서 확인한다';
comment on column public.product_competitors.competitor_product_id is 'kind = competitor 이어야 한다 (위와 같음)';
create index product_competitors_workspace_idx on public.product_competitors (workspace_id);
create index product_competitors_competitor_idx on public.product_competitors (competitor_product_id, workspace_id);
-- own_product_id 조회는 unique (own_product_id, competitor_product_id) 인덱스가 맡는다

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid not null,
  source text not null check (source in ('cosme', 'rakuten', 'qoo10', 'oliveyoung', 'csv')),
  external_id text not null,
  lang text not null check (lang in ('ko', 'ja')),
  rating numeric(3, 1) not null check (rating >= 0),
  rating_scale smallint not null default 5 check (rating_scale > 0),
  body text not null,
  body_ko text,
  reviewer_attrs jsonb,
  posted_at timestamptz,
  raw jsonb,
  collected_at timestamptz not null default now(),
  check (rating <= rating_scale),
  unique (id, workspace_id),
  unique (workspace_id, source, external_id),
  -- 리뷰는 같은 워크스페이스의 제품에만 붙는다. 제품을 지우면 리뷰와 분석도 함께 지워진다
  foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete cascade
);
comment on table public.reviews is '리뷰 원문 (E, D). 같은 리뷰를 두 번 수집해도 (workspace_id, source, external_id)로 한 행만 남는다';
comment on column public.reviews.source is '리뷰를 가져온 곳. csv는 직접 올린 파일';
comment on column public.reviews.external_id is '플랫폼 쪽 리뷰 번호 (Qoo10 like_R_ 뒤의 숫자). csv는 줄 번호나 해시';
comment on column public.reviews.rating_scale is '평점 척도. 플랫폼마다 다르다 (8장 제안 8)';
comment on column public.reviews.body_ko is '일본어 리뷰의 한국어 해석 (8장 제안 7)';
comment on column public.reviews.reviewer_attrs is '작성자 속성 {age_group, skin_type …}. 없는 값은 키를 두지 않는다 (8장 제안 9)';
comment on column public.reviews.posted_at is '플랫폼에 올라온 날짜. 날짜만 주는 곳은 그날 0시. 모르면 null';
comment on column public.reviews.raw is '수집 원본 (옵션 · 항목평가 · 좋아요 수 · 마스킹된 작성자). 파서가 바뀌어도 다시 가공할 수 있게 둔다';
create index reviews_product_idx on public.reviews (product_id, workspace_id);
-- workspace_id 조회는 unique (workspace_id, source, external_id) 인덱스가 맡는다

-- 2. 트리거 -------------------------------------------------------------

create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- 3. RLS: 같은 워크스페이스 멤버면 읽기·쓰기·지우기 (db-frame 4장) --------------------
-- 수집기(service role)는 RLS를 우회하므로 workspace_id를 코드에서 반드시 넣는다 (DB_RULES 4.1)

alter table public.products enable row level security;
create policy "members read" on public.products
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.products
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.products
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.products
  for delete to authenticated using (public.is_member(workspace_id));

alter table public.product_competitors enable row level security;
create policy "members read" on public.product_competitors
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.product_competitors
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.product_competitors
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.product_competitors
  for delete to authenticated using (public.is_member(workspace_id));

alter table public.reviews enable row level security;
create policy "members read" on public.reviews
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.reviews
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.reviews
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.reviews
  for delete to authenticated using (public.is_member(workspace_id));
