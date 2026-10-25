# Leafn

일본 진출을 준비하는 K-뷰티 중소기업 해외마케팅팀이 시장 조사, 리뷰 분석, 약기법 광고 검토, 프로모션 일정을 한곳에서 AI로 처리하는 팀 업무용 웹서비스.

- 개발 기준 문서: [CLAUDE.md](CLAUDE.md)
- 협업·Git 규칙: [docs/CODING_RULES.md](docs/CODING_RULES.md)
- DB 작업 규칙: [docs/DB_RULES.md](docs/DB_RULES.md) · 현재 DB 지도: [docs/db-frame.md](docs/db-frame.md) · 화면별 실데이터 연결: [docs/DATA_CONNECTIONS.md](docs/DATA_CONNECTIONS.md)
- Supabase 연동 방법(팀원용): [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)
- 자사 제품(Leaf& Dew 6종): [docs/Product.md](docs/Product.md)
- 다음 작업 설계 (탭별 시안 · 팀장 결재 · AI 분석): [docs/team-approval-ai-analysis.md](docs/team-approval-ai-analysis.md)
- 기술 스택 분석 원문 (근거·비유 포함, 2026-10-21 기준): [기술 스택 분석 문서](https://claude.ai/artifact/MA3A2F3vJ7c7u2wNiveKxj)
- 2026-10-25 정리 전 문서는 `docs/archive/pre_*.md`에 기록용으로 남겼다 (따르지 않는다)

## 업무별 디렉터리

화면은 `apps/web/app/(internal)/(dashboard)/` 아래에 있다 (아래 표에서는 `(dashboard)/`로 줄임). 화면 헤더는 워크스페이스(팀) → 프로젝트(제품군 Leaf& Dew) → 제품 순서이고, 데모 데이터는 Qoo10만 쓴다.

| 업무 | 화면 | 관련 코드 |
| --- | --- | --- |
| 총괄 (홈 · 프로젝트 · 자료실 · 설정) | `(dashboard)/`(홈 + 프로모션 캘린더), `calendar/`(캘린더 전체보기), `projects/`, `library/`, `settings/`, `(internal)/(auth)/` | `components/layout/`, `lib/supabase/`, `lib/own-products.ts`, `supabase/migrations/`, `supabase/seeds/` |
| 시장 분석 (TAB 1) | `market/` (탭: 요약 · 우리 제품 대응 · 시장 개관 · 플랫폼 분석 · 소비자 트렌드 · 경쟁제품), `market/competitors` | `lib/ai/geo/`, `lib/ai/sns/`, `app/api/geo`, `app/api/trends` |
| 리뷰 분석 (TAB 2) | `reviews/`, `reviews/import`, `reviews/compare`, `reviews/[productId]` | `collectors/` (Qoo10), `lib/ai/review-analysis/` |
| 광고 검토 + 리뷰 번역 (TAB 3) | `ad-check/`, `ad-check/history`, `ad-check/guide`, `reviews/[productId]/translate` | `prompts/`, `knowledge/yakkiho/`, `knowledge/content-guide/`, `lib/ai/ad-check/` |
| 소비자 설문 | `survey-results/`, 공개 설문 `apps/web/app/(public)/survey/` | |
| (다음) 결재 · AI 분석 | `approvals/`, `ai-analysis/` (설계만) | `docs/team-approval-ai-analysis.md`, `prompts/integrated-analysis.v1.md` |

"진출 실행" 탭(플랫폼별 강점 · 캘린더)은 2026-10-24에 없앴고, 캘린더는 홈으로 옮겼다.

```
apps/web/        Next.js (App Router, TypeScript)
  app/           화면 (internal: 사내 대시보드, public: 일본어 공개 설문), api/
  components/    ui/ layout/ common/ templates/
  lib/           ai/ schemas/ supabase/ mock/ data/
  prompts/       프롬프트 원문 (버전 관리)
collectors/      Python 수집기 (sources/qoo10.py, collect_to_db.py)
supabase/        migrations/ (테이블 · RLS SQL), seeds/ (시작 데이터, 관리자가 실행)
knowledge/       yakkiho/ (약기법 기준 자료), content-guide/
docs/            기술 · DB · 기능 문서, archive/ (pre_ 보관본)
.github/         workflows/ci.yml (PR 검사)
```

AI 코딩 도구용 입구: `CLAUDE.md`(Claude Code), `AGENTS.md`(Codex·Gemini CLI 등), `.cursor/rules/leafn.mdc`(Cursor). 뒤의 둘은 CLAUDE.md를 가리키기만 한다.

```bash
npm run setup      # apps/web 의존성 설치
npm run dev        # 개발 서버
npm run typecheck && npm run lint && npm run build   # PR 전에 확인 (CI도 같은 검사)
```

## 브랜치

```
Leafn_main   배포 브랜치 (Vercel이 여기서 배포한다)
└─ sub_main  통합 브랜치이자 GitHub 기본 브랜치. 개인 브랜치의 PR이 여기로 모인다
   └─ <이름>  개인 작업 브랜치 (각자 이름, 예: minseo)
```

개인 브랜치는 각자 이름으로 `sub_main`에서 따고 `sub_main`으로 PR을 보낸다 (GitHub 기본 브랜치가 `sub_main`이라 PR 대상도 자동으로 `sub_main`). `sub_main` → `Leafn_main` 반영은 총괄이 모아서 한다 (Vercel Hobby의 하루 빌드 수 한도 때문). 브랜치 운영은 유동적이라 문서·급한 수정은 `sub_main`에 직접 올려도 된다. 자세한 약속은 [docs/CODING_RULES.md](docs/CODING_RULES.md).

| # | 직무 | 업무 | 맡은 탭 |
| --- | --- | --- | --- |
| 1 | 해외사업팀장 (Min, `@miamobann`) | 총괄 | 홈(캘린더 포함) · 프로젝트·제품 · 자료실 · 설정 |
| 2 | 브랜드·시장 전략 | 조사 | 시장 분석 TAB 1 |
| 3 | 고객 인사이트 | 분석 | 리뷰 분석 TAB 2 |
| 4 | 콘텐츠·현지화 | 검수 | 광고 검토 TAB 3 + 리뷰 번역 |
| 5 | 이커머스·프로모션 | 실행 | 프로모션 캘린더 (홈, 총괄과 함께) |
| 6 | 인플루언서·SNS | 소통 | 소비자 설문 |
