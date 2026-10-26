-- 설문 추천 기록에 유입 경로 칸: 집계 화면 "채널" 탭이 경로별 구매하기 클릭 · 출시 알림 화면 연 수를 센다.
-- 작업: 열 추가 (survey_reco_events.source). 값과 규칙은 survey_responses.source와 같다 (링크 꼬리표 ?src= 또는 마지막 문항의 답).
--   이 칸 이전의 기록과 경로를 고르지 않은 응답자의 기록은 null이고, 채널 집계에서 빠진다.
--   익명 insert 정책(열린 설문일 때만)은 그대로 쓴다.
-- 선행: 20261023030815_survey.sql (survey_reco_events)

alter table public.survey_reco_events
  add column source text check (source in ('instagram', 'x', 'line', 'rakuten', 'qoo10', 'friend', 'search', 'other'));

comment on column public.survey_reco_events.source is '이 기록을 남긴 응답자의 유입 경로 (survey_responses.source와 같은 값). null = 경로 없음';
