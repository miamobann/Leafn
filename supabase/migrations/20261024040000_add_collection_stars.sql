-- 수집 요청에 '체크한 별점'과 별점별 결과 추가 (lab 실험)
-- 왜: 낮은 별점순으로 읽으면 인기 제품은 상한이 1점 리뷰로만 찬다. 그래서 화면에서 가져올 별점(1·2·3점)을 체크박스로 고르게 하고,
--     별점마다 그 별점이 시작하는 페이지로 건너뛰어 아직 없는 리뷰를 최신순으로 N건씩 가져온다 (sources/qoo10.py collect_stars).
--     예전의 "이 별점 이하"(max_star)로는 3점만 가져올 수 없다.
-- 어떻게: collection_runs.stars = 체크한 별점 목록. review_limit의 뜻이 '제품당 읽을 수'에서 '별점마다 새로 가져올 수'로 바뀐다.
--     max_star는 지우지 않고 체크한 별점 중 가장 높은 값으로 채운다 (기존 칸 · 기존 마이그레이션을 건드리지 않는다).
--     collection_run_products.star_counts = 별점별 결과 {"3": {start_page, read, skipped_known, new, exhausted}} (화면이 "3점 20건 이상" 같은 문구에 쓴다)
-- 기존 행: stars는 max_star로 채운다 (예: max_star 3 → {1,2,3}), star_counts는 null (읽지 않은 기록)
-- 선행: 20261023211500_create_collection_runs.sql, 20261024020000_add_site_low_count_exact.sql

alter table public.collection_runs add column stars smallint[];
update public.collection_runs set stars = array(select s::smallint from generate_series(1, max_star) as s);
alter table public.collection_runs alter column stars set not null;
alter table public.collection_runs
  add constraint collection_runs_stars_check check (stars <@ array[1, 2, 3, 4, 5]::smallint[] and cardinality(stars) between 1 and 5);

comment on column public.collection_runs.stars is '가져올 별점 (화면의 체크박스). 별점마다 따로 읽는다. 체크하지 않은 별점은 읽지 않는다';
comment on column public.collection_runs.max_star is '체크한 별점 중 가장 높은 값 (stars와 함께 채운다). 옛 "이 별점 이하" 의미는 쓰지 않는다';
comment on column public.collection_runs.review_limit is '별점마다 새로 가져올 리뷰 수. 이미 저장한 리뷰는 건너뛰고 아직 없는 리뷰를 최신순으로 이만큼 모은다';

alter table public.collection_run_products add column star_counts jsonb;
comment on column public.collection_run_products.star_counts is '별점별 결과 {"3": {start_page, read, skipped_known, new, exhausted}}. read는 이미 가진 리뷰를 포함해 읽은 수, exhausted가 true면 그 별점 구간 끝까지 읽어 read가 정확한 수다';
comment on column public.collection_run_products.read_count is '읽은 리뷰 수 (체크한 별점 전체, 이미 가진 id 포함)';
comment on column public.collection_run_products.site_low_count is '체크한 별점의 리뷰를 읽은 수 (이미 가진 것 포함). site_low_count_exact가 false면 "그 수 이상"이다';
comment on column public.collection_run_products.stop_reason is 'limit 별점마다 새로 가져올 수에 닿아 멈춤 · max_star 체크한 별점 구간 끝까지 읽음 · end_of_list 목록 끝';
