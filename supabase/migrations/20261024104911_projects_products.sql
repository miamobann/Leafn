-- 프로젝트(제품군)와 제품: 워크스페이스(팀) → 프로젝트(예: Leaf& Dew) → 제품 (2026-10-24 총괄 결정)
-- 테이블 이름은 projects, 제품은 products에 칸(project_id, sale_status, skin_line)을 더한다 (2026-10-24 총괄 결정)
-- 선행: 20261023202113_create_products_reviews.sql (products, PR #48) · 20261023030000_launch.sql (set_updated_at)
-- 근거: docs/db-frame.md 2장 · docs/DB_RULES.md 3장 · RLS는 기반 마이그레이션의 is_member(), updated_at 트리거는 launch 마이그레이션의 set_updated_at()
-- platform_id는 launch 테이블과 같이 FK 없이 text로 둔다. platforms 테이블이 생기면 새 마이그레이션에서 FK만 더한다

-- 1. 테이블 -------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) >= 1),
  platform_id text,
  description text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (workspace_id, name),
  unique (id, workspace_id)
);
comment on table public.projects is '프로젝트 = 함께 진출하는 제품군 (예: Leaf& Dew). 화면 헤더에서 고른다';
comment on column public.projects.platform_id is '진출 플랫폼 slug. 시연은 qoo10만';
comment on constraint projects_id_workspace_id_key on public.projects is 'products 복합 FK의 대상';
-- workspace_id 조회는 unique (workspace_id, name) 인덱스가 맡는다
create index projects_created_by_idx on public.projects (created_by);

-- products는 리뷰 분석(TAB 2) 마이그레이션 20261023202113_create_products_reviews.sql(PR #48)이 만든다. 여기서는 칸만 더한다
alter table public.products
  add column project_id uuid,
  add column sale_status text check (sale_status in ('on_sale', 'in_development')),
  add column skin_line text check (skin_line in ('dry', 'oily', 'combo')),
  add constraint products_project_id_workspace_id_fkey
    foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete set null (project_id);
comment on column public.products.project_id is '속한 프로젝트. 경쟁 제품이나 아직 정하지 않은 제품은 null. 프로젝트를 지우면 null이 된다';
comment on column public.products.sale_status is '자사 제품의 판매 상태. 경쟁 제품은 null';
comment on column public.products.skin_line is '자사 제품이 겨냥하는 피부 라인. null = 정하지 않음 (설문의 피부 타입 진단과는 다른 값)';
create index products_project_idx on public.products (project_id);
-- 한 프로젝트 안에서 제품 이름은 겹치지 않는다 (프로젝트 밖의 제품은 플랫폼마다 같은 이름이 있을 수 있어 막지 않는다)
create unique index products_project_name_key on public.products (project_id, name) where project_id is not null;

-- 2. 트리거 -------------------------------------------------------------

create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- 3. RLS ---------------------------------------------------------------

alter table public.projects enable row level security;

create policy "members read" on public.projects
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.projects
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.projects
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.projects
  for delete to authenticated using (public.is_member(workspace_id));
-- products의 RLS 정책은 #48 마이그레이션에 있다
