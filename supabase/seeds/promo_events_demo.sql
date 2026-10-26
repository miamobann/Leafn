-- 홈·/calendar 프로모션 캘린더 시연용 더미 일정 넣기. 마이그레이션이 아니다 (자동 실행되지 않음)
--
-- 내용: apps/web/lib/mock/promo-events.ts의 행사 6건과 준비 마감을 그대로 옮긴다 (2026-10-26 총괄 결정: 캘린더는 더미로 시연)
--   Qoo10 메가와리 2건은 과거 패턴으로 넣은 예상 일정이라 is_confirmed = false, 제목에 "(예상)"을 남긴다
--   자사 캠페인 4건은 platform_id 없이 확정(is_confirmed = true)
--   시연 뒤에는 화면(/calendar)에서 고치거나 지우면 된다
--
-- 실행 방법 (DB 관리자)
--   1. 아래 PUT_INVITE_CODE_HERE를 워크스페이스의 참여 코드로 바꾼다 (설정 화면 또는 workspaces.invite_code)
--   2. Supabase SQL Editor(또는 psql)에서 파일 전체를 실행한다
--
-- 다시 실행해도 된다: 같은 제목·시작일의 행사가 이미 있으면 그 행사와 준비 마감은 건드리지 않는다

begin;

create temp table _seed on commit drop as
select w.id as workspace_id
from public.workspaces w
where w.invite_code = upper(btrim('PUT_INVITE_CODE_HERE'));

do $$
begin
  if (select count(*) from _seed) <> 1 then
    raise exception '참여 코드에 맞는 워크스페이스가 없습니다. PUT_INVITE_CODE_HERE를 바꿨는지 확인하세요';
  end if;
end;
$$;

create temp table _events on commit drop as
select * from (
  values
    ('pe-1', 'qoo10', 'platform_event', 'メガ割 (예상)', date '2026-11-20', date '2026-12-02', false),
    ('pe-2', null, 'own_campaign', 'Qoo10 숍 오픈 · Deep Skin 출시', date '2027-01-15', date '2027-01-31', true),
    ('pe-3', null, 'own_campaign', 'SNS 출시 예고 · Instagram', date '2027-01-05', date '2027-01-20', true),
    ('pe-4', null, 'own_campaign', '상세페이지 피부타입 설문 공개', date '2027-01-15', date '2027-02-13', true),
    ('pe-5', 'qoo10', 'platform_event', 'メガ割 (예상) · Core Essence 출시', date '2027-03-01', date '2027-03-12', false),
    ('pe-6', null, 'own_campaign', '메가와리 예고 · X', date '2027-02-20', date '2027-03-01', true)
) as v(key, platform_id, kind, title, start_date, end_date, is_confirmed);

create temp table _milestones on commit drop as
select * from (
  values
    ('pe-1', '경쟁 화장수·에센스 메가와리 할인가 기록', date '2026-11-21', null::timestamptz),
    ('pe-1', '메가와리 전후 랭킹 변화 정리', date '2026-12-03', null),
    ('pe-2', 'Qoo10 입점 심사 서류 제출', date '2026-10-24', timestamptz '2026-10-24 16:10:00+09'),
    ('pe-2', '일본어 전성분 표기 확정', date '2026-10-30', null),
    ('pe-2', '상세페이지 문구 만들기', date '2026-11-06', null),
    ('pe-2', '상세페이지 문구 약기법 검토 · 팀장 승인', date '2026-11-13', null),
    ('pe-2', '상세페이지에 넣을 국내 후기 번역 · 검토', date '2026-11-20', null),
    ('pe-2', 'Qoo10 상품 등록', date '2026-12-11', null),
    ('pe-2', '첫 입고', date '2027-01-06', null),
    ('pe-2', '오픈 쿠폰 문구 검토', date '2027-01-10', null),
    ('pe-3', '출시 예고 게시물 가이드 만들기', date '2026-12-12', null),
    ('pe-3', '게시 문구 · 해시태그 약기법 검토', date '2026-12-18', null),
    ('pe-3', '게시 크리에이터 섭외 확정', date '2026-12-26', null),
    ('pe-4', '설문 결과 페이지의 제품 추천 문구 약기법 검토', date '2026-12-04', null),
    ('pe-4', '상품 등록 때 상세페이지에 설문 링크 넣기', date '2026-12-11', null),
    ('pe-4', '설문 공개 · 응답 들어오는지 확인', date '2027-01-15', null),
    ('pe-5', '경쟁 에센스 2종 리뷰 수집 요청', date '2026-10-23', null),
    ('pe-5', 'Core Essence 소구점 확정', date '2026-11-27', null),
    ('pe-5', '메가와리 상세페이지 가이드 만들기 (게시물 종류: 메가와리)', date '2027-02-05', null),
    ('pe-5', '메가와리 참가 신청', date '2027-02-12', null),
    ('pe-5', '할인가 · 쿠폰 확정', date '2027-02-16', null),
    ('pe-5', '행사 문구 약기법 검토 · 팀장 승인', date '2027-02-19', null),
    ('pe-5', '물류 입고', date '2027-02-22', null),
    ('pe-6', '예고 게시물 가이드 만들기', date '2027-02-10', null),
    ('pe-6', '게시 문구 약기법 검토', date '2027-02-14', null)
) as v(event_key, label, due_date, done_at);

-- 이번 실행에서 새로 넣은 행사만 남긴다. 이미 있던 행사의 준비 마감은 다시 넣지 않는다
create temp table _inserted (key text, id uuid) on commit drop;

with new_events as (
  select s.workspace_id, e.*
  from _events e
  cross join _seed s
  where not exists (
    select 1 from public.promo_events p
    where p.workspace_id = s.workspace_id and p.title = e.title and p.start_date = e.start_date
  )
),
ins as (
  insert into public.promo_events (workspace_id, platform_id, kind, title, start_date, end_date, is_confirmed, memo)
  select workspace_id, platform_id, kind, title, start_date, end_date, is_confirmed, '시연용 더미 일정 (seeds/promo_events_demo.sql)'
  from new_events
  returning id, title, start_date
)
insert into _inserted (key, id)
select e.key, ins.id
from ins
join _events e on e.title = ins.title and e.start_date = ins.start_date;

insert into public.promo_milestones (workspace_id, promo_event_id, label, due_date, done_at)
select s.workspace_id, i.id, m.label, m.due_date, m.done_at
from _milestones m
join _inserted i on i.key = m.event_key
cross join _seed s;

commit;
