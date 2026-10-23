-- 소비자 설문(G): 설문지, 응답, 18세 미만 참여 수, 추천 노출 · 클릭 기록
-- 근거: docs/db-frame.md "소비자 설문" · docs/DB_RULES.md 3장
-- 결정(2026-10-23, 팀): 표 2개(surveys + survey_responses) 채택, 새 값은 칸으로, 18세 미만은 날짜별 참여 수만,
--   추천 노출 · 클릭 기록 표 추가, 응답 보관 3년. 출시 알림 신청 표는 이번에 만들지 않는다

-- 1. 설문지 -------------------------------------------------------------

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  public_slug text not null unique check (public_slug ~ '^[a-z0-9-]{2,40}$'),
  title_ja text not null,
  questions jsonb not null default '[]'::jsonb,
  is_open boolean not null default true
);
comment on column public.surveys.public_slug is '공개 링크 /survey/<slug>로 어느 팀 설문인지 찾는다';
create index surveys_workspace_id_idx on public.surveys (workspace_id);

-- 2. 응답 (18세 이상 · 동의한 응답만. 이름 · 연락처 칸은 두지 않는다) ---------------

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  survey_id uuid not null references public.surveys (id) on delete cascade,
  answers jsonb not null,
  age_group text not null check (age_group in ('18-19', '20s', '30s', '40s', '50plus')),
  skin_type text not null check (skin_type in ('dry', 'oily', 'combo', 'inner_dry', 'normal')),
  is_sensitive boolean not null,
  score_t_zone_oil smallint not null check (score_t_zone_oil >= 0),
  score_cheek_oil smallint not null check (score_cheek_oil >= 0),
  score_dryness smallint not null check (score_dryness >= 0),
  score_sensitivity smallint not null check (score_sensitivity >= 0),
  concerns text[] not null default '{}',
  concern_other text check (char_length(concern_other) <= 50),
  source text check (source in ('instagram', 'x', 'line', 'rakuten', 'qoo10', 'friend', 'search', 'other')),
  source_other text check (char_length(source_other) <= 50),
  consent_at timestamptz not null,
  consent_version text not null,
  locale text not null default 'ja'
);
comment on table public.survey_responses is '응답 보관 3년 (개인정보 안내 v0.1). 기한이 지난 행 삭제는 관리자가 한다';
create index survey_responses_workspace_id_idx on public.survey_responses (workspace_id);
create index survey_responses_survey_id_idx on public.survey_responses (survey_id);

-- 3. 18세 미만 참여 수 (나이 · 답 없이 날짜별 숫자만) ------------------------

create table public.survey_minor_counts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  survey_id uuid not null references public.surveys (id) on delete cascade,
  count_date date not null,
  count integer not null default 0 check (count >= 0),
  unique (survey_id, count_date)
);
create index survey_minor_counts_workspace_id_idx on public.survey_minor_counts (workspace_id);

-- 4. 추천 노출 · 클릭 기록 (18세 이상만 기록. 연락처는 두지 않는다) ------------------

create table public.survey_reco_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  survey_id uuid not null references public.surveys (id) on delete cascade,
  product_line text not null,
  event text not null check (event in ('shown', 'buy_click', 'notify_open')),
  skin_type text not null check (skin_type in ('dry', 'oily', 'combo', 'inner_dry', 'normal'))
);
create index survey_reco_events_workspace_id_idx on public.survey_reco_events (workspace_id);
create index survey_reco_events_survey_id_idx on public.survey_reco_events (survey_id);

-- 5. 18세 미만 참여 +1 (익명 사용자는 이 함수로만 숫자를 올린다. 표에 직접 쓰지 못한다) ----

create function public.record_survey_minor(p_slug text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  s_id uuid;
  ws_id uuid;
begin
  select id, workspace_id into s_id, ws_id from public.surveys where public_slug = p_slug and is_open;
  if s_id is null then
    return;
  end if;
  insert into public.survey_minor_counts (workspace_id, survey_id, count_date, count)
  values (ws_id, s_id, (now() at time zone 'Asia/Tokyo')::date, 1)
  on conflict (survey_id, count_date)
  do update set count = public.survey_minor_counts.count + 1, updated_at = now();
end;
$$;

revoke execute on function public.record_survey_minor(text) from public;
grant execute on function public.record_survey_minor(text) to anon, authenticated;

-- 6. RLS ----------------------------------------------------------------

alter table public.surveys enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_minor_counts enable row level security;
alter table public.survey_reco_events enable row level security;

-- surveys: 열린 설문은 누구나 읽는다 (공개 페이지가 slug로 찾음). 관리는 멤버
create policy "surveys read open" on public.surveys
  for select to anon, authenticated using (is_open);
create policy "members read" on public.surveys
  for select to authenticated using (public.is_member(workspace_id));
create policy "members insert" on public.surveys
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "members update" on public.surveys
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.surveys
  for delete to authenticated using (public.is_member(workspace_id));

-- survey_responses: 익명은 열린 설문에 입력만 (workspace_id가 설문의 것과 같아야 한다). 읽기 · 수정 · 삭제는 멤버
create policy "public insert to open survey" on public.survey_responses
  for insert to anon, authenticated with check (
    exists (
      select 1 from public.surveys s
      where s.id = survey_id and s.is_open and s.workspace_id = survey_responses.workspace_id
    )
  );
create policy "members read" on public.survey_responses
  for select to authenticated using (public.is_member(workspace_id));
create policy "members update" on public.survey_responses
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "members delete" on public.survey_responses
  for delete to authenticated using (public.is_member(workspace_id));

-- survey_minor_counts: 쓰기는 record_survey_minor()로만. 읽기 · 삭제는 멤버
create policy "members read" on public.survey_minor_counts
  for select to authenticated using (public.is_member(workspace_id));
create policy "members delete" on public.survey_minor_counts
  for delete to authenticated using (public.is_member(workspace_id));

-- survey_reco_events: 익명은 열린 설문에 입력만. 읽기 · 삭제는 멤버 (기록이라 수정 정책은 두지 않는다)
create policy "public insert to open survey" on public.survey_reco_events
  for insert to anon, authenticated with check (
    exists (
      select 1 from public.surveys s
      where s.id = survey_id and s.is_open and s.workspace_id = survey_reco_events.workspace_id
    )
  );
create policy "members read" on public.survey_reco_events
  for select to authenticated using (public.is_member(workspace_id));
create policy "members delete" on public.survey_reco_events
  for delete to authenticated using (public.is_member(workspace_id));
