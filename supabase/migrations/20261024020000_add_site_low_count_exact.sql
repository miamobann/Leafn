-- 제품별 수집 결과에 '1~3점 수가 정확한 값인지' 표시 칸 추가 (lab 실험)
-- 왜: 수집기는 낮은 별점순으로 읽다가 상한(제품당 최대 건수)에 닿으면 멈춘다. 상한에 닿았으면 site_low_count는 '그 수 이상'이라는 뜻이고,
--     별점이 더 높은 리뷰를 만나거나 목록이 끝나서 멈췄으면 정확한 수다. 화면이 "30건 이상"과 "12건"을 구분해 보여 주려면 이 구분이 필요하다.
-- 어떻게: true면 정확한 수, false면 상한 이상, null이면 모름(읽지 못한 제품). 기존 행은 모두 null이라 안전하다
-- 선행: 20261023211500_create_collection_runs.sql. 기존 마이그레이션 파일은 고치지 않았다 (DB_RULES)

alter table public.collection_run_products add column site_low_count_exact boolean;
comment on column public.collection_run_products.site_low_count_exact is 'site_low_count가 정확한 수(true)인지, 읽기 상한에 닿아 "그 수 이상"(false)인지. 읽지 못했으면 null';
