-- 자사 제품 · 가상 국내 리뷰 220건 넣기: 테스트 워크스페이스 전용. 마이그레이션이 아니다 (자동 실행되지 않음)
--
-- 내용: 우리 제품 2개(Leaf& Dew Deep Skin · Core Essence) + 자사 샘플 리뷰 220건 (Deep Skin 120건 · Core Essence 100건)
--   실제 리뷰가 아니라 가상 문장이다. 원본은 apps/web/lib/mock/own-review-seeds.ts (samples/reviews-ko-skin.csv · reviews-ko-essence.csv와 같은 내용)
--   리뷰는 source = 'oliveyoung', lang = 'ko'이고 external_id가 'sample-r-ko-…'로 시작한다. raw에 {"sample": true, "tags": "+texture -scent"}를 둔다.
--   AI 분석(review_analyses)은 넣지 않는다 (리포트의 감성 · 키워드 칸은 AI 분석을 연결한 뒤에 채워진다).
--
-- 실행 방법 (DB 관리자)
--   1. PR 1의 마이그레이션(products · reviews 등)이 적용된 뒤에 실행한다
--   2. 아래 PUT_INVITE_CODE_HERE를 테스트 워크스페이스의 참여 코드로 바꾼다 (설정 화면 또는 workspaces.invite_code)
--   3. Supabase SQL Editor(또는 psql)에서 파일 전체를 실행한다
--   여러 번 실행해도 안전하다: 같은 이름의 우리 제품이 있으면 새로 만들지 않고, 같은 리뷰(workspace_id · source · external_id)는 건너뛴다.
--
-- 지우기 (리뷰만, 우리 제품은 남긴다. PUT_INVITE_CODE_HERE는 위와 같은 참여 코드)
--   delete from public.reviews
--   where source = 'oliveyoung' and external_id like 'sample-r-ko-%'
--     and workspace_id = (select id from public.workspaces where invite_code = upper(btrim('PUT_INVITE_CODE_HERE')));

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

-- 1. 우리 제품 2개 (같은 이름의 우리 제품이 이미 있으면 건너뜀)
insert into public.products (workspace_id, kind, brand, name, category, platform_id, price_jpy, volume_ml, ingredients, features, image_path)
select s.workspace_id, 'own', v.brand, v.name, v.category, 'qoo10', v.price, v.volume, v.ingredients, v.features, v.image
from _seed s, (values
  ('Leaf&', 'Leaf& Dew Deep Skin', '化粧水', 2480, 200::numeric, array['水', 'グリセリン', 'ヒアルロン酸Na', '加水分解ヒアルロン酸', 'パンテノール']::text[], array['히알루론산', '산뜻한 보습']::text[], '/products/leaf-dew-dry-set.webp'),
  ('Leaf&', 'Leaf& Dew Core Essence', '美容液', 2980, 50::numeric, array['水', 'BG', 'ヒアルロン酸Na', 'アセチルヒアルロン酸Na', 'グリセリン']::text[], array['히알루론산', '가벼운 제형']::text[], '/products/leaf-dew-dry-set.webp')
) as v(brand, name, category, price, volume, ingredients, features, image)
where not exists (
  select 1 from public.products p
  where p.workspace_id = s.workspace_id and p.kind = 'own' and p.name = v.name
);

-- 2. 자사 샘플 리뷰 220건 (이미 있는 리뷰는 건너뜀)
insert into public.reviews (workspace_id, product_id, source, external_id, lang, rating, rating_scale, body, reviewer_attrs, posted_at, raw)
select s.workspace_id, p.id, 'oliveyoung', 'sample-' || v.ext, 'ko', v.rating, 5, v.body,
  jsonb_build_object('age_group', v.age, 'skin_type', v.skin),
  (v.posted::date)::timestamp at time zone 'Asia/Seoul',
  jsonb_build_object('sample', true, 'tags', v.tags)
from _seed s
join (values
  ('r-ko-1', 'Leaf& Dew Deep Skin', 5, '순하고 촉촉해서 재구매했어요.', '지성', '20대', '2026-10-01', '+irritation +lasting_moisture'),
  ('r-ko-2', 'Leaf& Dew Deep Skin', 4, '흡수가 빠른데 향이 조금 아쉬워요.', '복합성', '30대', '2026-10-02', '+texture -scent'),
  ('r-ko-3', 'Leaf& Dew Deep Skin', 2, '제 피부엔 조금 따가웠어요.', '민감성', '20대', '2026-10-03', '-irritation'),
  ('r-ko-4', 'Leaf& Dew Deep Skin', 5, '가격 대비 용량이 넉넉해요.', '건성', '30대', '2026-10-04', '+value'),
  ('r-ko-5', 'Leaf& Dew Deep Skin', 4, '트러블 진정에 도움이 됐어요.', '지성', '10대', '2026-10-05', '+irritation'),
  ('r-ko-6', 'Leaf& Dew Deep Skin', 5, '평범한 중성 피부예요. 저녁에 바르면 다음 날 아침까지 당기지 않아요. 붉은기가 올라온 날에도 진정되는 느낌이에요.', '중성', '20대', '2026-06-11', '+lasting_moisture +irritation'),
  ('r-ko-7', 'Leaf& Dew Deep Skin', 2, '트러블이 올라와서 사용을 멈췄어요. 다른 제품을 찾아볼까 해요.', '민감성', '20대', '2026-06-13', '-irritation'),
  ('r-ko-8', 'Leaf& Dew Deep Skin', 5, '따가움 없이 순하게 발려요.', '복합성', '20대', '2026-06-18', '+irritation'),
  ('r-ko-9', 'Leaf& Dew Deep Skin', 5, '중성 피부예요. 민감한 눈가 주변에도 따갑지 않았어요. 발림성이 좋아서 화장솜에 적셔 쓰기 편해요. 앞으로도 계속 쓸 것 같아요.', '중성', '30대', '2026-06-19', '+irritation +texture'),
  ('r-ko-10', 'Leaf& Dew Deep Skin', 3, '지성이라 끈적임에 예민한 편이에요. 속건조가 눈에 띄게 줄었어요. 다만 할인하지 않으면 선뜻 사기엔 부담돼요. 한 통은 써 보려고요.', '지성', '40대', '2026-06-22', '+lasting_moisture -value'),
  ('r-ko-11', 'Leaf& Dew Deep Skin', 4, '2주째 쓰고 있어요. 바르고 나서 한참 지나도 촉촉함이 남아 있어요.', '중성', '40대', '2026-06-24', '+lasting_moisture'),
  ('r-ko-12', 'Leaf& Dew Deep Skin', 4, '여러 번 레이어링해도 밀리지 않아요. 피부 진정에 도움 되는 느낌이라 계속 쓰고 있어요. 다만 보습이 오래 가지 않아서 자주 덧발라요. 전반적으로 만족하며 쓰고 있어요.', '복합성', '20대', '2026-06-26', '+texture +irritation -lasting_moisture'),
  ('r-ko-13', 'Leaf& Dew Deep Skin', 5, '묽은데 겉돌지 않고 피부에 쏙 들어가요. 재구매 의사 100%예요.', '민감성', '20대', '2026-06-27', '+texture'),
  ('r-ko-14', 'Leaf& Dew Deep Skin', 5, '두 통째 쓰는 중이에요. 한 통으로 오래 써서 가성비가 좋아요. 재구매 의사 100%예요.', '지성', '40대', '2026-06-29', '+value'),
  ('r-ko-15', 'Leaf& Dew Deep Skin', 4, '2주째 쓰고 있어요. 세안 후 바로 바르면 하루 종일 땅김이 덜해요.', '건성', '20대', '2026-07-03', '+lasting_moisture'),
  ('r-ko-16', 'Leaf& Dew Deep Skin', 5, '한 달째 쓰는 중이에요. 발림성이 좋아서 화장솜에 적셔 쓰기 편해요. 세안 후 바로 바르면 하루 종일 땅김이 덜해요.', '지성', '40대', '2026-07-06', '+texture +lasting_moisture'),
  ('r-ko-17', 'Leaf& Dew Deep Skin', 5, '두 통째 쓰는 중이에요. 속건조가 눈에 띄게 줄었어요. 주변에도 추천했어요.', '건성', '30대', '2026-07-10', '+lasting_moisture'),
  ('r-ko-18', 'Leaf& Dew Deep Skin', 4, 'T존은 번들거리고 볼은 건조한 복합성이에요. 산뜻한데 피부 겉이 마르는 느낌은 없어요. 오후에도 얼굴이 푸석하지 않고 촉촉해요. 한 가지 아쉬운 건 냄새가 신경 쓰여서 손이 잘 안 가요.', '복합성', '20대', '2026-07-11', '+texture +lasting_moisture -scent'),
  ('r-ko-19', 'Leaf& Dew Deep Skin', 5, '2주째 쓰고 있어요. 바르고 나서 한참 지나도 촉촉함이 남아 있어요. 메이크업 전에 바르면 베이스가 잘 먹어요. 앞으로도 계속 쓸 것 같아요.', '민감성', '20대', '2026-07-13', '+lasting_moisture +texture'),
  ('r-ko-20', 'Leaf& Dew Deep Skin', 5, '복합성 피부예요. 건조한 날에도 한 번만 발라도 충분히 촉촉해요.', '복합성', '40대', '2026-07-15', '+lasting_moisture'),
  ('r-ko-21', 'Leaf& Dew Deep Skin', 4, '두 통째 쓰는 중이에요. 수분감이 차곡차곡 쌓이는 느낌이라 꾸준히 쓰게 돼요. 전반적으로 만족하며 쓰고 있어요.', '중성', '40대', '2026-07-15', '+lasting_moisture'),
  ('r-ko-22', 'Leaf& Dew Deep Skin', 4, '세안 후 바로 바르면 하루 종일 땅김이 덜해요. 민감한 눈가 주변에도 따갑지 않았어요. 전반적으로 만족하며 쓰고 있어요.', '복합성', '40대', '2026-07-15', '+lasting_moisture +irritation'),
  ('r-ko-23', 'Leaf& Dew Deep Skin', 1, '냄새가 신경 쓰여서 손이 잘 안 가요. 트러블이 올라와서 사용을 멈췄어요.', '민감성', '40대', '2026-07-16', '-scent -irritation'),
  ('r-ko-24', 'Leaf& Dew Deep Skin', 5, '한 통 다 쓰고 남기는 후기예요. 따가움 없이 순하게 발려요. 앞으로도 계속 쓸 것 같아요.', '민감성', '20대', '2026-07-19', '+irritation'),
  ('r-ko-25', 'Leaf& Dew Deep Skin', 5, '속건조가 눈에 띄게 줄었어요. 앞으로도 계속 쓸 것 같아요.', '건성', '20대', '2026-07-20', '+lasting_moisture'),
  ('r-ko-26', 'Leaf& Dew Deep Skin', 5, '흡수가 빨라서 바쁜 아침에도 부담이 없어요. 만족스러워요.', '민감성', '20대', '2026-07-21', '+texture'),
  ('r-ko-27', 'Leaf& Dew Deep Skin', 3, '한 통 다 쓰고 남기는 후기예요. 번들거리는 지성 피부예요. 붉은기가 올라온 날에도 진정되는 느낌이에요. 한 가지 아쉬운 건 냄새가 신경 쓰여서 손이 잘 안 가요.', '지성', '30대', '2026-07-22', '+irritation -scent'),
  ('r-ko-28', 'Leaf& Dew Deep Skin', 5, '지성이라 끈적임에 예민한 편이에요. 세일 때 쟁여 두는 제품이에요. 재구매 의사 100%예요.', '지성', '20대', '2026-07-22', '+value'),
  ('r-ko-29', 'Leaf& Dew Deep Skin', 4, '중성 피부예요. 수분감이 차곡차곡 쌓이는 느낌이라 꾸준히 쓰게 돼요. 그런데 펌프형이 아니라서 쓸 때 낭비돼요. 재구매 의사 있어요.', '중성', '20대', '2026-07-22', '+lasting_moisture -container'),
  ('r-ko-30', 'Leaf& Dew Deep Skin', 5, '수분감이 차곡차곡 쌓이는 느낌이라 꾸준히 쓰게 돼요. 만족스러워요.', '민감성', '20대', '2026-07-27', '+lasting_moisture'),
  ('r-ko-31', 'Leaf& Dew Deep Skin', 4, '한 달째 쓰는 중이에요. 피부가 뒤집어졌을 때도 부담 없이 쓸 수 있었어요. 그런데 바른 뒤 살짝 끈적임이 남아요.', '지성', '40대', '2026-07-29', '+irritation -texture'),
  ('r-ko-32', 'Leaf& Dew Deep Skin', 5, '한 달째 쓰는 중이에요. 오후에도 얼굴이 푸석하지 않고 촉촉해요. 끈적임 없이 산뜻하게 마무리돼요. 주변에도 추천했어요.', '건성', '20대', '2026-07-31', '+lasting_moisture +texture'),
  ('r-ko-33', 'Leaf& Dew Deep Skin', 3, '한 통 다 쓰고 남기는 후기예요. 중성 피부예요. 다만 촉촉함이 한두 시간밖에 안 가요. 한 통은 써 보려고요.', '중성', '30대', '2026-07-31', '-lasting_moisture'),
  ('r-ko-34', 'Leaf& Dew Deep Skin', 5, '복합성 피부예요. 흡수가 빨라서 바쁜 아침에도 부담이 없어요. 쟁여 두고 쓰고 싶어요.', '복합성', '30대', '2026-08-03', '+texture'),
  ('r-ko-35', 'Leaf& Dew Deep Skin', 5, '번들거리는 지성 피부예요. 발림성이 좋아서 화장솜에 적셔 쓰기 편해요. 만족스러워요.', '지성', '20대', '2026-08-04', '+texture'),
  ('r-ko-36', 'Leaf& Dew Deep Skin', 3, '복합성 피부예요. 다만 뚜껑을 열면 양이 한 번에 많이 나와서 조절이 어려워요. 한 통은 써 보려고요.', '복합성', '40대', '2026-08-05', '-container'),
  ('r-ko-37', 'Leaf& Dew Deep Skin', 5, '지성이라 끈적임에 예민한 편이에요. 마스크를 오래 써도 건조함이 덜 올라와요. 바르고 나면 피부결이 매끈하게 정돈되는 느낌이에요. 강력 추천해요!', '지성', '30대', '2026-08-06', '+lasting_moisture +texture'),
  ('r-ko-38', 'Leaf& Dew Deep Skin', 4, '건성이라 늘 속당김이 고민이었어요. 순해서 가족이 같이 써도 문제없어요. 전반적으로 만족하며 쓰고 있어요.', '건성', '30대', '2026-08-10', '+irritation'),
  ('r-ko-39', 'Leaf& Dew Deep Skin', 4, '민감성이라 새 제품은 늘 조심스러워요. 붉은기가 올라온 날에도 진정되는 느낌이에요. 한 가지 아쉬운 건 뚜껑을 열면 양이 한 번에 많이 나와서 조절이 어려워요.', '민감성', '20대', '2026-08-12', '+irritation -container'),
  ('r-ko-40', 'Leaf& Dew Deep Skin', 3, '한 달째 쓰는 중이에요. 세일 때 쟁여 두는 제품이에요. 다만 민감한 날에는 바르면 살짝 따끔거려요. 재구매는 고민해 볼래요.', '민감성', '20대', '2026-08-14', '+value -irritation'),
  ('r-ko-41', 'Leaf& Dew Deep Skin', 5, '화장솜에 듬뿍 적셔 써도 걱정이 없어요. 인공적인 향이 없어서 좋아요. 만족스러워요.', '복합성', '30대', '2026-08-16', '+value +scent'),
  ('r-ko-42', 'Leaf& Dew Deep Skin', 5, '바르고 나면 피부결이 매끈하게 정돈되는 느낌이에요. 주변에도 추천했어요.', '지성', '20대', '2026-08-17', '+texture'),
  ('r-ko-43', 'Leaf& Dew Deep Skin', 5, '복합성 피부예요. 오후에도 얼굴이 푸석하지 않고 촉촉해요. 흡수가 빨라서 바쁜 아침에도 부담이 없어요.', '복합성', '20대', '2026-08-17', '+lasting_moisture +texture'),
  ('r-ko-44', 'Leaf& Dew Deep Skin', 4, 'T존은 번들거리고 볼은 건조한 복합성이에요. 세안 후 바로 바르면 하루 종일 땅김이 덜해요. 은은하게 깨끗한 냄새라 거부감이 없어요. 대체로 만족해요.', '복합성', '30대', '2026-08-17', '+lasting_moisture +scent'),
  ('r-ko-45', 'Leaf& Dew Deep Skin', 5, '두 통째 쓰는 중이에요. 메이크업 전에 바르면 베이스가 잘 먹어요. 앞으로도 계속 쓸 것 같아요.', '건성', '30대', '2026-08-18', '+texture'),
  ('r-ko-46', 'Leaf& Dew Deep Skin', 4, '자극이 없어서 예민한 날에도 편하게 써요. 대체로 만족해요.', '복합성', '30대', '2026-08-18', '+irritation'),
  ('r-ko-47', 'Leaf& Dew Deep Skin', 5, '손바닥에 덜어 두드려 바르면 금방 흡수돼요.', '지성', '20대', '2026-08-19', '+texture'),
  ('r-ko-48', 'Leaf& Dew Deep Skin', 3, '번들거리는 지성 피부예요. 피부 진정에 도움 되는 느낌이라 계속 쓰고 있어요. 한 가지 아쉬운 건 흡수는 빠른데 마무리가 조금 미끌거려요. 재구매는 고민해 볼래요.', '지성', '30대', '2026-08-20', '+irritation -texture'),
  ('r-ko-49', 'Leaf& Dew Deep Skin', 5, '복합성 피부예요. 순하다는 후기를 보고 샀는데 정말 순해요. 200ml라 양이 넉넉해서 아낌없이 써요. 재구매 의사 100%예요.', '복합성', '40대', '2026-08-21', '+irritation +value'),
  ('r-ko-50', 'Leaf& Dew Deep Skin', 2, '평범한 중성 피부예요. 한 통으로 오래 써서 가성비가 좋아요. 그런데 냄새가 신경 쓰여서 손이 잘 안 가요.', '중성', '30대', '2026-08-21', '+value -scent'),
  ('r-ko-51', 'Leaf& Dew Deep Skin', 1, '속건조가 심한 날에는 효과를 크게 못 느꼈어요.', '건성', '30대', '2026-08-22', '-lasting_moisture'),
  ('r-ko-52', 'Leaf& Dew Deep Skin', 5, '두 통째 쓰는 중이에요. 향이 거의 없어서 향에 예민한 저도 편해요. 여러 번 레이어링해도 밀리지 않아요.', '민감성', '20대', '2026-08-23', '+scent +texture'),
  ('r-ko-53', 'Leaf& Dew Deep Skin', 5, '한 통 다 쓰고 남기는 후기예요. 속건조가 눈에 띄게 줄었어요. 만족스러워요.', '민감성', '20대', '2026-08-24', '+lasting_moisture'),
  ('r-ko-54', 'Leaf& Dew Deep Skin', 4, '한 달째 쓰는 중이에요. 손바닥에 덜어 두드려 바르면 금방 흡수돼요. 용량 대비 가격이 착해서 가성비가 좋아요. 그런데 수분감은 있는데 지속력이 아쉬워요. 전반적으로 만족하며 쓰고 있어요.', '지성', '20대', '2026-08-24', '+texture +value -lasting_moisture'),
  ('r-ko-55', 'Leaf& Dew Deep Skin', 5, '속건조가 눈에 띄게 줄었어요. 끈적임 없이 산뜻하게 마무리돼요. 만족스러워요.', '지성', '20대', '2026-08-25', '+lasting_moisture +texture'),
  ('r-ko-56', 'Leaf& Dew Deep Skin', 3, '두 통째 쓰는 중이에요. 그런데 민감한 날에는 바르면 살짝 따끔거려요.', '중성', '20대', '2026-08-25', '-irritation'),
  ('r-ko-57', 'Leaf& Dew Deep Skin', 5, '두 통째 쓰는 중이에요. 마스크를 오래 써도 건조함이 덜 올라와요. 가격이 부담스럽지 않아서 바로 재구매했어요. 주변에도 추천했어요.', '건성', '30대', '2026-08-26', '+lasting_moisture +value'),
  ('r-ko-58', 'Leaf& Dew Deep Skin', 5, '한 달째 쓰는 중이에요. 오후에도 얼굴이 푸석하지 않고 촉촉해요.', '건성', '20대', '2026-08-26', '+lasting_moisture'),
  ('r-ko-59', 'Leaf& Dew Deep Skin', 5, '한 달째 쓰는 중이에요. 자기 전에 듬뿍 바르고 자면 아침 피부가 편안해요. 쟁여 두고 쓰고 싶어요.', '복합성', '20대', '2026-08-27', '+lasting_moisture'),
  ('r-ko-60', 'Leaf& Dew Deep Skin', 4, '2주째 쓰고 있어요. 새 제품은 늘 겁나는데 이건 한 번도 따갑지 않았어요. 다만 겨울에는 이것만으로 보습이 모자라서 크림을 꼭 덧발라야 해요. 전반적으로 만족하며 쓰고 있어요.', '민감성', '20대', '2026-08-28', '+irritation -lasting_moisture'),
  ('r-ko-61', 'Leaf& Dew Deep Skin', 4, '순하다는 후기를 보고 샀는데 정말 순해요. 한 가지 아쉬운 건 겨울에는 이것만으로 보습이 모자라서 크림을 꼭 덧발라야 해요. 대체로 만족해요.', '건성', '20대', '2026-08-28', '+irritation -lasting_moisture'),
  ('r-ko-62', 'Leaf& Dew Deep Skin', 5, '흡수가 빨라서 바쁜 아침에도 부담이 없어요. 용기가 깔끔하고 디자인이 예뻐요.', '중성', '40대', '2026-08-29', '+texture +container'),
  ('r-ko-63', 'Leaf& Dew Deep Skin', 3, '묽은데 겉돌지 않고 피부에 쏙 들어가요. 그런데 볼 쪽이 붉어지고 따가웠어요. 특별히 나쁘진 않아요.', '지성', '30대', '2026-08-29', '+texture -irritation'),
  ('r-ko-64', 'Leaf& Dew Deep Skin', 1, '건조한 날에는 보습이 금방 날아가요. 주변에도 추천하기 어려울 것 같아요.', '복합성', '30대', '2026-08-31', '-lasting_moisture'),
  ('r-ko-65', 'Leaf& Dew Deep Skin', 5, '한 통 다 쓰고 남기는 후기예요. 마스크를 오래 써도 건조함이 덜 올라와요. 순하다는 후기를 보고 샀는데 정말 순해요.', '건성', '40대', '2026-09-01', '+lasting_moisture +irritation'),
  ('r-ko-66', 'Leaf& Dew Deep Skin', 2, '피부가 예민한 편이에요. 향이 조금 더 은은했으면 좋겠어요. 재구매는 고민돼요.', '민감성', '20대', '2026-09-03', '-scent'),
  ('r-ko-67', 'Leaf& Dew Deep Skin', 5, '한 달째 쓰는 중이에요. 평범한 중성 피부예요. 묽은데 겉돌지 않고 피부에 쏙 들어가요.', '중성', '20대', '2026-09-03', '+texture'),
  ('r-ko-68', 'Leaf& Dew Deep Skin', 4, '지성이라 끈적임에 예민한 편이에요. 산뜻한데 피부 겉이 마르는 느낌은 없어요.', '지성', '30대', '2026-09-04', '+texture'),
  ('r-ko-69', 'Leaf& Dew Deep Skin', 1, '처음 며칠은 얼굴이 간지러웠어요.', '복합성', '20대', '2026-09-05', '-irritation'),
  ('r-ko-70', 'Leaf& Dew Deep Skin', 5, 'T존은 번들거리고 볼은 건조한 복합성이에요. 에어컨 바람 아래에서도 피부가 덜 건조해요.', '복합성', '20대', '2026-09-06', '+lasting_moisture'),
  ('r-ko-71', 'Leaf& Dew Deep Skin', 4, '두 통째 쓰는 중이에요. 번들거리는 지성 피부예요. 끈적임 없이 산뜻하게 마무리돼요. 그런데 약간 화학적인 냄새가 나요. 대체로 만족해요.', '지성', '20대', '2026-09-07', '+texture -scent'),
  ('r-ko-72', 'Leaf& Dew Deep Skin', 2, '지성이라 끈적임에 예민한 편이에요. 가성비는 비슷한 제품들 중에서 평범해요. 재구매는 고민돼요.', '지성', '20대', '2026-09-08', '-value'),
  ('r-ko-73', 'Leaf& Dew Deep Skin', 5, 'T존은 번들거리고 볼은 건조한 복합성이에요. 세안 후 바로 바르면 하루 종일 땅김이 덜해요. 끈적임 없이 산뜻하게 마무리돼요. 강력 추천해요!', '복합성', '40대', '2026-09-08', '+lasting_moisture +texture'),
  ('r-ko-74', 'Leaf& Dew Deep Skin', 5, '2주째 쓰고 있어요. 건조한 날에도 한 번만 발라도 충분히 촉촉해요. 순하다는 후기를 보고 샀는데 정말 순해요. 주변에도 추천했어요.', '건성', '20대', '2026-09-08', '+lasting_moisture +irritation'),
  ('r-ko-75', 'Leaf& Dew Deep Skin', 4, '2주째 쓰고 있어요. 자기 전에 듬뿍 바르고 자면 아침 피부가 편안해요.', '지성', '30대', '2026-09-11', '+lasting_moisture'),
  ('r-ko-76', 'Leaf& Dew Deep Skin', 5, '두 통째 쓰는 중이에요. 바르고 나서 한참 지나도 촉촉함이 남아 있어요. 끈적임 없이 산뜻하게 마무리돼요. 만족스러워요.', '복합성', '20대', '2026-09-12', '+lasting_moisture +texture'),
  ('r-ko-77', 'Leaf& Dew Deep Skin', 5, '한 달째 쓰는 중이에요. 붉은기가 올라온 날에도 진정되는 느낌이에요.', '중성', '40대', '2026-09-12', '+irritation'),
  ('r-ko-78', 'Leaf& Dew Deep Skin', 5, '2주째 쓰고 있어요. T존은 번들거리고 볼은 건조한 복합성이에요. 에어컨 바람 아래에서도 피부가 덜 건조해요. 묽은데 겉돌지 않고 피부에 쏙 들어가요.', '복합성', '20대', '2026-09-12', '+lasting_moisture +texture'),
  ('r-ko-79', 'Leaf& Dew Deep Skin', 5, '200ml라 양이 넉넉해서 아낌없이 써요.', '중성', '30대', '2026-09-13', '+value'),
  ('r-ko-80', 'Leaf& Dew Deep Skin', 5, '건조한 날에도 한 번만 발라도 충분히 촉촉해요.', '건성', '20대', '2026-09-13', '+lasting_moisture'),
  ('r-ko-81', 'Leaf& Dew Deep Skin', 4, '한 통 다 쓰고 남기는 후기예요. 지성이라 끈적임에 예민한 편이에요. 수분감이 차곡차곡 쌓이는 느낌이라 꾸준히 쓰게 돼요. 묽은데 겉돌지 않고 피부에 쏙 들어가요. 무난하게 좋아요.', '지성', '30대', '2026-09-14', '+lasting_moisture +texture'),
  ('r-ko-82', 'Leaf& Dew Deep Skin', 3, '마스크를 오래 써도 건조함이 덜 올라와요. 그런데 처음 열었을 때 올라오는 향이 별로예요.', '복합성', '30대', '2026-09-15', '+lasting_moisture -scent'),
  ('r-ko-83', 'Leaf& Dew Deep Skin', 5, '두 통째 쓰는 중이에요. 한 통으로 오래 써서 가성비가 좋아요. 강력 추천해요!', '복합성', '30대', '2026-09-15', '+value'),
  ('r-ko-84', 'Leaf& Dew Deep Skin', 4, '보습이 은근하게 오래가서 만족해요. 한 가지 아쉬운 건 무향이라고 했는데 은근히 향이 나요. 대체로 만족해요.', '건성', '30대', '2026-09-17', '+lasting_moisture -scent'),
  ('r-ko-85', 'Leaf& Dew Deep Skin', 5, '한 달째 쓰는 중이에요. 흡수가 빨라서 바쁜 아침에도 부담이 없어요. 저녁에 바르면 다음 날 아침까지 당기지 않아요.', '건성', '30대', '2026-09-18', '+texture +lasting_moisture'),
  ('r-ko-86', 'Leaf& Dew Deep Skin', 5, '대용량이라 목이나 팔에 발라도 금방 줄지 않아요. 세안 후 바로 바르면 하루 종일 땅김이 덜해요. 만족스러워요.', '건성', '30대', '2026-09-18', '+value +lasting_moisture'),
  ('r-ko-87', 'Leaf& Dew Deep Skin', 5, '건조함에 예민한 건성 피부예요. 피부 진정에 도움 되는 느낌이라 계속 쓰고 있어요. 히알루론산이라 그런지 수분이 오래 가는 느낌이에요.', '건성', '30대', '2026-09-19', '+irritation +lasting_moisture'),
  ('r-ko-88', 'Leaf& Dew Deep Skin', 5, '한 달째 쓰는 중이에요. 보습이 은근하게 오래가서 만족해요.', '건성', '30대', '2026-09-20', '+lasting_moisture'),
  ('r-ko-89', 'Leaf& Dew Deep Skin', 5, '건조함에 예민한 건성 피부예요. 새 제품은 늘 겁나는데 이건 한 번도 따갑지 않았어요. 히알루론산이라 그런지 수분이 오래 가는 느낌이에요.', '건성', '20대', '2026-09-21', '+irritation +lasting_moisture'),
  ('r-ko-90', 'Leaf& Dew Deep Skin', 5, '두 통째 쓰는 중이에요. 흡수가 빨라서 바쁜 아침에도 부담이 없어요. 바르고 나서 한참 지나도 촉촉함이 남아 있어요.', '복합성', '20대', '2026-09-22', '+texture +lasting_moisture'),
  ('r-ko-91', 'Leaf& Dew Deep Skin', 5, '한 달째 쓰는 중이에요. 메이크업 전에 바르면 베이스가 잘 먹어요. 트러블이 올라온 시기에도 자극 없이 지나갔어요.', '지성', '10대', '2026-09-22', '+texture +irritation'),
  ('r-ko-92', 'Leaf& Dew Deep Skin', 4, '순하다는 후기를 보고 샀는데 정말 순해요. 저녁에 바르면 다음 날 아침까지 당기지 않아요. 대체로 만족해요.', '지성', '20대', '2026-09-22', '+irritation +lasting_moisture'),
  ('r-ko-93', 'Leaf& Dew Deep Skin', 5, '수분감이 차곡차곡 쌓이는 느낌이라 꾸준히 쓰게 돼요. 재구매 의사 100%예요.', '건성', '30대', '2026-09-23', '+lasting_moisture'),
  ('r-ko-94', 'Leaf& Dew Deep Skin', 3, '한 통 다 쓰고 남기는 후기예요. 메이크업 전에 바르면 베이스가 잘 먹어요. 한 가지 아쉬운 건 수분감은 있는데 지속력이 아쉬워요. 그냥 무난해요.', '중성', '30대', '2026-09-24', '+texture -lasting_moisture'),
  ('r-ko-95', 'Leaf& Dew Deep Skin', 5, '두 통째 쓰는 중이에요. 순하다는 후기를 보고 샀는데 정말 순해요. 묽은데 겉돌지 않고 피부에 쏙 들어가요.', '민감성', '10대', '2026-09-24', '+irritation +texture'),
  ('r-ko-96', 'Leaf& Dew Deep Skin', 5, '건조함에 예민한 건성 피부예요. 보습이 은근하게 오래가서 만족해요. 강력 추천해요!', '건성', '20대', '2026-09-24', '+lasting_moisture'),
  ('r-ko-97', 'Leaf& Dew Deep Skin', 4, '복합성 피부예요. 인공적인 향이 없어서 좋아요.', '복합성', '30대', '2026-09-25', '+scent'),
  ('r-ko-98', 'Leaf& Dew Deep Skin', 5, '한 통 다 쓰고 남기는 후기예요. 토너패드로 만들어 쓰기 좋은 묽기예요.', '복합성', '20대', '2026-09-30', '+texture'),
  ('r-ko-99', 'Leaf& Dew Deep Skin', 5, '민감한 눈가 주변에도 따갑지 않았어요. 만족스러워요.', '민감성', '20대', '2026-09-30', '+irritation'),
  ('r-ko-100', 'Leaf& Dew Deep Skin', 2, '복합성 피부예요. 냄새가 신경 쓰여서 손이 잘 안 가요. 다른 제품을 찾아볼까 해요.', '복합성', '30대', '2026-10-01', '-scent'),
  ('r-ko-101', 'Leaf& Dew Deep Skin', 4, '2주째 쓰고 있어요. 오후에도 얼굴이 푸석하지 않고 촉촉해요. 세일 때 쟁여 두는 제품이에요.', '건성', '20대', '2026-10-01', '+lasting_moisture +value'),
  ('r-ko-102', 'Leaf& Dew Deep Skin', 3, '한 통 다 쓰고 남기는 후기예요. 손바닥에 덜어 두드려 바르면 금방 흡수돼요. 그런데 할인하지 않으면 선뜻 사기엔 부담돼요. 한 통은 써 보려고요.', '민감성', '40대', '2026-10-02', '+texture -value'),
  ('r-ko-103', 'Leaf& Dew Deep Skin', 4, '손바닥에 덜어 두드려 바르면 금방 흡수돼요. 그런데 용량에 비해 가격이 조금 있는 편이에요.', '지성', '20대', '2026-10-03', '+texture -value'),
  ('r-ko-104', 'Leaf& Dew Deep Skin', 5, '복합성 피부예요. 저녁에 바르면 다음 날 아침까지 당기지 않아요.', '복합성', '20대', '2026-10-04', '+lasting_moisture'),
  ('r-ko-105', 'Leaf& Dew Deep Skin', 5, '끈적임 없이 산뜻하게 마무리돼요. 쟁여 두고 쓰고 싶어요.', '건성', '20대', '2026-10-04', '+texture'),
  ('r-ko-106', 'Leaf& Dew Deep Skin', 5, '한 달째 쓰는 중이에요. 건성이라 늘 속당김이 고민이었어요. 바르고 나면 피부결이 매끈하게 정돈되는 느낌이에요. 자기 전에 듬뿍 바르고 자면 아침 피부가 편안해요. 강력 추천해요!', '건성', '40대', '2026-10-05', '+texture +lasting_moisture'),
  ('r-ko-107', 'Leaf& Dew Deep Skin', 5, '2주째 쓰고 있어요. 자극이 없어서 예민한 날에도 편하게 써요. 주변에도 추천했어요.', '건성', '40대', '2026-10-05', '+irritation'),
  ('r-ko-108', 'Leaf& Dew Deep Skin', 4, '복합성 피부예요. 수분감이 차곡차곡 쌓이는 느낌이라 꾸준히 쓰게 돼요.', '복합성', '40대', '2026-10-06', '+lasting_moisture'),
  ('r-ko-109', 'Leaf& Dew Deep Skin', 5, '자극이 없어서 예민한 날에도 편하게 써요. 물처럼 가벼워서 바르자마자 스며들어요. 만족스러워요.', '지성', '20대', '2026-10-07', '+irritation +texture'),
  ('r-ko-110', 'Leaf& Dew Deep Skin', 3, '한 달째 쓰는 중이에요. 건성이라 늘 속당김이 고민이었어요. 산뜻한데 피부 겉이 마르는 느낌은 없어요. 다만 약간 화학적인 냄새가 나요.', '건성', '30대', '2026-10-07', '+texture -scent'),
  ('r-ko-111', 'Leaf& Dew Deep Skin', 4, '건성이라 늘 속당김이 고민이었어요. 히알루론산이라 그런지 수분이 오래 가는 느낌이에요. 무난하게 좋아요.', '건성', '30대', '2026-10-09', '+lasting_moisture'),
  ('r-ko-112', 'Leaf& Dew Deep Skin', 5, '피부가 뒤집어졌을 때도 부담 없이 쓸 수 있었어요. 텁텁함 없이 가벼워서 여름에도 쓸 만해요. 만족스러워요.', '지성', '40대', '2026-10-10', '+irritation +texture'),
  ('r-ko-113', 'Leaf& Dew Deep Skin', 4, '자기 전에 듬뿍 바르고 자면 아침 피부가 편안해요. 다만 눈가 쪽에서 따가움이 느껴졌어요.', '건성', '40대', '2026-10-11', '+lasting_moisture -irritation'),
  ('r-ko-114', 'Leaf& Dew Deep Skin', 5, '피부가 예민한 편이에요. 따가움 없이 순하게 발려요.', '민감성', '30대', '2026-10-12', '+irritation'),
  ('r-ko-115', 'Leaf& Dew Deep Skin', 1, '수분감은 있는데 지속력이 아쉬워요. 주변에도 추천하기 어려울 것 같아요.', '복합성', '40대', '2026-10-13', '-lasting_moisture'),
  ('r-ko-116', 'Leaf& Dew Deep Skin', 5, '두 통째 쓰는 중이에요. 순하다는 후기를 보고 샀는데 정말 순해요. 속건조가 눈에 띄게 줄었어요. 주변에도 추천했어요.', '중성', '30대', '2026-10-13', '+irritation +lasting_moisture'),
  ('r-ko-117', 'Leaf& Dew Deep Skin', 4, '한 통 다 쓰고 남기는 후기예요. 평범한 중성 피부예요. 메이크업 전에 바르면 베이스가 잘 먹어요.', '중성', '30대', '2026-10-14', '+texture'),
  ('r-ko-118', 'Leaf& Dew Deep Skin', 2, '중성 피부예요. 피부가 뒤집어졌을 때도 부담 없이 쓸 수 있었어요. 그런데 겨울에는 너무 산뜻해서 겉도는 느낌이에요. 냄새가 신경 쓰여서 손이 잘 안 가요. 재구매는 고민돼요.', '중성', '30대', '2026-10-15', '+irritation -texture -scent'),
  ('r-ko-119', 'Leaf& Dew Deep Skin', 5, '복합성 피부예요. 트러블이 올라온 시기에도 자극 없이 지나갔어요. 쟁여 두고 쓰고 싶어요.', '복합성', '20대', '2026-10-16', '+irritation'),
  ('r-ko-120', 'Leaf& Dew Deep Skin', 5, '두 통째 쓰는 중이에요. T존은 번들거리고 볼은 건조한 복합성이에요. 바르고 나면 피부결이 매끈하게 정돈되는 느낌이에요.', '복합성', '30대', '2026-10-16', '+texture'),
  ('r-ko-121', 'Leaf& Dew Core Essence', 4, '2주째 쓰고 있어요. 레이어링해도 무겁지 않아서 크림 전에 바르기 좋아요. 무난하게 좋아요.', '지성', '40대', '2026-07-23', '+texture'),
  ('r-ko-122', 'Leaf& Dew Core Essence', 4, '스킨이랑 세트로 쓰고 있어요. 아침에 일어났을 때 피부결이 매끈해요. 재구매 의사 있어요.', '복합성', '30대', '2026-07-25', '+lasting_moisture'),
  ('r-ko-123', 'Leaf& Dew Core Essence', 5, '지성이라 끈적임에 예민한 편이에요. 에센스인데 무겁지 않고 가볍게 스며들어요. 건조한 계절에도 얼굴이 당기지 않아요. 만족스러워요.', '지성', '20대', '2026-07-26', '+texture +lasting_moisture'),
  ('r-ko-124', 'Leaf& Dew Core Essence', 5, '중성 피부예요. 한 병으로 두 달 넘게 쓰고 있어요. 건조한 계절에도 얼굴이 당기지 않아요.', '중성', '30대', '2026-07-27', '+value +lasting_moisture'),
  ('r-ko-125', 'Leaf& Dew Core Essence', 4, 'T존은 번들거리고 볼은 건조한 복합성이에요. 에센스인데 무겁지 않고 가볍게 스며들어요.', '복합성', '20대', '2026-07-27', '+texture'),
  ('r-ko-126', 'Leaf& Dew Core Essence', 5, '중성 피부예요. 아침에 일어났을 때 피부결이 매끈해요. 주변에도 추천했어요.', '중성', '30대', '2026-07-31', '+lasting_moisture'),
  ('r-ko-127', 'Leaf& Dew Core Essence', 5, '피부가 예민한 편이에요. 속까지 촉촉함이 오래가는 느낌이에요.', '민감성', '30대', '2026-07-31', '+lasting_moisture'),
  ('r-ko-128', 'Leaf& Dew Core Essence', 5, '평범한 중성 피부예요. 펌프로 한 번 덜어 두드려 바르면 금방 흡수돼요. 스킨이랑 같이 쓰면 저녁까지 속건조가 덜해요.', '중성', '30대', '2026-07-31', '+texture +lasting_moisture'),
  ('r-ko-129', 'Leaf& Dew Core Essence', 5, '한 달 정도 써 봤어요. 예민한 날에도 안심하고 쓸 수 있어요. 강력 추천해요!', '민감성', '20대', '2026-08-03', '+irritation'),
  ('r-ko-130', 'Leaf& Dew Core Essence', 5, '평범한 중성 피부예요. 에센스인데 무겁지 않고 가볍게 스며들어요.', '중성', '20대', '2026-08-03', '+texture'),
  ('r-ko-131', 'Leaf& Dew Core Essence', 4, '한 달 정도 써 봤어요. 중성 피부예요. 에센스 치고 합리적인 가격이에요.', '중성', '40대', '2026-08-03', '+value'),
  ('r-ko-132', 'Leaf& Dew Core Essence', 5, '2주째 쓰고 있어요. 꾸준히 쓰니 피부가 촉촉하게 유지돼요. 레티놀 제품을 쓰다 따가웠는데 이건 자극이 없어요.', '건성', '20대', '2026-08-09', '+lasting_moisture +irritation'),
  ('r-ko-133', 'Leaf& Dew Core Essence', 5, '에센스 치고 합리적인 가격이에요. 순해서 아침저녁으로 써도 문제없어요.', '중성', '30대', '2026-08-11', '+value +irritation'),
  ('r-ko-134', 'Leaf& Dew Core Essence', 5, '민감성이라 새 제품은 늘 조심스러워요. 자기 전에 바르면 아침까지 촉촉함이 남아 있어요. 쟁여 두고 쓰고 싶어요.', '민감성', '40대', '2026-08-12', '+lasting_moisture'),
  ('r-ko-135', 'Leaf& Dew Core Essence', 1, '건조함에 예민한 건성 피부예요. 촉촉함이 오래 가진 않아요. 저와는 맞지 않았어요.', '건성', '20대', '2026-08-12', '-lasting_moisture'),
  ('r-ko-136', 'Leaf& Dew Core Essence', 2, '평범한 중성 피부예요. 피부가 약한 제게는 자극이 있었어요. 제 피부엔 보습이 모자라서 크림이 꼭 필요해요. 기대보다는 아쉬웠어요.', '중성', '20대', '2026-08-14', '-irritation -lasting_moisture'),
  ('r-ko-137', 'Leaf& Dew Core Essence', 5, '순한 에센스를 찾다가 정착했어요. 피부 속 수분이 차오르는 느낌이에요.', '복합성', '10대', '2026-08-14', '+irritation +lasting_moisture'),
  ('r-ko-138', 'Leaf& Dew Core Essence', 4, '복합성 피부예요. 끈적이지 않고 산뜻하게 마무리돼요. 50ml인데 펌프 한 번이면 충분해서 오래 써요.', '복합성', '40대', '2026-08-14', '+texture +value'),
  ('r-ko-139', 'Leaf& Dew Core Essence', 3, '건성이라 늘 속당김이 고민이었어요. 아침에 일어났을 때 피부결이 매끈해요. 한 가지 아쉬운 건 볼 쪽이 가렵고 따가웠어요. 그냥 무난해요.', '건성', '30대', '2026-08-14', '+lasting_moisture -irritation'),
  ('r-ko-140', 'Leaf& Dew Core Essence', 5, '촉촉한데 겉돌지 않고 피부에 착 붙어요. 재구매 의사 100%예요.', '지성', '20대', '2026-08-15', '+texture'),
  ('r-ko-141', 'Leaf& Dew Core Essence', 5, '건성이라 늘 속당김이 고민이었어요. 소량만 써서 가성비가 좋아요. 화장 전에 써도 들뜨지 않아요. 강력 추천해요!', '건성', '30대', '2026-08-17', '+value +texture'),
  ('r-ko-142', 'Leaf& Dew Core Essence', 2, '피부가 예민한 편이에요. 피부가 약한 제게는 자극이 있었어요. 순하긴 한데 효과를 크게 느끼진 못했어요. 재구매는 고민돼요.', '민감성', '30대', '2026-08-18', '-irritation -lasting_moisture'),
  ('r-ko-143', 'Leaf& Dew Core Essence', 3, '스킨이랑 세트로 쓰고 있어요. 한 병으로 두 달 넘게 쓰고 있어요. 그런데 촉촉함이 오래 가진 않아요. 한 통은 써 보려고요.', '건성', '30대', '2026-08-18', '+value -lasting_moisture'),
  ('r-ko-144', 'Leaf& Dew Core Essence', 4, '한 병 다 쓰고 남기는 후기예요. 스킨이랑 같이 쓰면 저녁까지 속건조가 덜해요. 한 가지 아쉬운 건 50ml는 금방 줄어서 가격 대비 아쉬워요.', '민감성', '20대', '2026-08-18', '+lasting_moisture -value'),
  ('r-ko-145', 'Leaf& Dew Core Essence', 5, '건조함에 예민한 건성 피부예요. 꾸준히 쓰니 피부가 촉촉하게 유지돼요.', '건성', '20대', '2026-08-19', '+lasting_moisture'),
  ('r-ko-146', 'Leaf& Dew Core Essence', 5, '꾸준히 쓰니 피부가 촉촉하게 유지돼요. 쟁여 두고 쓰고 싶어요.', '복합성', '20대', '2026-08-19', '+lasting_moisture'),
  ('r-ko-147', 'Leaf& Dew Core Essence', 5, '한 달 정도 써 봤어요. 화장 전에 써도 들뜨지 않아요. 한 번 바르고 나면 건조함이 다시 올라오지 않아요.', '지성', '30대', '2026-08-20', '+texture +lasting_moisture'),
  ('r-ko-148', 'Leaf& Dew Core Essence', 4, '한 달 정도 써 봤어요. 무향이라 다른 제품이랑 같이 써도 향이 섞이지 않아요. 전반적으로 만족하며 쓰고 있어요.', '지성', '30대', '2026-08-21', '+scent'),
  ('r-ko-149', 'Leaf& Dew Core Essence', 5, '무향무취라 아침에 쓰기 부담 없어요. 앞으로도 계속 쓸 것 같아요.', '지성', '40대', '2026-08-22', '+scent'),
  ('r-ko-150', 'Leaf& Dew Core Essence', 4, '평범한 중성 피부예요. 한 번 바르고 나면 건조함이 다시 올라오지 않아요.', '중성', '40대', '2026-08-23', '+lasting_moisture'),
  ('r-ko-151', 'Leaf& Dew Core Essence', 3, '펌프를 두세 번 누르면 흘러내려서 양 조절이 필요해요. 한 통은 써 보려고요.', '복합성', '20대', '2026-08-24', '-texture'),
  ('r-ko-152', 'Leaf& Dew Core Essence', 5, '2주째 쓰고 있어요. 꾸준히 쓰니 피부가 촉촉하게 유지돼요. 쟁여 두고 쓰고 싶어요.', '건성', '30대', '2026-08-26', '+lasting_moisture'),
  ('r-ko-153', 'Leaf& Dew Core Essence', 5, 'T존은 번들거리고 볼은 건조한 복합성이에요. 향이 없어서 향에 예민한 저한테 딱이에요. 재구매 의사 100%예요.', '복합성', '40대', '2026-08-27', '+scent'),
  ('r-ko-154', 'Leaf& Dew Core Essence', 1, 'T존은 번들거리고 볼은 건조한 복합성이에요. 양에 비하면 비싼 편이에요.', '복합성', '20대', '2026-08-27', '-value'),
  ('r-ko-155', 'Leaf& Dew Core Essence', 5, '인공 향 없이 깔끔해요. 주변에도 추천했어요.', '민감성', '20대', '2026-08-29', '+scent'),
  ('r-ko-156', 'Leaf& Dew Core Essence', 4, '스킨이랑 세트로 쓰고 있어요. 건조함에 예민한 건성 피부예요. 피부 속 수분이 차오르는 느낌이에요.', '건성', '30대', '2026-08-30', '+lasting_moisture'),
  ('r-ko-157', 'Leaf& Dew Core Essence', 5, '순한 에센스를 찾다가 정착했어요. 텍스처가 가벼워서 부담이 없어요. 앞으로도 계속 쓸 것 같아요.', '민감성', '30대', '2026-08-31', '+irritation +texture'),
  ('r-ko-158', 'Leaf& Dew Core Essence', 5, '2주째 쓰고 있어요. 한 번 바르고 나면 건조함이 다시 올라오지 않아요. 예민한 피부인데 따가움 없이 매일 쓰고 있어요. 주변에도 추천했어요.', '민감성', '20대', '2026-08-31', '+lasting_moisture +irritation'),
  ('r-ko-159', 'Leaf& Dew Core Essence', 4, '소량만 써서 가성비가 좋아요.', '중성', '20대', '2026-08-31', '+value'),
  ('r-ko-160', 'Leaf& Dew Core Essence', 4, '스킨이랑 세트로 쓰고 있어요. 레이어링해도 무겁지 않아서 크림 전에 바르기 좋아요. 다만 피부가 약한 제게는 자극이 있었어요.', '민감성', '20대', '2026-09-01', '+texture -irritation'),
  ('r-ko-161', 'Leaf& Dew Core Essence', 5, '펌프로 한 번 덜어 두드려 바르면 금방 흡수돼요. 만족스러워요.', '중성', '40대', '2026-09-01', '+texture'),
  ('r-ko-162', 'Leaf& Dew Core Essence', 5, '번들거리는 지성 피부예요. 용기가 작고 가벼워서 파우치에 넣고 다녀요. 강력 추천해요!', '지성', '30대', '2026-09-02', '+container'),
  ('r-ko-163', 'Leaf& Dew Core Essence', 5, '아침에 일어났을 때 피부결이 매끈해요. 적은 양으로도 얼굴 전체에 잘 펴 발려요.', '지성', '30대', '2026-09-03', '+lasting_moisture +texture'),
  ('r-ko-164', 'Leaf& Dew Core Essence', 5, '한 달 정도 써 봤어요. 무향이라 다른 제품이랑 같이 써도 향이 섞이지 않아요.', '건성', '30대', '2026-09-03', '+scent'),
  ('r-ko-165', 'Leaf& Dew Core Essence', 5, 'T존은 번들거리고 볼은 건조한 복합성이에요. 순한 에센스를 찾다가 정착했어요. 한 손으로 덜 수 있어서 바쁜 아침에 편해요.', '복합성', '30대', '2026-09-03', '+irritation +container'),
  ('r-ko-166', 'Leaf& Dew Core Essence', 5, '한 달 정도 써 봤어요. 수분 에센스답게 보습력이 좋아요.', '건성', '30대', '2026-09-03', '+lasting_moisture'),
  ('r-ko-167', 'Leaf& Dew Core Essence', 5, '끈적이지 않고 산뜻하게 마무리돼요. 스킨이랑 같이 쓰면 저녁까지 속건조가 덜해요. 재구매 의사 100%예요.', '건성', '40대', '2026-09-06', '+texture +lasting_moisture'),
  ('r-ko-168', 'Leaf& Dew Core Essence', 4, '2주째 쓰고 있어요. 꾸준히 쓰니 피부가 촉촉하게 유지돼요. 대체로 만족해요.', '복합성', '30대', '2026-09-07', '+lasting_moisture'),
  ('r-ko-169', 'Leaf& Dew Core Essence', 5, '스킨이랑 세트로 쓰고 있어요. 예민한 피부인데 따가움 없이 매일 쓰고 있어요. 앞으로도 계속 쓸 것 같아요.', '민감성', '20대', '2026-09-07', '+irritation'),
  ('r-ko-170', 'Leaf& Dew Core Essence', 5, '건성이라 늘 속당김이 고민이었어요. 피부 속 수분이 차오르는 느낌이에요. 순해서 아침저녁으로 써도 문제없어요. 강력 추천해요!', '건성', '30대', '2026-09-09', '+lasting_moisture +irritation'),
  ('r-ko-171', 'Leaf& Dew Core Essence', 5, '스킨이랑 세트로 쓰고 있어요. 피부가 예민한 편이에요. 피부가 뒤집어진 시기에도 부담 없이 발랐어요. 용량 대비 가격이 적당해서 만족해요. 재구매 의사 100%예요.', '민감성', '20대', '2026-09-11', '+irritation +value'),
  ('r-ko-172', 'Leaf& Dew Core Essence', 1, '제 피부엔 보습이 모자라서 크림이 꼭 필요해요. 다시 쓰진 않을 것 같아요.', '지성', '40대', '2026-09-11', '-lasting_moisture'),
  ('r-ko-173', 'Leaf& Dew Core Essence', 5, '피부가 뒤집어진 시기에도 부담 없이 발랐어요. 펌프로 한 번 덜어 두드려 바르면 금방 흡수돼요.', '건성', '30대', '2026-09-12', '+irritation +texture'),
  ('r-ko-174', 'Leaf& Dew Core Essence', 2, '한 번 바르고 나면 건조함이 다시 올라오지 않아요. 다만 한 병이 생각보다 빨리 떨어져요. 다른 제품을 찾아볼까 해요.', '복합성', '40대', '2026-09-14', '+lasting_moisture -value'),
  ('r-ko-175', 'Leaf& Dew Core Essence', 2, '건조함에 예민한 건성 피부예요. 향이 은근히 느껴져서 아쉬워요. 제 피부엔 보습이 모자라서 크림이 꼭 필요해요. 재구매는 고민돼요.', '건성', '30대', '2026-09-14', '-scent -lasting_moisture'),
  ('r-ko-176', 'Leaf& Dew Core Essence', 5, '한 병 다 쓰고 남기는 후기예요. 스킨이랑 같이 쓰면 저녁까지 속건조가 덜해요. 에센스인데 무겁지 않고 가볍게 스며들어요. 만족스러워요.', '건성', '30대', '2026-09-14', '+lasting_moisture +texture'),
  ('r-ko-177', 'Leaf& Dew Core Essence', 4, '번들거리는 지성 피부예요. 펌프가 부드럽게 눌려서 적당량이 나와요. 대체로 만족해요.', '지성', '20대', '2026-09-16', '+container'),
  ('r-ko-178', 'Leaf& Dew Core Essence', 5, '한 병 다 쓰고 남기는 후기예요. 피부 속 수분이 차오르는 느낌이에요. 주변에도 추천했어요.', '중성', '10대', '2026-09-16', '+lasting_moisture'),
  ('r-ko-179', 'Leaf& Dew Core Essence', 5, '붉은기가 있던 볼이 한결 차분해졌어요. 소량만 써서 가성비가 좋아요.', '복합성', '20대', '2026-09-19', '+irritation +value'),
  ('r-ko-180', 'Leaf& Dew Core Essence', 3, '아침에 일어났을 때 피부결이 매끈해요. 한 가지 아쉬운 건 겨울엔 가볍다 못해 묽게 느껴져요. 한 통은 써 보려고요.', '복합성', '30대', '2026-09-20', '+lasting_moisture -texture'),
  ('r-ko-181', 'Leaf& Dew Core Essence', 5, '순한 에센스를 찾다가 정착했어요.', '민감성', '20대', '2026-09-20', '+irritation'),
  ('r-ko-182', 'Leaf& Dew Core Essence', 5, '2주째 쓰고 있어요. 한 번 바르고 나면 건조함이 다시 올라오지 않아요. 화장 전에 써도 들뜨지 않아요. 재구매 의사 100%예요.', '중성', '40대', '2026-09-22', '+lasting_moisture +texture'),
  ('r-ko-183', 'Leaf& Dew Core Essence', 5, '2주째 쓰고 있어요. 번들거리는 지성 피부예요. 펌프로 한 번 덜어 두드려 바르면 금방 흡수돼요. 앞으로도 계속 쓸 것 같아요.', '지성', '20대', '2026-09-23', '+texture'),
  ('r-ko-184', 'Leaf& Dew Core Essence', 4, '지성이라 끈적임에 예민한 편이에요. 묽은 젤 같아서 바르는 느낌이 시원해요. 스킨이랑 같이 쓰면 저녁까지 속건조가 덜해요. 한 가지 아쉬운 건 처음 쓸 때 얼굴이 붉어졌어요. 대체로 만족해요.', '지성', '10대', '2026-09-23', '+texture +lasting_moisture -irritation'),
  ('r-ko-185', 'Leaf& Dew Core Essence', 5, '한 병 다 쓰고 남기는 후기예요. 민감성이라 새 제품은 늘 조심스러워요. 예민한 피부인데 따가움 없이 매일 쓰고 있어요. 강력 추천해요!', '민감성', '40대', '2026-09-24', '+irritation'),
  ('r-ko-186', 'Leaf& Dew Core Essence', 3, 'T존은 번들거리고 볼은 건조한 복합성이에요. 펌프형이라 필요한 만큼만 덜 수 있어서 위생적이에요. 한 가지 아쉬운 건 겨울엔 가볍다 못해 묽게 느껴져요. 특별히 나쁘진 않아요.', '복합성', '30대', '2026-09-24', '+container -texture'),
  ('r-ko-187', 'Leaf& Dew Core Essence', 5, '레티놀 제품을 쓰다 따가웠는데 이건 자극이 없어요. 무향이라 다른 제품이랑 같이 써도 향이 섞이지 않아요.', '민감성', '20대', '2026-09-24', '+irritation +scent'),
  ('r-ko-188', 'Leaf& Dew Core Essence', 4, '한 병 다 쓰고 남기는 후기예요. 펌프형이라 필요한 만큼만 덜 수 있어서 위생적이에요. 무난하게 좋아요.', '건성', '20대', '2026-09-24', '+container'),
  ('r-ko-189', 'Leaf& Dew Core Essence', 3, 'T존은 번들거리고 볼은 건조한 복합성이에요. 수분 에센스답게 보습력이 좋아요. 그런데 예민한 날에는 바르면 살짝 따끔거려요. 한 통은 써 보려고요.', '복합성', '20대', '2026-09-26', '+lasting_moisture -irritation'),
  ('r-ko-190', 'Leaf& Dew Core Essence', 4, '적은 양으로도 얼굴 전체에 잘 펴 발려요. 50ml인데 펌프 한 번이면 충분해서 오래 써요. 전반적으로 만족하며 쓰고 있어요.', '민감성', '40대', '2026-09-26', '+texture +value'),
  ('r-ko-191', 'Leaf& Dew Core Essence', 5, '한 병 다 쓰고 남기는 후기예요. 촉촉한데 겉돌지 않고 피부에 착 붙어요. 만족스러워요.', '지성', '30대', '2026-09-27', '+texture'),
  ('r-ko-192', 'Leaf& Dew Core Essence', 3, '건조함에 예민한 건성 피부예요. 스킨이랑 같이 쓰면 저녁까지 속건조가 덜해요. 다만 할인 없이는 재구매가 망설여져요.', '건성', '40대', '2026-09-30', '+lasting_moisture -value'),
  ('r-ko-193', 'Leaf& Dew Core Essence', 5, '화장 전에 써도 들뜨지 않아요.', '지성', '30대', '2026-09-30', '+texture'),
  ('r-ko-194', 'Leaf& Dew Core Essence', 4, '레이어링해도 무겁지 않아서 크림 전에 바르기 좋아요.', '복합성', '20대', '2026-10-01', '+texture'),
  ('r-ko-195', 'Leaf& Dew Core Essence', 4, '지성이라 끈적임에 예민한 편이에요. 레티놀 제품을 쓰다 따가웠는데 이건 자극이 없어요. 재구매 의사 있어요.', '지성', '40대', '2026-10-01', '+irritation'),
  ('r-ko-196', 'Leaf& Dew Core Essence', 3, '평범한 중성 피부예요. 한 번 바르고 나면 건조함이 다시 올라오지 않아요. 그런데 50ml는 금방 줄어서 가격 대비 아쉬워요. 한 통은 써 보려고요.', '중성', '20대', '2026-10-01', '+lasting_moisture -value'),
  ('r-ko-197', 'Leaf& Dew Core Essence', 5, '피부가 예민한 편이에요. 순해서 아침저녁으로 써도 문제없어요.', '민감성', '30대', '2026-10-01', '+irritation'),
  ('r-ko-198', 'Leaf& Dew Core Essence', 4, '한 병 다 쓰고 남기는 후기예요. 복합성 피부예요. 순한 에센스를 찾다가 정착했어요. 레이어링해도 무겁지 않아서 크림 전에 바르기 좋아요. 한 가지 아쉬운 건 마지막쯤엔 펌프로 안 올라와서 남은 양을 못 써요. 무난하게 좋아요.', '복합성', '30대', '2026-10-02', '+irritation +texture -container'),
  ('r-ko-199', 'Leaf& Dew Core Essence', 3, '저녁에 발라도 아침엔 다시 건조해요. 재구매는 고민해 볼래요.', '복합성', '30대', '2026-10-02', '-lasting_moisture'),
  ('r-ko-200', 'Leaf& Dew Core Essence', 4, '민감성이라 새 제품은 늘 조심스러워요. 붉은기가 있던 볼이 한결 차분해졌어요. 무난하게 좋아요.', '민감성', '40대', '2026-10-02', '+irritation'),
  ('r-ko-201', 'Leaf& Dew Core Essence', 3, '건성이라 늘 속당김이 고민이었어요. 예민한 날에도 안심하고 쓸 수 있어요. 다만 촉촉함이 오래 가진 않아요. 한 통은 써 보려고요.', '건성', '30대', '2026-10-04', '+irritation -lasting_moisture'),
  ('r-ko-202', 'Leaf& Dew Core Essence', 5, '한 달 정도 써 봤어요. 복합성 피부예요. 속까지 촉촉함이 오래가는 느낌이에요.', '복합성', '30대', '2026-10-05', '+lasting_moisture'),
  ('r-ko-203', 'Leaf& Dew Core Essence', 2, 'T존은 번들거리고 볼은 건조한 복합성이에요. 용기가 작고 가벼워서 파우치에 넣고 다녀요. 다만 제 피부엔 보습이 모자라서 크림이 꼭 필요해요. 용량에 비해 가격이 조금 부담돼요. 재구매는 고민돼요.', '복합성', '40대', '2026-10-05', '+container -lasting_moisture -value'),
  ('r-ko-204', 'Leaf& Dew Core Essence', 5, '점도가 적당해서 흘러내리지 않아요. 강력 추천해요!', '지성', '30대', '2026-10-07', '+texture'),
  ('r-ko-205', 'Leaf& Dew Core Essence', 5, '묽은 젤 같아서 바르는 느낌이 시원해요. 꾸준히 쓰니 피부가 촉촉하게 유지돼요. 강력 추천해요!', '지성', '40대', '2026-10-09', '+texture +lasting_moisture'),
  ('r-ko-206', 'Leaf& Dew Core Essence', 4, '한 달 정도 써 봤어요. 평범한 중성 피부예요. 레티놀 제품을 쓰다 따가웠는데 이건 자극이 없어요. 한 번 바르고 나면 건조함이 다시 올라오지 않아요. 재구매 의사 있어요.', '중성', '30대', '2026-10-11', '+irritation +lasting_moisture'),
  ('r-ko-207', 'Leaf& Dew Core Essence', 5, '2주째 쓰고 있어요. 수분 에센스답게 보습력이 좋아요.', '건성', '30대', '2026-10-11', '+lasting_moisture'),
  ('r-ko-208', 'Leaf& Dew Core Essence', 2, '볼 쪽이 가렵고 따가웠어요. 재구매는 고민돼요.', '지성', '30대', '2026-10-13', '-irritation'),
  ('r-ko-209', 'Leaf& Dew Core Essence', 4, '스킨이랑 세트로 쓰고 있어요. 묽은 젤 같아서 바르는 느낌이 시원해요. 다만 예민한 날에는 바르면 살짝 따끔거려요. 무난하게 좋아요.', '민감성', '30대', '2026-10-13', '+texture -irritation'),
  ('r-ko-210', 'Leaf& Dew Core Essence', 4, '건조함에 예민한 건성 피부예요. 한 번 바르고 나면 건조함이 다시 올라오지 않아요. 적은 양으로도 얼굴 전체에 잘 펴 발려요. 다만 양에 비하면 비싼 편이에요. 재구매 의사 있어요.', '건성', '40대', '2026-10-13', '+lasting_moisture +texture -value'),
  ('r-ko-211', 'Leaf& Dew Core Essence', 1, '피부가 약한 제게는 자극이 있었어요. 처음 열었을 때 올라오는 냄새가 별로예요. 주변에도 추천하기 어려울 것 같아요.', '지성', '20대', '2026-10-14', '-irritation -scent'),
  ('r-ko-212', 'Leaf& Dew Core Essence', 5, '한 달 정도 써 봤어요. 복합성 피부예요. 아침에 일어났을 때 피부결이 매끈해요. 만족스러워요.', '복합성', '20대', '2026-10-14', '+lasting_moisture'),
  ('r-ko-213', 'Leaf& Dew Core Essence', 5, '한 달 정도 써 봤어요. 순한 에센스를 찾다가 정착했어요. 건조한 계절에도 얼굴이 당기지 않아요.', '복합성', '30대', '2026-10-14', '+irritation +lasting_moisture'),
  ('r-ko-214', 'Leaf& Dew Core Essence', 4, '한 달 정도 써 봤어요. 건성이라 늘 속당김이 고민이었어요. 아침에 일어났을 때 피부결이 매끈해요. 그런데 예민한 날에는 바르면 살짝 따끔거려요.', '건성', '30대', '2026-10-15', '+lasting_moisture -irritation'),
  ('r-ko-215', 'Leaf& Dew Core Essence', 4, '2주째 쓰고 있어요. 세일하는 김에 두 병 사 뒀어요. 텍스처가 가벼워서 부담이 없어요. 그런데 순하긴 한데 효과를 크게 느끼진 못했어요.', '복합성', '30대', '2026-10-16', '+value +texture -lasting_moisture'),
  ('r-ko-216', 'Leaf& Dew Core Essence', 5, '무향이라 다른 제품이랑 같이 써도 향이 섞이지 않아요.', '지성', '20대', '2026-10-17', '+scent'),
  ('r-ko-217', 'Leaf& Dew Core Essence', 5, '번들거리는 지성 피부예요. 자기 전에 바르면 아침까지 촉촉함이 남아 있어요.', '지성', '30대', '2026-10-17', '+lasting_moisture'),
  ('r-ko-218', 'Leaf& Dew Core Essence', 5, '수분 에센스답게 보습력이 좋아요.', '복합성', '30대', '2026-10-18', '+lasting_moisture'),
  ('r-ko-219', 'Leaf& Dew Core Essence', 5, '한 달 정도 써 봤어요. 예민한 날에도 안심하고 쓸 수 있어요. 인공 향 없이 깔끔해요. 만족스러워요.', '민감성', '30대', '2026-10-18', '+irritation +scent'),
  ('r-ko-220', 'Leaf& Dew Core Essence', 5, '스킨이랑 세트로 쓰고 있어요. 스킨이랑 같이 쓰면 저녁까지 속건조가 덜해요.', '민감성', '20대', '2026-10-19', '+lasting_moisture')
) as v(ext, product_name, rating, body, skin, age, posted, tags) on true
join public.products p on p.workspace_id = s.workspace_id and p.kind = 'own' and p.name = v.product_name
on conflict (workspace_id, source, external_id) do nothing;

-- 3. 결과 확인: 제품마다 샘플 리뷰가 몇 건인지 (Deep Skin 120 · Core Essence 100이면 정상)
select p.name as 제품, count(*) as 샘플_리뷰
from public.reviews r
join public.products p on p.id = r.product_id and p.workspace_id = r.workspace_id
where r.workspace_id = (select workspace_id from _seed) and r.external_id like 'sample-r-ko-%'
group by p.name
order by p.name;

commit;
