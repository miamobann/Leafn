-- SNS 영상 분석 결과 저장 (시장 분석 · 소비자 트렌드 2-B, 서버 데이터 연동 작업 지침서 2번, 2026-10-26)
-- 작업: 테이블 추가 (sns_trend_analyses). 분석 한 번 = 한 행. 다시 분석하면 새 행이 쌓이고, 화면은 카테고리마다 최신 행을 읽는다
-- 근거: docs/DB_RULES.md 3장 템플릿 (workspace_id + 인덱스 + is_member RLS 4개), CLAUDE.md 5장 (AI 결과 행에는 model · prompt_version)
-- 선행: 20261022082907_base_workspaces.sql (workspaces, profiles, is_member)
-- 파일 이름: Supabase CLI가 이 PC에 없어 손으로 만들었다. 이미 있는 마지막 마이그레이션(20261026200000)보다 뒤 시각으로 정했다
--
-- 모양은 apps/web/lib/schemas/market.ts SnsTrendAnalysisRow:
--   videos = 입력 링크 · 메모 + Apify로 받은 영상 정보 (SnsAnalysisVideo[])
--   result = AI 결과 중 대조를 통과한 것 (needs · keywords · dropped · analyzed_at)

create table public.sns_trend_analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  category text not null,
  videos jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  model text not null,
  prompt_version text not null
);
comment on table public.sns_trend_analyses is 'TikTok 영상 분석 한 번의 결과 (소비자 핵심 니즈 순위). 화면: 시장 분석 요약 · 소비자 트렌드 2-B';
comment on column public.sns_trend_analyses.created_by is '분석을 실행하거나 결과 JSON을 올린 사람. 탈퇴하면 null';
comment on column public.sns_trend_analyses.videos is '입력 링크 · 메모 + Apify 영상 정보 (캡션 · 해시태그 · 조회수 · 발화 자막). 모양은 lib/schemas/market.ts SnsAnalysisVideo';
comment on column public.sns_trend_analyses.result is 'AI 결과 (needs · keywords · dropped · analyzed_at). 모양은 lib/schemas/market.ts SnsAnalysisResult';

create index sns_trend_analyses_workspace_category_idx on public.sns_trend_analyses (workspace_id, category, created_at desc);
create index sns_trend_analyses_created_by_idx on public.sns_trend_analyses (created_by);

alter table public.sns_trend_analyses enable row level security;

create policy "sns_trend_analyses read members" on public.sns_trend_analyses
  for select to authenticated using (public.is_member(workspace_id));
create policy "sns_trend_analyses insert members" on public.sns_trend_analyses
  for insert to authenticated with check (public.is_member(workspace_id));
create policy "sns_trend_analyses update members" on public.sns_trend_analyses
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "sns_trend_analyses delete members" on public.sns_trend_analyses
  for delete to authenticated using (public.is_member(workspace_id));
