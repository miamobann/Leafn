-- 진출 실행: 플랫폼별 메모, 프로모션 행사, 행사 준비 마감
-- 근거: docs/db-frame.md 2장 "진출 실행" (확정 2026-10-23), 4장 RLS 패턴 · docs/DB_RULES.md 3장
-- platform_id는 FK 없이 text로 둔다. platforms 테이블과 slug가 정해지면 새 마이그레이션에서 FK만 더한다

-- 1. 공통 트리거 함수 ------------------------------------------------------

-- 행이 바뀔 때 updated_at을 지금 시각으로
create function public.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 고친 사람을 updated_by에 남긴다. 수집기(service role)처럼 로그인 사용자가 없으면 넣은 값을 그대로 둔다
create function public.set_updated_by()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

-- 2. 테이블 -------------------------------------------------------------

create table public.platform_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  platform_id text not null,
  status text check (status in ('reviewing', 'preparing', 'live')),
  strengths text,
  audience text,
  fees_note text,
  fees_source_url text,
  fees_checked_at date,
  memo text,
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (workspace_id, platform_id)
);
comment on table public.platform_notes is '팀이 보는 플랫폼별 메모 (H). 워크스페이스마다 플랫폼 하나에 한 행';
comment on column public.platform_notes.status is 'null = 아직 안 봄';
comment on column public.platform_notes.fees_note is '공식 자료 확인 전에는 null. 출처와 확인일을 함께 적는다';
create index platform_notes_updated_by_idx on public.platform_notes (updated_by);
-- workspace_id 조회는 unique (workspace_id, platform_id) 인덱스가 맡는다

create table public.promo_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  platform_id text,
  kind text not null check (kind in ('platform_event', 'own_campaign')),
  title text not null check (char_length(btrim(title)) >= 1),
  start_date date not null,
  end_date date not null,
  is_confirmed boolean not null default false,
  source_url text,
  memo text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (end_date >= start_date),
  unique (id, workspace_id)
);
comment on table public.promo_events is '플랫폼 행사와 자사 캠페인 (I)';
comment on column public.promo_events.platform_id is '자사 캠페인이면 null';
comment on column public.promo_events.is_confirmed is 'false = 과거 패턴으로 넣은 예상 일정';
comment on constraint promo_events_id_workspace_id_key on public.promo_events is 'promo_milestones 복합 FK의 대상';
create index promo_events_workspace_start_idx on public.promo_events (workspace_id, start_date);
create index promo_events_created_by_idx on public.promo_events (created_by);

create table public.promo_milestones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  promo_event_id uuid not null,
  label text not null check (char_length(btrim(label)) >= 1),
  due_date date not null,
  done_at timestamptz,
  -- 두 팀에 속한 사람이 다른 팀 행사에 마감을 붙이지 못하게 한다 (RLS는 workspace_id만 본다)
  foreign key (promo_event_id, workspace_id) references public.promo_events (id, workspace_id) on delete cascade
);
comment on table public.promo_milestones is '행사 하나의 준비 마감들. 화면의 "준비 마감" = 가장 이른 미완료 마감';
comment on column public.promo_milestones.done_at is 'null = 미완료';
create index promo_milestones_workspace_due_idx on public.promo_milestones (workspace_id, due_date);
create index promo_milestones_event_idx on public.promo_milestones (promo_event_id, workspace_id);

-- 3. 트리거 -------------------------------------------------------------

create trigger platform_notes_set_updated_at before update on public.platform_notes
  for each row execute function public.set_updated_at();
create trigger platform_notes_set_updated_by before insert or update on public.platform_notes
  for each row execute function public.set_updated_by();
create trigger promo_events_set_updated_at before update on public.promo_events
  for each row execute function public.set_updated_at();
create trigger promo_milestones_set_updated_at before update on public.promo_milestones
  for each row execute function public.set_updated_at();

-- 4. RLS: 같은 워크스페이스 멤버면 읽기·쓰기·지우기 (db-frame 4장) --------------------
-- 두 워크스페이스에 모두 속한 사람은 update로 행을 다른 쪽으로 옮길 수 있다. 양쪽 멤버라 허용한다

alter table public.platform_notes enable row level security;
create policy "members read" on public.platform_notes
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.platform_notes
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.platform_notes
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.platform_notes
  for delete to authenticated using (public.is_member(workspace_id));

alter table public.promo_events enable row level security;
create policy "members read" on public.promo_events
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.promo_events
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.promo_events
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.promo_events
  for delete to authenticated using (public.is_member(workspace_id));

alter table public.promo_milestones enable row level security;
create policy "members read" on public.promo_milestones
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.promo_milestones
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.promo_milestones
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.promo_milestones
  for delete to authenticated using (public.is_member(workspace_id));
