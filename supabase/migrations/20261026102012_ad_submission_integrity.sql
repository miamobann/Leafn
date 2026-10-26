-- 광고 시안의 근거는 같은 팀·같은 제품의 검토 건으로 제한한다.
-- 시안 결재와 원본 약기법 검토의 상태는 독립적으로 유지한다.
-- 선행: 20261025115007_team_approval.sql

create function public.guard_ad_submission_evidence()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  s public.tab_submissions%rowtype;
begin
  select * into s from public.tab_submissions where id = new.submission_id;
  if not found or s.workspace_id <> new.workspace_id then
    raise exception '시안과 버전의 팀이 다릅니다';
  end if;
  if s.tab <> 'ad' then
    return new;
  end if;
  if s.product_id is null or jsonb_array_length(new.evidence) = 0 then
    raise exception '광고 시안에는 제품과 광고 검토 근거가 필요합니다';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.evidence) e
    where e ->> 'kind' is distinct from 'ad_check'
       or not exists (
         select 1 from public.ad_checks a
         where a.id::text = e ->> 'id'
           and a.workspace_id = new.workspace_id
           and a.product_id = s.product_id
           and a.deleted_at is null
       )
  ) then
    raise exception '이 제품에 속한 광고 검토 건만 시안에 담을 수 있습니다';
  end if;
  return new;
end;
$$;

create trigger submission_versions_ad_evidence_guard
  before insert or update of evidence, submission_id on public.submission_versions
  for each row execute function public.guard_ad_submission_evidence();

-- 이미 시안의 근거로 쓰인 검토 건을 다른 제품으로 옮기지 못하게 한다.
create function public.guard_linked_ad_check_product()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.product_id is distinct from old.product_id and exists (
    select 1 from public.submission_versions v
    where v.workspace_id = old.workspace_id
      and v.evidence @> jsonb_build_array(jsonb_build_object('kind', 'ad_check', 'id', old.id::text))
  ) then
    raise exception '시안의 근거로 쓰인 광고 검토 건은 제품을 바꿀 수 없습니다';
  end if;
  return new;
end;
$$;

create trigger ad_checks_linked_product_guard
  before update of product_id on public.ad_checks
  for each row execute function public.guard_linked_ad_check_product();

-- 팀장 결재는 시안 버전과 결재 기록만 바꾼다. 원본 광고 검토의 review_status는
-- 광고 검토 화면에서 별도로 결정하며, 다른 시안 버전의 결재가 이를 덮어쓰지 않는다.
create or replace function public.decide_version(p_version_id uuid, p_decision text, p_reason text default null)
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
  perform public.refresh_submission_status(s.id);
end;
$$;

revoke execute on function public.guard_ad_submission_evidence(), public.guard_linked_ad_check_product()
  from public, anon, authenticated;
