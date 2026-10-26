-- 광고 검토(TAB 3): 새 검토가 어느 만든 가이드에서 왔는지
-- 근거: docs/tab3-db-plan.md 1장 (2026-10-26 TAB 3 결정: 팀원이 한 검토를 팀장도 검토 상세에서 「이 가이드에 반영」) · docs/DB_RULES.md 2장 (열 추가, ad_checks 칸은 TAB 3 담당)
-- 선행: 20261024130000_create_ad_checks.sql (ad_checks · content_guides)
-- 열 추가만 한다. 기존 행은 null 이라 안전하다

alter table public.ad_checks
  add column content_guide_id uuid,
  -- 가이드를 지워도 검토 기록은 남는다 (그 칸만 비운다)
  add constraint ad_checks_content_guide_fk
    foreign key (content_guide_id, workspace_id) references public.content_guides (id, workspace_id) on delete set null (content_guide_id);

comment on column public.ad_checks.content_guide_id is '만든 가이드의 「이 문구로 새 검토」에서 온 검토면 그 가이드. 검토 상세에서 누구나 「이 가이드에 반영」으로 수정본을 만든다';

create index ad_checks_content_guide_idx on public.ad_checks (content_guide_id);

-- RLS: 기존 정책 그대로 (멤버 insert, owner update). 이 칸은 저장할 때 한 번 채우고 바꾸지 않는다
