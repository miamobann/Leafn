-- 리뷰에 '제품 외 불만 제외' 표시 칸 추가 (lab 실험)
-- 왜: 낮은 별점 리뷰에는 배송 · 파손 · 누락 · 응대처럼 제품과 무관한 불만이 섞여 있다. 소구점 통계에 들어가면 안 되지만,
--     지운 채로 두면 다음 수집 때 같은 리뷰를 다시 읽고 다시 판단하게 된다. 그래서 행은 남기고 '제외 사유'만 표시한다.
-- 어떻게: excluded_reason이 null이면 제외 아님(분석 대상). 값이 있으면 제외. 분석 · 집계는 반드시 null인 것만 읽는다 (lib/data 한 곳에서)
-- 선행: 20261023202113_create_products_reviews.sql, 20261023211500_create_collection_runs.sql
-- 기존 행은 모두 null(제외 아님)이라 안전하다. 기존 마이그레이션 파일은 고치지 않았다 (DB_RULES)

-- 1. 칸 추가 -------------------------------------------------------------

alter table public.reviews
  add column excluded_reason text
  check (excluded_reason in ('shipping', 'damage', 'missing_item', 'service', 'other_non_product'));
comment on column public.reviews.excluded_reason is '제품 외 불만이라 분석에서 뺀 사유. null이면 분석 대상. shipping 배송 · damage 파손 · missing_item 누락 · service 판매처 응대 · other_non_product 그 밖. 분석 · 집계는 null인 행만 읽는다';

alter table public.collection_staged_reviews
  add column excluded_reason text
  check (excluded_reason in ('shipping', 'damage', 'missing_item', 'service', 'other_non_product'));
comment on column public.collection_staged_reviews.excluded_reason is '저장하면 reviews.excluded_reason으로 옮겨 간다. 의미는 reviews와 같다';

-- 2. 저장 함수: 제외 표시도 함께 옮기고, 새로 저장한 수(saved_count)에는 제외된 리뷰를 세지 않는다 ------------
-- 제외된 리뷰도 reviews에 들어간다 (다음 수집 때 같은 번호를 다시 읽고 판단하지 않으려고). 나머지는 20261023211500의 함수와 같다

create or replace function public.save_collection_run(p_run_id uuid)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  r public.collection_runs%rowtype;
  v_reviews integer;
  v_products integer;
begin
  select * into r from public.collection_runs where id = p_run_id for update;
  if not found then
    raise exception '수집 요청을 찾을 수 없습니다';
  end if;
  if r.status <> 'ready' then
    raise exception '미리보기 상태가 아니라 저장할 수 없습니다 (현재: %)', r.status;
  end if;

  -- 1) 제품: 이미 있으면 갱신, 없으면 경쟁 제품으로 추가
  insert into public.products (workspace_id, kind, brand, name, category, platform_id, external_id, url, source_raw, collected_at)
  select rp.workspace_id, 'competitor', rp.brand, rp.title,
         case r.category when 'toner' then '化粧水' when 'serum' then '美容液' else r.category end,
         r.platform_id, rp.external_id, rp.url,
         jsonb_build_object(
           'rank', rp.rank, 'sort', 'MOST_REVIEWED', 'listing_type', rp.listing_type, 'is_set', rp.is_set,
           'site_total_count', rp.site_total_count, 'site_low_count', rp.site_low_count,
           'captured_at', coalesce(r.finished_at, now())),
         now()
  from public.collection_run_products rp
  where rp.run_id = r.id and rp.status in ('done', 'partial')
  on conflict (workspace_id, platform_id, external_id) do update
    set brand = excluded.brand, name = excluded.name, url = excluded.url,
        source_raw = excluded.source_raw, collected_at = excluded.collected_at;

  update public.collection_run_products rp set product_id = p.id
  from public.products p
  where rp.run_id = r.id and rp.status in ('done', 'partial')
    and p.workspace_id = rp.workspace_id and p.platform_id = r.platform_id and p.external_id = rp.external_id;

  -- 2) 자사 제품과 경쟁 제품 연결
  if r.own_product_id is not null then
    insert into public.product_competitors (workspace_id, own_product_id, competitor_product_id)
    select r.workspace_id, r.own_product_id, rp.product_id
    from public.collection_run_products rp
    where rp.run_id = r.id and rp.product_id is not null
    on conflict (own_product_id, competitor_product_id) do nothing;
  end if;

  -- 3) 리뷰: 이미 가진 리뷰(같은 워크스페이스 · 출처 · 번호)는 건너뛴다. 제품별로 새로 들어간 수를 센다
  with inserted as (
    insert into public.reviews (workspace_id, product_id, source, external_id, lang, rating, rating_scale, body, body_ko, reviewer_attrs, posted_at, raw, excluded_reason)
    select s.workspace_id, rp.product_id, r.platform_id, s.external_id, s.lang, s.rating, s.rating_scale, s.body, s.body_ko, s.reviewer_attrs, s.posted_at, s.raw, s.excluded_reason
    from public.collection_staged_reviews s
    join public.collection_run_products rp on rp.id = s.run_product_id and rp.workspace_id = s.workspace_id
    where rp.run_id = r.id and rp.product_id is not null
    on conflict (workspace_id, source, external_id) do nothing
    returning product_id, excluded_reason
  ), per_product as (
    select product_id, count(*) filter (where excluded_reason is null)::integer as n from inserted group by product_id
  )
  update public.collection_run_products rp
  set saved_count = coalesce((select n from per_product pp where pp.product_id = rp.product_id), 0)
  where rp.run_id = r.id and rp.product_id is not null;

  select coalesce(sum(saved_count), 0)::integer, count(*)::integer into v_reviews, v_products
  from public.collection_run_products where run_id = r.id and product_id is not null;

  -- 4) 임시 리뷰를 비우고 요청을 저장됨으로 바꾼다 (제품별 결과는 "마지막 저장" 기록으로 남는다)
  delete from public.collection_staged_reviews s
  using public.collection_run_products rp
  where rp.id = s.run_product_id and rp.workspace_id = s.workspace_id and rp.run_id = r.id;

  update public.collection_runs set status = 'saved', saved_at = now(), saved_count = v_reviews where id = r.id;

  return jsonb_build_object('run_id', r.id, 'products', v_products, 'new_reviews', v_reviews);
end;
$$;
comment on function public.save_collection_run(uuid) is '미리보기(ready)를 확정한다. 제품 · 연결 · 리뷰를 한 번에 넣고 임시 리뷰를 비운다. 이미 있는 리뷰는 건너뛴다. 제외 표시도 옮기며 saved_count는 제외되지 않은 새 리뷰만 센다';
