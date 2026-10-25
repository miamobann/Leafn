-- TAB 3 광고 검토 권한 강화 (20261024130000_create_ad_checks.sql 후속)
-- 근거: docs/tab3-db-plan.md 1장 ("승인 권한: 필요해지면 owner로 좁힌다") · PM 결정(2026-10-24)
-- 선행: 20261024130000_create_ad_checks.sql (ad_checks · ad_check_lines · content_guides)

-- 1. 작성자 기본값 설정 (서버가 created_by를 생략해도 현재 로그인 사용자로 기록) ----

alter table public.ad_checks
  alter column created_by set default auth.uid();

alter table public.content_guides
  alter column created_by set default auth.uid();

-- 2. 승인·수정·삭제 권한을 워크스페이스 owner로 제한 ------------------------------

drop policy if exists "members update" on public.ad_checks;
create policy "owners update" on public.ad_checks
  for update to authenticated using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));

drop policy if exists "members update" on public.ad_check_lines;
create policy "owners update" on public.ad_check_lines
  for update to authenticated using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));

drop policy if exists "members update" on public.content_guides;
create policy "owners update" on public.content_guides
  for update to authenticated using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));

drop policy if exists "members delete" on public.content_guides;
create policy "owners delete" on public.content_guides
  for delete to authenticated using (public.is_owner(workspace_id));

-- 3. 첫 저장 시 미검토 상태 및 작성자 본인 일치 강제 ------------------------------

create policy "new checks start pending" on public.ad_checks as restrictive
  for insert to authenticated with check (
    review_status = 'pending' and reviewer_id is null and reviewed_at is null
    and reviewer_note is null and not is_expert_review_requested
    and deleted_at is null
    and created_by = (select auth.uid())
  );

create policy "guide author matches session" on public.content_guides as restrictive
  for insert to authenticated with check (created_by = (select auth.uid()));
