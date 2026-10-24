-- 프로젝트 "Leaf& Dew"와 자사 제품 6종 넣기. 마이그레이션이 아니다 (자동 실행되지 않음)
--
-- 내용: 헤더의 프로젝트 메뉴와 프로젝트·제품 관리 화면이 처음부터 Leaf& Dew 6종을 보여 주도록 넣는 시작 데이터
--   제품명·피부 라인·판매 상태는 apps/web/lib/own-products.ts (docs/Product.md 기준), 카테고리는 apps/web/lib/mock/products.ts와 같다
--   가격·용량·성분은 넣지 않는다 (샘플 값을 실제 DB에 넣지 않기 위해). 필요하면 화면이나 추출 기능으로 채운다
--
-- 실행 방법 (DB 관리자)
--   1. 20261024104911_projects_products.sql 마이그레이션이 적용된 뒤에 실행한다
--   2. 아래 PUT_INVITE_CODE_HERE를 워크스페이스의 참여 코드로 바꾼다 (설정 화면 또는 workspaces.invite_code)
--   3. Supabase SQL Editor(또는 psql)에서 파일 전체를 실행한다
--
-- 다시 실행해도 된다: 이미 있는 프로젝트·제품(같은 이름)은 건드리지 않고 없는 것만 넣는다

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

insert into public.projects (workspace_id, name, platform_id, description)
select workspace_id, 'Leaf& Dew', 'qoo10', '건성·지성·복합성 3라인 6종의 Qoo10 진출'
from _seed
on conflict (workspace_id, name) do nothing;

insert into public.products (workspace_id, project_id, kind, brand, name, platform_id, sale_status, skin_line, category)
select p.workspace_id, p.id, 'own', 'Leaf&', v.name, p.platform_id, v.sale_status, v.skin_line, v.category
from public.projects p
join _seed s on s.workspace_id = p.workspace_id
cross join (
  values
    ('Leaf& Dew Deep Skin', 'on_sale', 'dry', '化粧水'),
    ('Leaf& Dew Core Essence', 'on_sale', 'dry', '美容液'),
    ('Leaf& Dew Mild Skin', 'in_development', 'combo', '化粧水'),
    ('Leaf& Dew Mild Emulsion', 'in_development', 'combo', '乳液'),
    ('Leaf& Dew Tea-Pure Skin', 'in_development', 'oily', '化粧水'),
    ('Leaf& Dew Tea-Pure Calming Ampoule', 'in_development', 'oily', '美容液')
) as v(name, sale_status, skin_line, category)
where p.name = 'Leaf& Dew'
on conflict (project_id, name) where project_id is not null do nothing;

commit;
