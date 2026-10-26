-- 결재함은 팀장(owner)만 본다 (2026-10-26 총괄 결정). 팀원은 자기가 만든 버전과 승인본(AI 분석 근거)만 읽는다.
-- 시안 칸(tab_submissions)의 상태와 AI 분석은 그대로 멤버 모두 읽는다 (진행 표 · AI 분석 탭).
-- 선행: 20261025115007_team_approval.sql

-- 1. 버전 번호는 그 시안의 모든 버전을 보고 매겨야 한다.
--    팀원이 남의 버전을 못 보게 되므로 번호를 매기는 트리거 함수만 RLS를 건너뛰게(security definer) 바꾼다. 내용은 그대로다
create or replace function public.guard_new_version()
returns trigger
language plpgsql security definer set search_path = ''
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

revoke execute on function public.guard_new_version() from public, anon, authenticated;

-- 2. submission_versions: 팀장은 전부, 팀원은 자기 버전과 승인본만
drop policy "members read" on public.submission_versions;
create policy "owner, author or approved read" on public.submission_versions
  for select to authenticated using (
    public.is_member(workspace_id)
    and (public.is_owner(workspace_id) or author_id = (select auth.uid()) or status = 'approved')
  );

-- 3. submission_reviews(결재 기록): 팀장은 전부, 팀원은 읽을 수 있는 버전(자기 버전 · 승인본)의 기록만
drop policy "members read" on public.submission_reviews;
create policy "owner or readable version read" on public.submission_reviews
  for select to authenticated using (
    public.is_member(workspace_id)
    and (
      public.is_owner(workspace_id)
      or exists (
        select 1 from public.submission_versions v
        where v.id = version_id and (v.author_id = (select auth.uid()) or v.status = 'approved')
      )
    )
  );
