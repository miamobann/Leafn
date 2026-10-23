-- geo_snapshots: 카테고리 칸 추가, Claude 엔진 허용, 중복 방지 키에 카테고리 포함
-- 이유: GEO 질의를 카테고리(化粧水·美容液·クリーム·日焼け止め·クレンジング) × 피부 고민으로 만들고, ChatGPT와 함께 Claude에도 묻는다
-- 앞 파일(20261023050041_create_geo_snapshots.sql)은 고치지 않는다 (DB_RULES 1장 1번)

alter table public.geo_snapshots add column category text;  -- null 허용: 기존 행 안전. 새 행은 앱이 항상 채운다
comment on column public.geo_snapshots.category is '질의 카테고리 (化粧水·美容液·クリーム·日焼け止め·クレンジング). 질의는 카테고리 × 피부 고민 틀로 만든다';

-- 엔진 선택지에 claude 추가 (check 제약은 지우고 다시 만든다 · DB_RULES 2.3)
alter table public.geo_snapshots drop constraint if exists geo_snapshots_engine_check;
alter table public.geo_snapshots add constraint geo_snapshots_engine_check
  check (engine in ('chatgpt', 'claude', 'gemini', 'perplexity'));

-- 중복 방지 키를 카테고리 포함으로 바꾼다. 자동 생성된 이름이 길어 잘릴 수 있어 카탈로그에서 찾아 지운다
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.geo_snapshots'::regclass and contype = 'u'
  loop
    execute format('alter table public.geo_snapshots drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.geo_snapshots add constraint geo_snapshots_run_key
  unique (workspace_id, engine, category, query, run_index, captured_at);
