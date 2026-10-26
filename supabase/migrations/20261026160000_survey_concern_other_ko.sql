-- 설문 '기타' 고민의 한국어 번역 칸: 집계 화면이 일본어 원문 아래에 한국어를 함께 보여 준다.
-- 작업: 열 추가 (survey_responses.concern_other_ko). 새 응답은 null이고, null이면 화면은 일본어 원문만 보여 준다.
--   공개 설문(anon insert)은 이 칸을 채우지 않는다. 더미 응답은 supabase/seeds/survey_dummy_responses.sql이 채운다.
-- 선행: 20261023030815_survey.sql (survey_responses)
-- 파일 시각: 이미 있는 20261026150000 뒤에 오도록 정했다 (원격에 먼저 적용된 마이그레이션보다 앞서지 않게).

alter table public.survey_responses
  add column concern_other_ko text check (char_length(concern_other_ko) <= 100);

comment on column public.survey_responses.concern_other_ko is '''기타'' 고민(concern_other)의 한국어 번역. null = 아직 번역 전';
