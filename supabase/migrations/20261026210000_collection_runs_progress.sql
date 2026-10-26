-- 경쟁 제품 수집의 진행 표시: 수집기가 제품 하나를 읽을 때마다 "몇 개 중 몇 개"를 적고, 화면이 그것을 보여 준다.
-- 작업: 열 추가 (collection_runs.progress_total · progress_done · progress_note). 세 칸 모두 null 허용.
--   기존 행과 수집기가 아직 갱신하지 않은 요청은 null이고, null이면 화면은 숫자 없이 "읽고 있어요"만 보여 준다.
-- 근거: docs/DB_RULES.md 2장 (열 추가) · 수집기 자동 실행 제안 검토 결과 (Min, 2026-10-26)
-- 선행: 20261023211500_create_collection_runs.sql (collection_runs)
-- RLS · 인덱스: 새 테이블이 아니라 기존 정책 그대로다. 칸은 수집기(service role)가 쓰고 화면은 읽기만 한다.
--
-- 수집기가 이 칸을 쓸 때마다 collection_runs_set_updated_at 트리거가 updated_at도 갱신한다.
-- 그래서 "멈춘 요청" 판정은 started_at이 아니라 updated_at 기준으로 바뀐다 (collectors/db.py fail_stale_runs).

alter table public.collection_runs
  add column progress_total smallint check (progress_total >= 0),
  add column progress_done smallint check (progress_done >= 0),
  add column progress_note text check (char_length(progress_note) <= 120);

comment on column public.collection_runs.progress_total is '읽을 제품 수. 순위를 가져온 직후 수집기가 적는다. null = 아직 모름';
comment on column public.collection_runs.progress_done is '읽기를 마친 제품 수 (실패한 제품 포함). 제품 하나를 마칠 때마다 수집기가 갱신한다';
comment on column public.collection_runs.progress_note is '방금 마친 제품 이름. 화면 보조 문구';
