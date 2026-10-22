# Leafn

일본 진출을 준비하는 K-뷰티 중소기업 해외마케팅팀이 시장 조사, 리뷰 분석, 약기법 광고 검토, 프로모션 일정을 한곳에서 AI로 처리하는 팀 업무용 웹서비스.

- 개발 기준 문서: [CLAUDE.md](CLAUDE.md)
- 기술 스택 분석: [docs/TECH_STACK.md](docs/TECH_STACK.md)
- 프로토타입(화면 뼈대) 계획: [docs/prototype-plan.md](docs/prototype-plan.md)

## 업무별 디렉터리

화면은 `apps/web/app/(internal)/(dashboard)/` 아래에 있다 (아래 표에서는 `(dashboard)/`로 줄임).

| 업무 | 화면 | 관련 코드 |
| --- | --- | --- |
| 총괄 (홈 · 자료실 · 설정) | `(dashboard)/`, `library/`, `settings/`, `(internal)/(auth)/` | `components/layout/`, `lib/supabase/`, `supabase/migrations/` |
| 시장 분석 (TAB 1) | `market/trends`, `ingredients`, `geo`, `competitors` | `collectors/sources/` (라쿠텐) |
| 리뷰 분석 (TAB 2) | `reviews/`, `reviews/import`, `reviews/compare` | `collectors/`, `lib/ai/` |
| 광고 검토 + 리뷰 번역 (TAB 3) | `ad-check/`, `ad-check/history`, `reviews/[productId]/translate` | `prompts/`, `knowledge/yakkiho/` |
| 진출 실행 | `platforms/`, `calendar/` | |
| 소비자 설문 | `survey-results/`, 공개 설문 `apps/web/app/(public)/survey/` | |

```
apps/web/        Next.js (App Router, TypeScript)
  app/           화면 (internal: 사내 대시보드, public: 일본어 공개 설문), api/
  components/    ui/ layout/ common/ templates/
  lib/           ai/ schemas/ supabase/ mock/ data/
  prompts/       프롬프트 원문 (버전 관리)
collectors/      Python 수집기 (sources/, nlp/)
supabase/        migrations/ (테이블 · RLS SQL)
knowledge/       yakkiho/ (약기법 기준 자료)
docs/            기획 · 기술 문서
.github/         workflows/ (수집기 cron)
```

빈 디렉터리는 `.gitkeep`으로 자리만 잡아 두었다.

## 브랜치

```
Leafn_main   기본 브랜치, 배포 기준
└─ sub_main  통합 브랜치, 개인 브랜치의 PR이 여기로 모인다
   └─ <이름>  개인 작업 브랜치 (각자 이름, 예: minseo)
```

개인 브랜치는 각자 이름으로 `sub_main`에서 따고 `sub_main`으로 PR을 보낸다. `sub_main`이 안정되면 `Leafn_main`으로 PR을 보낸다. 자세한 약속은 [docs/CODING_RULES.md](docs/CODING_RULES.md).

| # | 직무 | 업무 | 맡은 탭 (페이즈) |
| --- | --- | --- | --- |
| 1 | 해외사업팀장 | 총괄 | 홈 · 자료실 · 설정 (P8) |
| 2 | 브랜드·시장 전략 | 조사 | 시장 분석 TAB 1 (P3) |
| 3 | 고객 인사이트 | 분석 | 리뷰 분석 TAB 2 (P4) |
| 4 | 콘텐츠·현지화 | 검수 | 광고 검토 TAB 3 + 리뷰 번역 (P2 · P5) |
| 5 | 이커머스·프로모션 | 실행 | 진출 실행 (P6) |
| 6 | 인플루언서·SNS | 소통 | 소비자 설문 (P7) | #주현
