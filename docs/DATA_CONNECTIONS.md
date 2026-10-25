# 실제 데이터 조회 연결 (2026-10-24 · 갱신 2026-10-26)

> 정리 전 원문: [archive/pre_DATA_CONNECTIONS.md](archive/pre_DATA_CONNECTIONS.md). 테이블 칸 정의는 [db-frame.md](db-frame.md).

## 조회 기준

- Supabase 환경 변수가 없을 때만 기존 샘플 모드를 사용한다.
- 연결된 환경에서 로그인/워크스페이스가 없거나 쿼리가 실패하면 오류로 처리한다. 샘플로 숨기지 않는다.
- 팀 데이터는 세션 RLS와 `workspace_id` 조건을 함께 사용한다. 현재 워크스페이스는 기존 정책대로 가장 먼저 참여한 팀이다.
- 공통 조회는 `id`로 정렬하여 1,000행씩 끝까지 읽는다. React 요청 캐시만 사용하며 사용자 사이에 결과를 공유하지 않는다.
- 상단 프로젝트 선택은 기존처럼 제품군 선택 UI다. 모든 탭의 전역 필터로 사용하지 않는다. 탭별 제품 선택은 DB의 동일한 제품 ID를 사용한다.

## 테이블별 연결

| 테이블 | 사용 화면 / 상태 |
| --- | --- |
| workspaces, workspace_members, profiles | 헤더, 설정, 담당자 이름. 기존 로그인 세션 사용 |
| projects, products | 프로젝트 관리, 제품 선택, 시장 비교·상세, 리뷰, 광고 입력, 자료실 |
| ad_checks, ad_check_lines, content_guides | 약기법 광고 검토 판정 자동 저장·이력 조회·담당자 승인(`owner` 전용), 콘텐츠 제작 가이드 자동 저장·자료실 연동 |
| product_competitors | 소구점 비교의 실제 자사-경쟁제품 연결 |
| reviews, review_analyses | 리뷰 목록·리포트·소구점. 제외 리뷰 제거, 실제 분석 연결. AI 묶음 분석과 일본어 → 한국어 번역(`reviews.body_ko`)을 화면에서 실행·저장 (#76) |
| trend_snapshots, search_snapshots, geo_snapshots | 시장 화면 초기 조회·새로고침 시 저장된 결과 표시 |
| platform_notes | 화면 없음 (진출 실행 탭 제거, 2026-10-24). 테이블은 확장용으로 남김 |
| promo_events, promo_milestones | 홈 캘린더·`/calendar` 전체보기·콘텐츠 제작 재료 조회, 실제 마감 완료 상태 |
| surveys, survey_responses | 설문 집계의 문항·피부타입·연령·고민·최근 응답 |
| survey_minor_counts, survey_reco_events | 미성년 참여 수와 추천 노출·구매 클릭 집계. notify_open은 신청 완료로 계산하지 않음 |
| collection_runs, collection_run_products, collection_staged_reviews, collection_run_skipped | 기존 수집 조회 유지. 자사 제품·진행 요청 조회에 현재 팀 조건 추가 |
| member_tabs | 설정의 담당 탭 표(owner만 체크 변경), 시안 패널의 버튼 표시 여부 |
| tab_submissions, submission_versions, submission_reviews | 리뷰 리포트·광고 검토 상세의 시안 패널(저장·제출·취소·숨김·새 버전), `/approvals` 결재함·버전 미리보기(승인·반려), 홈·`/projects`의 제품 × 탭 진행 표, 홈의 2일 넘은 결재 알림 |
| ai_analyses | `/ai-analysis` 실행·결과·팀장 확인, 진행 표의 AI 분석 칸 |

`review_insights`는 새 테이블 없이 review_analyses에서 계산한다. 같은 리뷰의 반복 키워드는 한 번만 세고 실제 근거 리뷰 ID를 보존한다.

## 별도 작업이 필요한 부분

- activity_log: 현재 없음. 실제 모드에서 샘플 이력을 표시하지 않는다. 홈의 샘플 8단계 현황판은 제품 × 탭 진행 표(탭별 시안·결재 테이블)로 바꿨다 (2026-10-26, 아래 "시안 · 결재 · AI 분석").
- SNS 메모·패턴·카피 후보, 랭킹 이미지 원본: 저장 경로가 없어 실제 모드에서 샘플 결과를 반환하지 않는다.
- 공개 설문 제출·추천 이벤트 기록과 출시 알림: 이번 변경은 기존 데이터 조회다. 공개 제출은 기존 미연결 상태이며, 출시 알림 저장 테이블도 없다.
- 캘린더 추가·마감 변경: 기존 미저장 미리보기 동작과 안내를 유지한다 (`lib/data/launch-actions.ts`). 플랫폼 메모 편집 화면은 없앴다.
- 설문 추천 라인과 공개 설문 문항은 기존 콘텐츠 정의를 유지한다. 대시보드 문항은 surveys에서 읽는다. 여러 설문을 합산하고 같은 문항 ID의 라벨은 최신 설문 것을 사용한다.
- 광고 입력은 실제 등록 제품의 전성분 원문을 사용한다. 일본어 명칭·INCI·제품 구분을 샘플에서 추정하지 않는다. 제품 구분은 미정(null)이며, 콘텐츠 가이드는 전성분·가격·용량이 있는 제품만 표시한다.
- 대규모 데이터에서는 모든 리뷰를 서버 메모리에 읽는 집계를 DB 집계/RPC로 옮겨야 한다. 현재 정확한 집계를 위해 페이지 제한을 없앴지만 스트리밍 집계는 아니다.

## 확인 방법

1. 로그인하고 헤더의 프로젝트·제품 목록과 `/projects`를 확인한다.
2. `/market`, `/market/competitors`, 제품 상세와 `/library`에서 같은 제품 ID와 저장된 GEO 결과를 확인한다.
3. `/reviews`에서 제품을 열고 원문·분석·근거를 확인한다. 데이터가 없으면 빈 상태가 정상이다.
4. `/survey-results`에서 DB 응답 수와 추천 이벤트 수를 비교한다.
5. 홈 캘린더와 `/calendar`를 새로고침하여 저장된 행사만 표시되는지 확인한다.
6. `/ad-check`에서 전성분이 있는 DB 제품을 선택한다. 새 마이그레이션 적용 후 이력과 관리자 승인 저장을 확인한다. 미적용 시 저장 실패를 안내한다.
7. 시안 · 결재 · AI 분석: `/settings`에서 담당 탭을 주고, 리뷰 리포트(`/reviews/<자사 제품>`)·광고 검토 상세 아래 패널에서 저장 → 제출, `/approvals`에서 승인·반려, 홈과 `/projects` 진행 표, `/ai-analysis` 실행을 차례로 본다. owner·member 두 계정으로 권한을 확인한다.

검사: `npm run typecheck`, `npm run lint`, `npm run build`, `node apps/web/scripts/data-link-check.mjs`.
로그인한 브라우저에서 권한별 조회 및 실제 화면 확인은 별도로 필요하다. 원격 DB 스키마/데이터는 변경하지 않았다.

광고 저장용 SQL 초안 두 개는 커밋하지 않고 CLI로 생성한 `20261024172221_harden_ad_review_writes.sql`에 테이블 생성과 권한 보완을 통합했다. 기존 적용 마이그레이션은 변경하지 않았다. 이 파일은 머지 후 관리자가 적용해야 한다.
사용자가 실행한 own_sample_reviews.sql의 샘플 리뷰 220건(Deep Skin 120, Core Essence 100)을 읽기 조회로 확인했다.

## 리뷰 PR 통합 (2026-10-25)

#64의 소구점 계산과 분석 누락 안내를 공통 조회에 통합했다. 경쟁 제품은 실제 연결과 유효한 순위가 있는 것만 사용하며, 국내 자사 리뷰와 일본어 3점 이하 경쟁 리뷰를 비교한다. 제외 리뷰는 집계하지 않고, 스키마가 맞지 않는 분석만 미분석으로 처리한다. DB 조회 실패는 오류로 유지한다. source_raw.rank와 qoo10_rank를 모두 지원한다.

## 시안 · 결재 · AI 분석 (2026-10-26)

설계: [team-approval-ai-analysis.md](team-approval-ai-analysis.md) 7장 1~4단계. 마이그레이션 `20261025115007_team_approval.sql`.

- 읽기는 `lib/data/submissions.ts`, 쓰기는 Server Action(`submission-actions` · `ai-analysis-actions` · `member-tab-actions`)이다. 상태 바꾸기(제출·취소·승인/반려·숨김·팀장 확인)는 DB 함수(rpc)로만 한다.
- 시안의 내용(`body`)은 화면이 보낸 값을 믿지 않고 저장하는 순간 서버가 다시 만든다 (`lib/data/submission-bodies.ts`). 리뷰는 리포트와 같은 국내(ko) 리뷰, 광고는 숨기지 않은 검토 건만.
- 광고 검토 시안을 승인·반려하면 근거 `ad_checks`의 `review_status`도 같은 결정으로 바뀐다 (`decide_version`).
- 마이그레이션 적용 전 연결 환경: 목록은 비어 있고, 저장은 "시안 · 결재 테이블이 아직 DB에 적용되지 않았어요"로 실패한다. 샘플 모드는 `lib/mock/submissions.ts`를 보여 주고 저장 버튼은 막는다.
- 통합 AI 분석은 `OPENAI_API_KEY`(또는 `AI_PROVIDER`에 맞는 키)가 있어야 실행된다.
