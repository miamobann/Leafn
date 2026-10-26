-- 탭별 시안 제출 · 팀장 결재 · AI 분석: 담당 탭, 시안, 버전, 결재 기록, AI 분석 결과
-- 근거: docs/team-approval-ai-analysis.md 4~6장 (7장 1단계) · docs/DB_RULES.md 3장
-- 선행: 20261022082907_base_workspaces.sql (is_member, is_owner, workspace_members) · 20261023030000_launch.sql (set_updated_at)
--       · 20261024104911_projects_products.sql (projects, products.project_id·sale_status) · 20261024130000_create_ad_checks.sql (ad_checks)
-- 상태 바꾸기(제출 · 제출 취소 · 승인/반려 · 숨김 · 팀장 확인)는 아래 5장의 함수로만 한다.
-- 표 정책만으로는 "제출 후 고정", "반려 사유 필수", "자기 결재 표시", ad_checks 상태 맞추기를 한 번에 지킬 수 없어서다 (create_workspace()와 같은 방식).

-- 1. 탭 담당 권한 -----------------------------------------------------------

create table public.member_tabs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null,
  tab text not null check (tab in ('market', 'review', 'ad')),
  granted_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (workspace_id, user_id, tab),
  -- 팀에서 나가면 담당 탭도 같이 지워진다
  foreign key (workspace_id, user_id) references public.workspace_members (workspace_id, user_id) on delete cascade
);
comment on table public.member_tabs is '멤버별 담당 탭. 팀장(owner)이 설정 화면에서 준다. owner는 행이 없어도 모든 탭 담당이다 (has_tab)';
-- workspace_id·user_id 조회는 unique (workspace_id, user_id, tab) 인덱스가 맡는다
create index member_tabs_granted_by_idx on public.member_tabs (granted_by);

-- 멤버가 그 탭 담당인가. owner는 항상 true
create function public.has_tab(ws uuid, p_tab text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_owner(ws) or exists (
    select 1 from public.member_tabs t
    where t.workspace_id = ws and t.user_id = (select auth.uid()) and t.tab = p_tab
  );
$$;

-- 2. 시안 · 버전 · 결재 기록 ---------------------------------------------------

create table public.tab_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null,
  product_id uuid,
  tab text not null check (tab in ('market', 'review', 'ad')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  owner_id uuid default auth.uid() references public.profiles (id) on delete set null,
  approved_version_id uuid,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'rejected')),
  deleted_at timestamptz,
  unique (id, workspace_id),
  -- 프로젝트 전체 시안(product_id 비움)은 시장 분석만 (설계 8장 보완 6)
  constraint tab_submissions_project_scope_market_only check (product_id is not null or tab = 'market'),
  -- 결재 기록을 지키려고 시안이 있는 프로젝트·제품은 지우지 못한다 (on delete 기본값 no action)
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id),
  foreign key (product_id, workspace_id) references public.products (id, workspace_id)
);
comment on table public.tab_submissions is '시안 = 제품 하나 × 탭 하나 (시장 분석은 프로젝트 전체도). 진행 표의 한 칸이 이 행을 읽는다';
comment on column public.tab_submissions.approved_version_id is '지금 기준인 승인본. 새 버전이 승인되기 전까지 이전 승인본이 기준이다';
comment on column public.tab_submissions.status is 'draft = 제출 전 · in_review = 결재 대기 버전 있음 · approved = 승인본 있음 · rejected = 승인본 없이 반려됨. 함수가 버전 상태로 다시 계산한다';
comment on column public.tab_submissions.deleted_at is '화면의 삭제 = 숨김. 승인본이 있거나 AI 분석에 쓰인 시안은 숨기지 못한다';
-- 같은 칸에는 숨기지 않은 시안이 하나만 있다 (프로젝트 전체 시안은 product_id가 비어 있어 nulls not distinct)
create unique index tab_submissions_cell_key on public.tab_submissions (workspace_id, project_id, product_id, tab)
  nulls not distinct where deleted_at is null;
create index tab_submissions_project_idx on public.tab_submissions (project_id);
create index tab_submissions_product_idx on public.tab_submissions (product_id);
create index tab_submissions_owner_idx on public.tab_submissions (owner_id);
create index tab_submissions_approved_version_idx on public.tab_submissions (approved_version_id);

create table public.submission_versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  submission_id uuid not null,
  version_no integer not null check (version_no >= 1),
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  summary text not null default '' check (char_length(summary) <= 300),
  body jsonb not null default '{}' check (jsonb_typeof(body) = 'object'),
  evidence jsonb not null default '[]' check (jsonb_typeof(evidence) = 'array'),
  data_as_of timestamptz,
  note text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'withdrawn')),
  submitted_at timestamptz,
  deleted_at timestamptz,
  unique (submission_id, version_no),
  unique (id, workspace_id),
  foreign key (submission_id, workspace_id) references public.tab_submissions (id, workspace_id) on delete cascade
);
comment on table public.submission_versions is '시안의 버전 히스토리. 제출하면 내용을 고칠 수 없고, 고치려면 새 버전(v+1)을 만든다';
comment on column public.submission_versions.summary is '한 줄 결론. 제출할 때 비어 있으면 안 된다';
comment on column public.submission_versions.body is '탭별 결과 스냅샷. 모양은 lib/schemas/submission.ts의 MarketBody · ReviewBody · AdBody';
comment on column public.submission_versions.evidence is '근거 목록 [{ kind: review | product | ad_check | trend_snapshot, id }]. 배열이라 FK 검사가 없으므로 넣는 코드에서 확인한다 (DB_RULES 4.2)';
comment on column public.submission_versions.data_as_of is '근거 데이터 기준 시각. AI 분석 선택 화면에서 버전끼리 차이가 30일을 넘으면 경고한다';
comment on column public.submission_versions.deleted_at is '화면의 삭제 = 숨김. 승인된 버전과 AI 분석에 쓰인 버전은 숨기지 못한다';
create index submission_versions_workspace_idx on public.submission_versions (workspace_id, created_at desc);
create index submission_versions_author_idx on public.submission_versions (author_id);
-- submission_id 조회는 unique (submission_id, version_no) 인덱스가 맡는다

alter table public.tab_submissions
  add constraint tab_submissions_approved_version_fkey
    foreign key (approved_version_id, workspace_id) references public.submission_versions (id, workspace_id);

create table public.submission_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version_id uuid not null,
  reviewer_id uuid references public.profiles (id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected')),
  reason text,
  is_self_review boolean not null default false,
  decided_at timestamptz not null default now(),
  constraint submission_reviews_reject_reason check (decision = 'approved' or char_length(btrim(coalesce(reason, ''))) > 0),
  foreign key (version_id, workspace_id) references public.submission_versions (id, workspace_id) on delete cascade
);
comment on table public.submission_reviews is '결재 기록. 누가 언제 왜 승인·반려했는지. 지우지 않는다 (decide_version()으로만 쓴다)';
comment on column public.submission_reviews.is_self_review is '팀장이 자기 버전을 결재했으면 true (설계 8장 보완 5)';
create index submission_reviews_workspace_idx on public.submission_reviews (workspace_id, decided_at desc);
create index submission_reviews_version_idx on public.submission_reviews (version_id);
create index submission_reviews_reviewer_idx on public.submission_reviews (reviewer_id);

-- 3. AI 분석 결과 ------------------------------------------------------------

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null,
  product_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  input_version_ids uuid[] not null check (cardinality(input_version_ids) >= 1),
  result jsonb not null,
  summary text,
  model text not null,
  prompt_version text not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  lead_checked_by uuid references public.profiles (id) on delete set null,
  lead_checked_at timestamptz,
  deleted_at timestamptz,
  unique (id, workspace_id),
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id),
  foreign key (product_id, workspace_id) references public.products (id, workspace_id)
);
comment on table public.ai_analyses is '탭별 승인본을 모아 돌린 AI 분석. 멤버 전원이 읽고, 다시 돌리면 새 행이 쌓인다';
comment on column public.ai_analyses.input_version_ids is '입력으로 쓴 승인본 (submission_versions.id). 배열이라 FK 대신 저장할 때 트리거가 확인한다';
comment on column public.ai_analyses.result is '분석 결과. 모양은 lib/schemas/ai-analysis.ts AiAnalysisResult (설계 10장)';
comment on column public.ai_analyses.lead_checked_at is '비어 있으면 화면에 "AI 결과 · 팀장 확인 전" 라벨 (설계 8장 보완 8)';
create index ai_analyses_workspace_idx on public.ai_analyses (workspace_id, created_at desc);
create index ai_analyses_project_idx on public.ai_analyses (project_id);
create index ai_analyses_product_idx on public.ai_analyses (product_id);
create index ai_analyses_created_by_idx on public.ai_analyses (created_by);
create index ai_analyses_lead_checked_by_idx on public.ai_analyses (lead_checked_by);
-- "이 버전이 AI 분석에 쓰였나" 확인용
create index ai_analyses_input_versions_idx on public.ai_analyses using gin (input_version_ids);

-- 4. 트리거 -----------------------------------------------------------------

create trigger tab_submissions_set_updated_at before update on public.tab_submissions
  for each row execute function public.set_updated_at();
create trigger submission_versions_set_updated_at before update on public.submission_versions
  for each row execute function public.set_updated_at();
create trigger ai_analyses_set_updated_at before update on public.ai_analyses
  for each row execute function public.set_updated_at();

-- 새 시안은 임시 상태로 시작하고, 제품은 그 프로젝트의 판매 중 제품이어야 한다 (설계 2장: 개발 중 제품은 시안 대상에서 뺀다)
create function public.guard_new_submission()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  p record;
begin
  new.status := 'draft';
  new.approved_version_id := null;
  new.deleted_at := null;
  if new.product_id is not null then
    select pr.project_id, pr.sale_status into p
    from public.products pr where pr.id = new.product_id and pr.workspace_id = new.workspace_id;
    if not found or p.project_id is distinct from new.project_id then
      raise exception '제품이 이 프로젝트에 속하지 않습니다';
    end if;
    if p.sale_status is distinct from 'on_sale' then
      raise exception '판매 중인 제품만 시안을 만들 수 있습니다';
    end if;
  end if;
  return new;
end;
$$;

create trigger tab_submissions_guard_insert before insert on public.tab_submissions
  for each row execute function public.guard_new_submission();

-- 새 버전은 임시 상태로 시작하고, 번호는 그 시안의 마지막 번호 + 1 (숨긴 버전 번호도 다시 쓰지 않는다)
create function public.guard_new_version()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.status := 'draft';
  new.submitted_at := null;
  new.deleted_at := null;
  new.version_no := coalesce(
    (select max(v.version_no) from public.submission_versions v where v.submission_id = new.submission_id), 0
  ) + 1;
  return new;
end;
$$;

create trigger submission_versions_guard_insert before insert on public.submission_versions
  for each row execute function public.guard_new_version();

-- 제출한 버전은 내용을 고칠 수 없고, 승인본·AI 분석에 쓰인 버전은 숨기지 못한다 (설계 6장, 8장 보완 1)
create function public.guard_version_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.submission_id <> old.submission_id or new.workspace_id <> old.workspace_id
     or new.version_no <> old.version_no or new.author_id is distinct from old.author_id then
    raise exception '버전의 시안 · 번호 · 작성자는 바꿀 수 없습니다';
  end if;
  if old.status <> 'draft' and (
       new.summary is distinct from old.summary or new.body is distinct from old.body
       or new.evidence is distinct from old.evidence or new.data_as_of is distinct from old.data_as_of
       or new.note is distinct from old.note) then
    raise exception '제출한 버전은 고칠 수 없습니다. 이 버전에서 새 버전을 만들어 주세요';
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    if old.status = 'approved' then
      raise exception '승인된 버전은 숨길 수 없습니다';
    end if;
    if exists (select 1 from public.ai_analyses a where old.id = any (a.input_version_ids)) then
      raise exception 'AI 분석에 쓰인 버전은 숨길 수 없습니다';
    end if;
  end if;
  return new;
end;
$$;

create trigger submission_versions_guard_update before update on public.submission_versions
  for each row execute function public.guard_version_update();

-- AI 분석은 같은 팀의 승인된 버전만 입력으로 쓰고, 팀장 확인 전 상태로 저장된다
create function public.guard_new_ai_analysis()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.lead_checked_by := null;
  new.lead_checked_at := null;
  new.deleted_at := null;
  if exists (
    select 1 from unnest(new.input_version_ids) as i (version_id)
    where not exists (
      select 1 from public.submission_versions v
      where v.id = i.version_id and v.workspace_id = new.workspace_id and v.status = 'approved'
    )
  ) then
    raise exception 'AI 분석에는 같은 팀의 승인된 버전만 넣을 수 있습니다';
  end if;
  return new;
end;
$$;

create trigger ai_analyses_guard_insert before insert on public.ai_analyses
  for each row execute function public.guard_new_ai_analysis();

-- 5. 상태 바꾸기 함수 (화면은 이 함수만 부른다) ------------------------------------

-- 버전 상태로 시안 상태를 다시 계산한다 (함수 안에서만 쓴다)
create function public.refresh_submission_status(p_submission_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.tab_submissions s
  set status = case
    when exists (
      select 1 from public.submission_versions v
      where v.submission_id = s.id and v.status = 'submitted' and v.deleted_at is null
    ) then 'in_review'
    when s.approved_version_id is not null then 'approved'
    when exists (
      select 1 from public.submission_versions v
      where v.submission_id = s.id and v.status = 'rejected' and v.deleted_at is null
    ) then 'rejected'
    else 'draft'
  end
  where s.id = p_submission_id;
$$;

-- 제출: 임시 버전을 고정한다. 작성자(그 탭 담당일 때)나 팀장만
create function public.submit_version(p_version_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.submission_versions%rowtype;
  s public.tab_submissions%rowtype;
begin
  select * into v from public.submission_versions where id = p_version_id for update;
  if not found or not public.is_member(v.workspace_id) then
    raise exception '버전을 찾을 수 없습니다';
  end if;
  select * into s from public.tab_submissions where id = v.submission_id;
  if v.deleted_at is not null or s.deleted_at is not null then
    raise exception '숨긴 시안이나 버전은 제출할 수 없습니다';
  end if;
  if v.status <> 'draft' then
    raise exception '임시 버전만 제출할 수 있습니다';
  end if;
  if not (public.is_owner(v.workspace_id)
          or (v.author_id = (select auth.uid()) and public.has_tab(v.workspace_id, s.tab))) then
    raise exception '자기 담당 탭의 자기 버전만 제출할 수 있습니다';
  end if;
  if char_length(btrim(v.summary)) = 0 then
    raise exception '한 줄 결론을 적어 주세요';
  end if;
  update public.submission_versions set status = 'submitted', submitted_at = now() where id = v.id;
  perform public.refresh_submission_status(v.submission_id);
end;
$$;

-- 제출 취소: 결재 전 버전만. 작성자나 팀장만
create function public.withdraw_version(p_version_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.submission_versions%rowtype;
begin
  select * into v from public.submission_versions where id = p_version_id for update;
  if not found or not public.is_member(v.workspace_id) then
    raise exception '버전을 찾을 수 없습니다';
  end if;
  if v.status <> 'submitted' then
    raise exception '결재 대기 중인 버전만 제출을 취소할 수 있습니다';
  end if;
  if not (public.is_owner(v.workspace_id) or v.author_id = (select auth.uid())) then
    raise exception '자기 버전만 제출을 취소할 수 있습니다';
  end if;
  update public.submission_versions set status = 'withdrawn' where id = v.id;
  perform public.refresh_submission_status(v.submission_id);
end;
$$;

-- 결재: 팀장만. 반려는 사유 필수, 자기 버전 결재는 표시한다.
-- 광고 검토 시안이면 근거로 묶인 ad_checks의 상태도 같은 결정으로 맞춘다 (설계 5장). 같은 검토 건이 여러 버전의 근거면 마지막 결재가 남는다
create function public.decide_version(p_version_id uuid, p_decision text, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.submission_versions%rowtype;
  s public.tab_submissions%rowtype;
  uid uuid := (select auth.uid());
begin
  select * into v from public.submission_versions where id = p_version_id for update;
  if not found or not public.is_member(v.workspace_id) then
    raise exception '버전을 찾을 수 없습니다';
  end if;
  if not public.is_owner(v.workspace_id) then
    raise exception '승인 · 반려는 팀장(owner)만 할 수 있습니다';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception '결정은 approved 또는 rejected 입니다';
  end if;
  if v.status <> 'submitted' or v.deleted_at is not null then
    raise exception '결재 대기 중인 버전만 결재할 수 있습니다';
  end if;
  if p_decision = 'rejected' and char_length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception '반려 사유를 적어 주세요';
  end if;
  select * into s from public.tab_submissions where id = v.submission_id;

  insert into public.submission_reviews (workspace_id, version_id, reviewer_id, decision, reason, is_self_review)
  values (v.workspace_id, v.id, uid, p_decision, nullif(btrim(coalesce(p_reason, '')), ''), coalesce(v.author_id = uid, false));

  update public.submission_versions set status = p_decision where id = v.id;
  if p_decision = 'approved' then
    update public.tab_submissions set approved_version_id = v.id where id = s.id;
  end if;

  if s.tab = 'ad' then
    update public.ad_checks a
    set review_status = p_decision, reviewer_id = uid, reviewed_at = now()
    where a.workspace_id = v.workspace_id and a.deleted_at is null
      and a.id in (
        select (e ->> 'id')::uuid from jsonb_array_elements(v.evidence) e
        where e ->> 'kind' = 'ad_check'
          and (e ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      );
  end if;

  perform public.refresh_submission_status(s.id);
end;
$$;

-- 버전 숨김: 작성자(그 탭 담당일 때)나 팀장만. 결재 대기 중이면 제출도 취소된다
create function public.hide_version(p_version_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.submission_versions%rowtype;
  s public.tab_submissions%rowtype;
begin
  select * into v from public.submission_versions where id = p_version_id for update;
  if not found or not public.is_member(v.workspace_id) then
    raise exception '버전을 찾을 수 없습니다';
  end if;
  select * into s from public.tab_submissions where id = v.submission_id;
  if not (public.is_owner(v.workspace_id)
          or (v.author_id = (select auth.uid()) and public.has_tab(v.workspace_id, s.tab))) then
    raise exception '자기 담당 탭의 자기 버전만 숨길 수 있습니다';
  end if;
  -- 승인본 · AI 분석 입력 확인은 guard_version_update 트리거가 한다
  update public.submission_versions
  set deleted_at = now(), status = case when status = 'submitted' then 'withdrawn' else status end
  where id = v.id;
  perform public.refresh_submission_status(v.submission_id);
end;
$$;

-- 시안 숨김: 만든 사람(그 탭 담당일 때)이나 팀장만. 승인본이 있거나 AI 분석에 쓰인 시안은 숨기지 못한다
create function public.hide_submission(p_submission_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  s public.tab_submissions%rowtype;
begin
  select * into s from public.tab_submissions where id = p_submission_id for update;
  if not found or not public.is_member(s.workspace_id) then
    raise exception '시안을 찾을 수 없습니다';
  end if;
  if not (public.is_owner(s.workspace_id)
          or (s.owner_id = (select auth.uid()) and public.has_tab(s.workspace_id, s.tab))) then
    raise exception '자기 담당 탭의 자기 시안만 숨길 수 있습니다';
  end if;
  if s.approved_version_id is not null then
    raise exception '승인본이 있는 시안은 숨길 수 없습니다';
  end if;
  if exists (
    select 1 from public.ai_analyses a
    join public.submission_versions v on v.id = any (a.input_version_ids)
    where v.submission_id = s.id
  ) then
    raise exception 'AI 분석에 쓰인 시안은 숨길 수 없습니다';
  end if;
  update public.tab_submissions set deleted_at = now() where id = s.id;
end;
$$;

-- AI 분석 팀장 확인: owner만. 한 번 확인하면 그대로 둔다
create function public.check_ai_analysis(p_analysis_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a public.ai_analyses%rowtype;
begin
  select * into a from public.ai_analyses where id = p_analysis_id for update;
  if not found or not public.is_member(a.workspace_id) then
    raise exception 'AI 분석을 찾을 수 없습니다';
  end if;
  if not public.is_owner(a.workspace_id) then
    raise exception '팀장 확인은 팀장(owner)만 할 수 있습니다';
  end if;
  if a.lead_checked_at is null then
    update public.ai_analyses set lead_checked_by = (select auth.uid()), lead_checked_at = now() where id = a.id;
  end if;
end;
$$;

-- AI 분석 숨김: 만든 사람이나 팀장만
create function public.hide_ai_analysis(p_analysis_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a public.ai_analyses%rowtype;
begin
  select * into a from public.ai_analyses where id = p_analysis_id for update;
  if not found or not public.is_member(a.workspace_id) then
    raise exception 'AI 분석을 찾을 수 없습니다';
  end if;
  if not (public.is_owner(a.workspace_id) or a.created_by = (select auth.uid())) then
    raise exception '자기 AI 분석만 숨길 수 있습니다';
  end if;
  update public.ai_analyses set deleted_at = now() where id = a.id;
end;
$$;

revoke execute on function public.has_tab(uuid, text), public.submit_version(uuid), public.withdraw_version(uuid),
  public.decide_version(uuid, text, text), public.hide_version(uuid), public.hide_submission(uuid),
  public.check_ai_analysis(uuid), public.hide_ai_analysis(uuid) from public, anon;
grant execute on function public.has_tab(uuid, text), public.submit_version(uuid), public.withdraw_version(uuid),
  public.decide_version(uuid, text, text), public.hide_version(uuid), public.hide_submission(uuid),
  public.check_ai_analysis(uuid), public.hide_ai_analysis(uuid) to authenticated;
revoke execute on function public.refresh_submission_status(uuid), public.guard_new_submission(), public.guard_new_version(),
  public.guard_version_update(), public.guard_new_ai_analysis() from public, anon, authenticated;

-- 6. RLS (설계 4장 권한 표) ---------------------------------------------------

-- member_tabs: 멤버 모두 읽고, 주고 거두는 것은 owner만
alter table public.member_tabs enable row level security;
create policy "members read" on public.member_tabs
  for select to authenticated using (public.is_member(workspace_id));
create policy "owners insert" on public.member_tabs
  for insert to authenticated with check (public.is_owner(workspace_id));
create policy "owners delete" on public.member_tabs
  for delete to authenticated using (public.is_owner(workspace_id));
-- update 정책 없음: 탭을 바꾸려면 지우고 다시 준다

-- tab_submissions: 멤버 모두 읽고, 만들기는 담당 탭에서 본인 이름으로만. 상태·숨김은 함수로만
alter table public.tab_submissions enable row level security;
create policy "members read" on public.tab_submissions
  for select to authenticated using (public.is_member(workspace_id));
create policy "tab owners insert" on public.tab_submissions
  for insert to authenticated with check (
    public.is_member(workspace_id) and public.has_tab(workspace_id, tab) and owner_id = (select auth.uid())
  );
-- update · delete 정책 없음

-- submission_versions: 멤버 모두 읽고, 담당 탭의 숨기지 않은 시안에 본인 이름으로 버전을 만든다.
-- 임시 버전은 작성자(그 탭 담당일 때)나 팀장이 고친다. 상태 바꾸기는 함수로만 (with check가 draft를 벗어나지 못하게 막는다)
alter table public.submission_versions enable row level security;
create policy "members read" on public.submission_versions
  for select to authenticated using (public.is_member(workspace_id));
create policy "tab owners insert" on public.submission_versions
  for insert to authenticated with check (
    public.is_member(workspace_id) and author_id = (select auth.uid())
    and exists (
      select 1 from public.tab_submissions s
      where s.id = submission_id and s.workspace_id = submission_versions.workspace_id
        and s.deleted_at is null and public.has_tab(s.workspace_id, s.tab)
    )
  );
create policy "drafts update by author or owner" on public.submission_versions
  for update to authenticated
  using (
    status = 'draft' and deleted_at is null
    and (public.is_owner(workspace_id) or (author_id = (select auth.uid()) and exists (
      select 1 from public.tab_submissions s where s.id = submission_id and public.has_tab(s.workspace_id, s.tab))))
  )
  with check (
    status = 'draft'
    and (public.is_owner(workspace_id) or (author_id = (select auth.uid()) and exists (
      select 1 from public.tab_submissions s where s.id = submission_id and public.has_tab(s.workspace_id, s.tab))))
  );
-- delete 정책 없음: 화면의 삭제는 숨김(hide_version)

-- submission_reviews: 멤버 모두 읽기만. 쓰기는 decide_version()으로만, 지우지 않는다
alter table public.submission_reviews enable row level security;
create policy "members read" on public.submission_reviews
  for select to authenticated using (public.is_member(workspace_id));

-- ai_analyses: 멤버 모두 읽고, 실행한 사람 이름으로 저장한다. 팀장 확인 · 숨김은 함수로만
alter table public.ai_analyses enable row level security;
create policy "members read" on public.ai_analyses
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.ai_analyses
  for insert to authenticated with check (public.is_member(workspace_id) and created_by = (select auth.uid()));
-- update · delete 정책 없음
