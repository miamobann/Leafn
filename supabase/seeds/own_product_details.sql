-- 자사 제품 4종의 기본 정보(가격·용량·전성분) 채우기. 마이그레이션이 아니다 (자동 실행되지 않음)
--
-- 왜: 광고 검토(새 검토·콘텐츠 제작)는 전성분이 있는 자사 제품만 고를 수 있다 (lib/data/ad-products.ts).
--     projects_leaf_dew.sql은 가격·용량·성분을 비워 두어서, 지금은 고를 제품이 없다
-- 값: apps/web/app/(internal)/(dashboard)/ad-check/_lib/products.ts (팀 테스트 데이터 leaf_and_japan_marketing_test_data.csv, 가상 값)
--     전성분은 일본어 표시명(가칭). Mild Emulsion · Tea-Pure Calming Ampoule은 자료가 없어 넣지 않는다
--     Tea-Pure Skin · Mild Skin은 주요 성분 3개만 있다 (개발 중 제품)
--
-- 실행 방법 (DB 관리자)
--   1. projects_leaf_dew.sql이 먼저 실행돼 있어야 한다 (제품 행이 있어야 채울 수 있다)
--   2. 아래 PUT_INVITE_CODE_HERE를 워크스페이스의 참여 코드로 바꾼다
--   3. Supabase SQL Editor에서 파일 전체를 실행한다
--
-- 다시 실행해도 된다: 이미 값이 있는 칸은 덮어쓰지 않고 빈 칸만 채운다

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
end $$;

update public.products p
set
  price_jpy = coalesce(p.price_jpy, v.price_jpy),
  volume_ml = coalesce(p.volume_ml, v.volume_ml),
  ingredients = case when cardinality(p.ingredients) = 0 then v.ingredients else p.ingredients end
from _seed s, (
  values
    ('Leaf& Dew Deep Skin', 2480, 200, array['ヒアルロン酸Na', 'グリセリン', 'パンテノール', '水', 'BG', 'プロパンジオール', 'ベタイン', 'アラントイン', 'ヒドロキシエチルセルロース', 'EDTA-2Na', 'フェノキシエタノール', 'エチルヘキシルグリセリン', 'クエン酸', 'クエン酸Na']::text[]),
    ('Leaf& Dew Core Essence', 2980, 50, array['ヒアルロン酸Na', 'セラミドNP', 'コレステロール', 'ステアリン酸', 'グリセリン', '水', 'BG', 'プロパンジオール', 'スクワラン', 'トリ（カプリル酸／カプリン酸）グリセリル', '水添レシチン', 'カルボマー', 'アルギニン', 'EDTA-2Na', 'フェノキシエタノール', 'エチルヘキシルグリセリン']::text[]),
    ('Leaf& Dew Tea-Pure Skin', 2480, 150, array['ヒアルロン酸Na', 'パンテノール', 'チャ葉エキス']::text[]),
    ('Leaf& Dew Mild Skin', 2480, 150, array['ヒアルロン酸Na', 'グリセリン', 'ベタイン']::text[])
) as v(name, price_jpy, volume_ml, ingredients)
where p.workspace_id = s.workspace_id
  and p.kind = 'own'
  and p.name = v.name;

commit;

-- 확인: 4행에 가격·용량·성분 수가 보이면 된다
-- select name, price_jpy, volume_ml, cardinality(ingredients) from public.products where kind = 'own' order by name;
