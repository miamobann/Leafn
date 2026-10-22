-- 기반: 프로필, 워크스페이스, 멤버십, 권한 함수
-- 근거: docs/db-frame.md 2장 "기반", 4장 RLS 패턴 · docs/DB_RULES.md 3장
-- 결정(2026-10-22): 한 사용자가 여러 워크스페이스에 속할 수 있다 (화면은 우선 하나만 쓴다)

-- 1. 테이블 -------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text,
  title text
);
comment on table public.profiles is '사용자 표시 정보. 가입하면 트리거로 자동 생성 (db-frame 8장 16번 제안)';

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
);
comment on column public.workspaces.invite_code is '팀원이 온보딩 화면에서 입력하는 참여 코드';

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  unique (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- 2. 권한 확인 함수 (RLS 정책 안에서 쓴다. security definer라 정책이 서로를 다시 부르지 않는다) ----

create function public.is_member(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

create function public.is_owner(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

-- 나와 같은 워크스페이스에 있는 사람인가 (프로필 읽기용)
create function public.shares_workspace(other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members a
    join public.workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  );
$$;

-- 3. 가입 시 프로필 자동 생성 ----------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 이미 있는 사용자도 프로필을 만든다
insert into public.profiles (id, display_name)
select u.id, split_part(u.email, '@', 1) from auth.users u
on conflict (id) do nothing;

-- 4. 워크스페이스 만들기·참여 (insert는 이 함수로만) --------------------------

create function public.create_workspace(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  ws_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다';
  end if;
  insert into public.workspaces (name) values (btrim(p_name)) returning id into ws_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws_id, (select auth.uid()), 'owner');
  return ws_id;
end;
$$;

create function public.join_workspace(p_invite_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  ws_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다';
  end if;
  select id into ws_id from public.workspaces where invite_code = upper(btrim(p_invite_code));
  if ws_id is null then
    raise exception '초대 코드를 찾을 수 없습니다';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, (select auth.uid()), 'member')
  on conflict (workspace_id, user_id) do nothing;
  return ws_id;
end;
$$;

revoke execute on function public.is_member(uuid), public.is_owner(uuid), public.shares_workspace(uuid),
  public.create_workspace(text), public.join_workspace(text) from public, anon;
grant execute on function public.is_member(uuid), public.is_owner(uuid), public.shares_workspace(uuid),
  public.create_workspace(text), public.join_workspace(text) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 5. RLS ----------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- profiles: 나와 같은 팀 사람만 보이고, 내 것만 고친다. insert는 트리거만
create policy "profiles read self or teammates" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.shares_workspace(id));
create policy "profiles update self" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- workspaces: 멤버만 읽고, owner만 고치거나 지운다. 만들기는 create_workspace()로만
create policy "workspaces read members" on public.workspaces
  for select to authenticated using (public.is_member(id));
create policy "workspaces update owner" on public.workspaces
  for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));
create policy "workspaces delete owner" on public.workspaces
  for delete to authenticated using (public.is_owner(id));

-- workspace_members: 멤버끼리 서로 보이고, owner가 역할을 바꾸거나 내보낸다.
-- 본인은 스스로 나갈 수 있다 (owner 제외). 추가는 create_workspace()·join_workspace()로만
create policy "members read members" on public.workspace_members
  for select to authenticated using (public.is_member(workspace_id));
create policy "members update owner" on public.workspace_members
  for update to authenticated using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));
create policy "members delete owner or self" on public.workspace_members
  for delete to authenticated using (public.is_owner(workspace_id) or (user_id = (select auth.uid()) and role <> 'owner'));
