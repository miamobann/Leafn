-- 통합 AI 분석 결과는 인증된 Server Action만 service role로 저장한다.
-- 브라우저의 로그인 세션으로는 결과 행을 직접 만들 수 없다.
-- 선행: 20261025115007_team_approval.sql

drop policy "members insert" on public.ai_analyses;

create or replace function public.guard_new_ai_analysis()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.lead_checked_by := null;
  new.lead_checked_at := null;
  new.deleted_at := null;

  if not exists (
    select 1 from public.products p
    where p.id = new.product_id and p.workspace_id = new.workspace_id
      and p.project_id = new.project_id and p.kind = 'own' and p.sale_status = 'on_sale'
  ) then
    raise exception 'AI 분석의 제품과 프로젝트가 일치하지 않습니다';
  end if;

  if exists (
    select 1 from unnest(new.input_version_ids) as i (version_id)
    where not exists (
      select 1 from public.submission_versions v
      join public.tab_submissions s on s.id = v.submission_id
      where v.id = i.version_id and v.workspace_id = new.workspace_id
        and v.status = 'approved' and v.deleted_at is null
        and s.workspace_id = new.workspace_id and s.project_id = new.project_id
        and s.deleted_at is null
        and (s.product_id = new.product_id or (s.tab = 'market' and s.product_id is null))
    )
  ) then
    raise exception 'AI 분석에는 이 제품과 프로젝트의 승인된 버전만 넣을 수 있습니다';
  end if;

  if (
    select count(distinct s.tab)
    from unnest(new.input_version_ids) as i (version_id)
    join public.submission_versions v on v.id = i.version_id
    join public.tab_submissions s on s.id = v.submission_id
  ) <> cardinality(new.input_version_ids) then
    raise exception 'AI 분석에는 탭마다 승인본 하나만 넣을 수 있습니다';
  end if;
  return new;
end;
$$;

comment on table public.ai_analyses is '서버가 검증된 승인본으로 실행한 AI 분석. 멤버 전원이 읽고, 쓰기는 서버의 service role만 한다';
