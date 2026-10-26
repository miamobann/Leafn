-- 광고 검토(TAB 3): 만든 가이드의 수정본 · 블록별 메모
-- 근거: docs/tab3-db-plan.md 1장 (2026-10-26 TAB 3 결정) · docs/DB_RULES.md 2장 (열 추가)
-- 선행: 20261024130000_create_ad_checks.sql (content_guides)
-- 열 추가만 한다. 기존 행은 둘 다 null 이라 안전하다

-- 1. 수정본: 새 검토에서 대체 표현으로 고친 문구를 「가이드에 반영」하면 원본을 덮어쓰지 않고 새 행으로 남긴다.
--    원본(약기법에 걸린 문구 + 그 검사 기록)이 증거로 남는다. 원본을 지우면 이 칸만 비운다
alter table public.content_guides
  add column parent_id uuid,
  add column memos jsonb,
  add constraint content_guides_parent_fk
    foreign key (parent_id, workspace_id) references public.content_guides (id, workspace_id) on delete set null (parent_id);

comment on column public.content_guides.parent_id is '수정본이면 원본 가이드. 수정본의 ad_check_id 는 고친 문구를 판정한 새 검토(ad_checks.source = manual)';
comment on column public.content_guides.memos is '블록별 검토 메모 { "<blocks[].key>": "메모" }. PDF에 함께 적힌다';

create index content_guides_parent_idx on public.content_guides (parent_id);

-- 2. 메모 저장: content_guides 수정(update)은 owner만이라 (20261024172221_harden_ad_review_writes.sql),
--    팀원도 메모만 고칠 수 있게 memos 칸 하나만 바꾸는 함수를 둔다. 본문·제목은 이 함수로 바꿀 수 없다
create function public.set_content_guide_memos(p_guide_id uuid, p_memos jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_memos is null or jsonb_typeof(p_memos) <> 'object' then
    raise exception '메모 모양이 올바르지 않습니다';
  end if;
  if octet_length(p_memos::text) > 20000 then
    raise exception '메모가 너무 깁니다';
  end if;
  update public.content_guides set memos = p_memos
  where id = p_guide_id and public.is_member(workspace_id);
  if not found then
    raise exception '가이드를 찾을 수 없습니다';
  end if;
end;
$$;

revoke execute on function public.set_content_guide_memos(uuid, jsonb) from public, anon;
grant execute on function public.set_content_guide_memos(uuid, jsonb) to authenticated;

-- RLS: 정책은 그대로 쓴다. 수정본 저장은 insert(멤버 누구나, created_by = 본인), 메모는 위 함수
