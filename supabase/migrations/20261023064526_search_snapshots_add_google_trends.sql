-- search_snapshots: 엔진 선택지에 google_trends 추가 (성분 검색 관심도)
-- google_trends 행: seed = 카테고리(化粧水 등), suggestions = 「카테고리 + 성분」 검색어를 검색 관심도 순으로 [{ value, position, relevance(0~100) }]
-- 앞 파일(20261023030835_create_search_snapshots.sql)은 고치지 않는다 (DB_RULES 1장 1번). check 제약은 지우고 다시 만든다 (DB_RULES 2.3)

alter table public.search_snapshots drop constraint if exists search_snapshots_engine_check;
alter table public.search_snapshots add constraint search_snapshots_engine_check
  check (engine in ('google_autocomplete', 'google_trends'));

comment on column public.search_snapshots.suggestions is
  '[{ value, position, relevance }]. google_autocomplete: relevance = Google 내부 값 · google_trends: relevance = 검색 관심도 0~100 (1위 = 100)';
