-- 제품명 정리: 긴 일본어 제품명에서 브랜드 · 제품명 · 용량 · 대표 성분만 뽑고 한국어 번역을 붙인 결과를 저장한다.
-- 작업: 열 추가 (products.title_ai). 기존 행은 null로 두고, null이면 화면이 원문 제품명을 그대로 보여 준다.
-- 근거: docs/DB_RULES.md 2장 (AI가 만든 값은 model · prompt_version을 함께 남긴다 → jsonb 안에 같이 저장)
-- 선행: 20261023202113_create_products_reviews.sql (products)
--
-- 수집기(save_collection_run)는 brand · name · url · source_raw만 갱신하므로 이 칸을 덮어쓰지 않는다.
-- 모양은 apps/web/lib/schemas/product.ts ProductTitleAi:
--   { brand_ko, name_short_ja, name_ko, volume, key_ingredient_ja, key_ingredient_ko, model, prompt_version }

alter table public.products
  add column title_ai jsonb;

comment on column public.products.title_ai is 'AI가 정리한 제품명 (브랜드 · 짧은 제품명 · 용량 · 대표 성분 + 한국어). null = 아직 정리 전. 원문 제품명은 name에 그대로 있다';
