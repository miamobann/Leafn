# K-뷰티 일본 진출 지원 서비스 — 개발 레퍼런스

> 팀 코딩용 기준 문서입니다. 근거와 비유를 포함한 전체 분석은 [기술 스택 분석 문서](https://claude.ai/artifact/MA3A2F3vJ7c7u2wNiveKxj)를 보세요 (2026-10-21 기준이라 지금 구조와 다른 곳이 있습니다).
> 기준: 기획안 v1 · 처음 작성 2026-10-21 · 갱신 2026-10-25 · 상태: **실데이터 연결 단계** (프로토타입 화면 뼈대는 끝났다)
> DB 작업 규칙: `docs/DB_RULES.md` · 현재 DB 지도: `docs/db-frame.md`

**한 줄 정의:** 일본 진출을 준비하는 K-뷰티 중소기업 해외마케팅팀이 시장 조사, 리뷰 분석, 약기법 광고 검토, 프로모션 일정을 한곳에서 AI로 처리하는 팀 업무용 웹서비스.

**원칙:** 도구를 먼저 고르지 않는다. 문제 → 기능 → 그 기능에 맞는 언어·도구 순서로 결정하고, 새 기술은 필요해진 시점에 추가한다.

**사용법 (바이브 코딩):** 이 파일을 저장소 루트에 두고 AI 코딩 도구가 매번 읽게 한다. Claude Code는 `CLAUDE.md`, Cursor는 `.cursor/rules/`, 그 밖의 도구는 `AGENTS.md`로 복사하거나 그 파일에서 이 파일을 참조한다 (저장소에 `AGENTS.md`와 `.cursor/rules/leafn.mdc`가 이 파일을 가리키도록 들어 있다). 작업을 시킬 때는 13장의 프롬프트를 복사해 쓴다.

**지금 구조 한눈에 (2026-10-25):**
- 화면 헤더는 **워크스페이스(팀) → 프로젝트(제품군, 예: Leaf& Dew) → 제품**이다. 한 프로젝트의 제품은 제품별 탭 없이 한 화면에서 다룬다.
- 메뉴: 홈(프로모션 캘린더 포함) · 시장 분석 · 리뷰 분석 · 광고 검토 · 소비자 설문 · 자료실 · 설정. "진출 실행" 탭은 없앴다 (2026-10-24).
- **데모 데이터는 Qoo10만** 쓴다. 다른 플랫폼은 확장용으로 slug와 칸만 남긴다.
- 자사 제품은 Leaf& Dew 6종이다 (`docs/Product.md`). 판매 중 2종, 개발 중 4종.

**문서 지도와 우선순위:** 문서끼리 다르면 번호가 앞선 문서를 따르고, 뒤의 문서를 고친다.

1. `CLAUDE.md` (이 파일): 기술 판단의 기준
2. `docs/CODING_RULES.md` (협업·Git·코드 스타일), `docs/DB_RULES.md` (DB 작업 절차)
3. `docs/db-frame.md`: 현재 DB 지도 (실제 마이그레이션 기준 테이블·칸 정의)
4. 기능별 문서: `docs/Product.md` (자사 제품명·규격), `docs/DATA_CONNECTIONS.md` (화면별 실데이터 연결 상태), `docs/tab3-db-plan.md` (광고 검토 DB), `docs/team-approval-ai-analysis.md` (탭별 시안·팀장 결재·AI 분석 설계)

`docs/archive/pre_*.md`는 2026-10-25 정리 전 문서의 기록용 보관본이라 따르지 않는다. `docs/TECH_STACK.md`·`docs/prototype-plan.md`는 보관본을 가리키는 안내만 남은 파일이다.

---

## 0. AI 코딩 도구에게 (작업 전에 반드시 지킬 것)

**범위**
- 한 번에 하나의 작업만 한다. 요청받지 않은 기능, 파일, 리팩터링을 추가하지 않는다.
- 2장에 없는 라이브러리·서비스를 추가해야 하면 **먼저 이유를 말하고 확인을 받는다.**
- 확장 단계 기술(작업 큐, pgvector, FastAPI 등)은 요청이 있을 때만 도입한다.

**구조**
- 파일 위치는 4장 저장소 구조를 따른다.
- DB 변경은 반드시 `supabase/migrations/`에 새 SQL 파일로 만든다. 기존 마이그레이션을 고치지 않는다.
- DB·`lib/schemas`·`lib/mock`·`lib/data`·`collectors/`를 건드리는 작업은 시작 전에 `docs/DB_RULES.md`를 읽고, 그 문서의 PR 체크리스트를 PR 본문에 붙인다.
- 새 테이블에는 `workspace_id`와 RLS 정책을 함께 만든다 (예외 없음. 5장 참고).
- AI 호출은 `lib/ai/`에서만, 프롬프트 원문은 `prompts/`에만 둔다. 컴포넌트나 Route Handler에 프롬프트 문자열을 직접 쓰지 않는다. 제공사(OpenAI·Anthropic)는 2장 규칙대로 `lib/ai/` 안에서만 고른다.
- AI 응답과 API 입력은 `lib/schemas/`의 Zod 스키마로 검증한다.
- 화면은 `lib/data/`의 함수만 부른다. Supabase 환경 변수가 없을 때만 샘플(`lib/mock/`) 모드로 동작하고, 연결된 환경에서 조회가 실패하면 샘플로 숨기지 않고 오류를 보여준다 (`docs/DATA_CONNECTIONS.md`).
- 자사 제품명은 `lib/own-products.ts`, 규격은 `lib/own-product-specs.ts` 상수만 쓴다. 이름을 새로 지어 적지 않는다.

**보안**
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RAKUTEN_APPLICATION_ID`, `SERPAPI_API_KEY`, `APIFY_TOKEN`은 서버 코드에서만 쓴다. `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
- 키, `.env` 파일, 실제 리뷰 원문 대량 데이터를 커밋하지 않는다.

**Git** (자세한 약속은 `docs/CODING_RULES.md` 1~3장)
- 커밋과 push는 사용자가 요청할 때만 한다. 기본 대상은 사용자의 개인 브랜치다.
- `Leafn_main`에는 push하지 않는다. `sub_main`에 직접 push하라는 요청이면 한 번 확인한 뒤 한다.
- 작업을 시작하기 전에 `sub_main`의 최신 내용을 받아 온다.
- 커밋 메시지는 CODING_RULES 2장 형식(`<타입>(<범위>): <요약>`)을 따른다.

**코드 스타일**
- TypeScript strict 모드. `any` 금지, 불가피하면 이유를 주석으로.
- UI는 shadcn/ui 컴포넌트를 먼저 쓰고, 없을 때만 새로 만든다.
- 화면 문구는 한국어(대시보드), 일본어(설문 페이지 G)로 쓴다.
- 서버 함수 하나가 오래 걸리지 않게 리뷰 분석·번역은 묶음(기본 50건) 단위로 처리한다.

**완료 기준 (매 작업 끝에)**
- 타입 검사·린트·빌드가 통과한다 (`npm run typecheck`, `npm run lint`, `npm run build`).
- 바꾼 파일 목록과 직접 확인할 방법(어느 화면에서 무엇을 눌러 보면 되는지)을 요약한다.
- 결정이 필요한 부분이 있었다면 임의로 정하지 말고 11장 "열린 질문"에 추가할 항목으로 보고한다.

---

## 1. 기능 목록과 상태

우선순위는 **"이 웹서비스가 성립하려면 꼭 있어야 하는가"**로 정했다. 기획안 3개 탭의 "주요 서비스 기능"이 서비스의 정의이므로 핵심이고, 기획안 끝의 "특별히 신경 쓰고 싶은 기능" 목록은 참조용이다. 상태는 2026-10-25 sub_main 기준이다.

| 순서 | ID | 기능 | 메뉴 | 구분 | 상태 |
| --- | --- | --- | --- | --- | --- |
| 1 | J | 팀 워크스페이스 (로그인, 팀별 데이터 분리, 헤더의 워크스페이스 → 프로젝트 → 제품, 프로젝트·제품 관리) | 공통 | 기반 | 연결됨. `projects`·`products` DB, Leaf& Dew 6종 시드·규격 |
| 1 | K | 공통 대시보드 (홈의 탭 요약 카드·할 일·캘린더) | 홈 | 기반 | 연결됨. 홈의 샘플 8단계 현황판은 제품 × 탭 진행 표(L)로 바꿨다 (2026-10-26) |
| 2 | E | 리뷰 분석 (Qoo10 수집/CSV · 감성 · 키워드 · 페인포인트 · 재구매 요인 · 차트 · 원문 연결 · 소구점) | 리뷰 분석 | 핵심 | 연결됨. Qoo10 수집기, AI 분석, 일본어 → 한국어 번역(`reviews.body_ko`) |
| 3 | A | 약기법 광고 문구 검토 (입력 · 위험 표현 · 사유/근거 · 대체 표현 · 현지화 · 검토 이력 · 콘텐츠 제작 가이드) | 광고 검토 | 핵심 | 연결됨. 판정 자동 저장, 승인·반려는 owner만 |
| 4 | C | 경쟁제품 비교 (가격 · 용량 · 성분 · 특징) | 시장 분석 | 핵심 | 연결됨. Qoo10 수집으로 등록, `product_competitors`로 자사와 연결 |
| 5 | B | 시장 트렌드 (랭킹, 성분 관심도, 검색 자동완성) | 시장 분석 | 핵심 | 연결됨. Qoo10 랭킹 CSV, SerpApi. 화면이 라쿠텐 스냅샷도 함께 읽음 (확장용) |
| 참조 | D | 일본 현지 제품 리뷰 분석 | 리뷰 분석 | 참조 | E에 포함 (Qoo10 일본어 경쟁 리뷰) |
| 참조 | F | 한국 리뷰 → 일본어 번역 → 상세페이지용 블록 (A 검토를 거침) | 리뷰 분석 | 참조 | 번역은 광고 검토 AI가 하고 `review_translations`에 저장. 승인은 광고 검토 화면에서 owner가 |
| 참조 | - | GEO (AI 검색의 브랜드 언급 추적) | 시장 분석 | 참조 | 연결됨 (`/api/geo/run`, `geo_snapshots`) |
| 참조 | G | 피부타입 설문 (일본 소비자용 공개 모바일 웹) | 소비자 설문 | 참조 | 집계 화면은 DB를 읽음. 공개 설문 제출은 아직 보내지 않음 |
| 참조 | H | 플랫폼별 강점 정리 | - | 참조 | 화면 없앰 (2026-10-24). `platform_notes` 테이블만 남음 |
| 참조 | I | 메가와리/프로모션 캘린더 | 홈 | 참조 | 홈에 포함 (`/calendar`는 전체보기). 조회는 DB, 추가·마감 변경은 아직 저장하지 않음 |
| 다음 | L | 제품 × 탭 진행 표 (판매 중 제품 × 시장 분석·리뷰 분석·광고 검토·AI 분석) | 홈/프로젝트 | 핵심 | 구현, 원격 DB 적용 대기. 홈의 진행 표 카드(샘플 8단계 현황판을 대신함)와 `/projects` 진행 표 |
| 다음 | M | 탭별 시안 제출 · 버전 · 팀장 결재 | 각 탭 + 결재함 | 핵심 | 구현, 원격 DB 적용 대기. 리뷰 리포트 · 광고 검토 상세의 시안 패널, `/approvals`, 설정의 담당 탭 (`docs/team-approval-ai-analysis.md`) |
| 다음 | N | AI 분석 (탭별 승인본을 모아 통합 분석, 팀 공유) | AI 분석 | 핵심 | 구현, 원격 DB 적용 대기. `/ai-analysis`, 프롬프트 `integrated-analysis.v1` (설계는 7장) |

- **데모 범위 (2026-10-24·25 결정, 총괄):** Qoo10 데이터만 쓴다. L·M·N은 설계 문서 7장의 1~4단계까지 만든다.
- **개발 중 제품**(`sale_status = in_development`)은 진행 표·시안·AI 분석 대상에서 뺀다. 판매를 시작하면 들어온다.
- AI 코딩 도구는 참조 기능의 **테이블·API·수집기를 요청받기 전에 만들지 않는다.** 다만 나중에 붙을 수 있게 막지는 않는다 (예: 플랫폼 slug 칸 유지).

**이번 범위에서 제외:** 결제, 실시간 통신(동시 편집), 별도 관리자 시스템(Supabase 콘솔로 대체).

**구현 메모**
- D와 E는 같은 "리뷰 분석 파이프라인"을 쓴다. 언어(ja/ko)와 데이터 출처만 다르다.
- F를 만들 때는 번역 결과를 반드시 A의 검토를 통과시킨다. 판매자가 상세페이지에 게시한 리뷰는 광고로 취급될 수 있다. (정확한 범위는 전문가 확인 필요)
- GEO는 Generative Engine Optimization(AI 검색 최적화)으로 정했다.
- 팀장 결재(M)는 약기법 검토(A)를 대신하지 않는다. 위험 high 또는 전문가 검토 요청이 있는 광고 시안은 승인 전에 경고를 보여준다.

---

## 2. 기술 스택

### 지금 쓰는 것

| 영역 | 기술 | 용도 |
| --- | --- | --- |
| 언어 | TypeScript | 화면 + 서버 |
| 언어 | Python 3 | Qoo10 리뷰·랭킹 수집 (E, B) |
| 프레임워크 | Next.js (App Router) | 화면, Route Handler, Server Action을 한 프로젝트로 |
| UI | Tailwind CSS + shadcn/ui | 화면 부품 |
| 차트 | Recharts | 감성 비율, 키워드 빈도, 트렌드 추이 |
| 캘린더 | FullCalendar | 홈·`/calendar`의 프로모션 캘린더 (I) |
| CSV | Papa Parse | 리뷰·랭킹 CSV 파싱 |
| AI SDK | OpenAI SDK (`openai`, 기본) · Anthropic SDK (`@anthropic-ai/sdk`, 선택) | AI 호출. 둘 중 하나를 `AI_PROVIDER`로 고른다 |
| 검증 | Zod | AI 응답과 API 입력 검증 |
| DB/인증/파일 | Supabase (PostgreSQL, Auth, Storage, RLS) | 모든 데이터, 로그인, CSV/이미지 보관 |
| 수집 | Python 수집기 (`collectors/sources/qoo10.py`, `collect_to_db.py`) | Qoo10 랭킹·리뷰 수집 후 Supabase 저장 |
| 외부 API | SerpApi (Google 자동완성 · Google Trends) | 성분 관심도 "미래 트렌드" (B 확장). 2026-10-23 총괄 허용. SDK 없이 서버에서 `fetch` |
| 외부 API | Apify (TikTok Scraper, `clockworks/tiktok-scraper`) | SNS 영상 링크 → 캡션·해시태그·조회수·발화 자막 (B 확장, 소비자 트렌드 2-B). 2026-10-25 총괄 허용. SDK 없이 서버에서 `fetch`, 실행당 비용 상한 $0.50 |
| 배포 | Vercel (Hobby, 하루 빌드 수 한도) | 배포 브랜치는 `Leafn_main`. `sub_main` 머지는 모아서 반영한다 |
| CI | GitHub Actions (`.github/workflows/ci.yml`, 검사 이름 `web`) | PR마다 typecheck · lint · build |

### 확장용 (데모에서는 쓰지 않음)

| 기술 | 상태 |
| --- | --- |
| 라쿠텐 시장 API (상품 검색, 랭킹) | 데모는 Qoo10만 쓰기로 해서 연동하지 않았다. `RAKUTEN_APPLICATION_ID` 칸과 `trend_snapshots.source = rakuten_ranking` 값만 남아 있다 |
| 올리브영 등 국내 플랫폼 수집기 | 만들지 않았다. 자사 국내 리뷰는 시드(`supabase/seeds/own_sample_reviews.sql`)와 CSV로 넣는다 |
| GitHub Actions cron 수집 | 수집기는 지금 사람이 실행한다 (`--worker` 모드). 정기 실행이 필요해지면 `collect.yml`을 만든다 |
| SudachiPy | 일본어 리뷰 형태소 분석. 키워드는 지금 AI 분석으로 뽑는다 |

### AI 모델 사용 규칙

**제공사 (2026-10-23 결정, 총괄):** OpenAI 또는 Anthropic 중에서 고른다. 기본은 OpenAI다 (약기법 프롬프트 v4를 OpenAI로 시험함). 다른 제공사(Gemini 등)는 0장 규칙대로 먼저 합의한다.

작업은 모델 이름 대신 **등급**으로 부른다. 등급마다 제공사별 모델을 하나씩 정한다.

| 등급 | 작업 | OpenAI (기본) | Anthropic (선택) | 이유 |
| --- | --- | --- | --- | --- |
| 정밀 | 약기법 위험 판단, 대체 표현, 페인포인트 요약, 통합 AI 분석(N) | `gpt-4.1-mini` (v4 시험 모델) | Claude Sonnet 계열 (`claude-sonnet-5-5`) | 긴 규제 문서 이해, 미묘한 일본어 판단, 여러 근거 종합 |
| 대량 | 리뷰 감성 분류, 키워드, 번역, 상품 이미지에서 성분·용량 추출 | `gpt-4.1-mini` | Claude Haiku 계열 (`claude-haiku-5-5`) | 대량 반복 작업, 속도·비용 |

- 호출은 `lib/ai/`의 함수 하나로 모은다. 화면·Route Handler·Server Action은 등급(정밀·대량)만 넘기고, 어느 제공사를 쓸지는 모른다. 제공사는 환경 변수 `AI_PROVIDER`(`openai` · `anthropic`, 기본 `openai`)로 바꾼다.
- **표준 위치 (2026-10-23 결정, 총괄):** 설정은 `lib/ai/config.ts`(`resolveProvider`, `resolveModel`), 호출은 `lib/ai/client.ts`의 `callAi` 하나다. 다른 파일에서 `new OpenAI()`·`new Anthropic()`을 만들거나 config를 새로 만들지 않는다. 이미지 입력·구조화 출력·Anthropic 연결처럼 모자란 기능은 `callAi`를 넓히는 PR로 추가한다. 기능별 코드는 `lib/ai/<기능>/`(예: `lib/ai/ad-check/`, `lib/ai/review-analysis/`)에 둔다.
- 모델 ID는 `lib/ai/` 안의 설정 파일 한곳에서 관리한다. 바꾸고 싶으면 `AI_MODEL_PRECISE`, `AI_MODEL_BULK`로 덮어쓴다. 시작 시점의 최신 버전으로 갱신.
- 제공사·모델을 바꾸면 결과가 달라질 수 있으므로, AI 결과 행의 `model`에는 실제로 부른 모델 ID를 그대로 남긴다 (5장 규칙).

### 확장 단계 (필요해지면 추가)

| 기술 | 추가하는 신호 |
| --- | --- |
| 백그라운드 작업 큐 (Inngest, Trigger.dev) | 리뷰 수천 건 분석이 서버 함수 실행 시간 제한에 걸릴 때 |
| pgvector + 임베딩 모델 (RAG) | 약기법 사례·검토 이력이 프롬프트에 다 안 들어갈 때 |
| 전용 수집 서버 (FastAPI + Cloud Run), 프록시 | 수집 대상이 수십 개로 늘 때 |
| 다국어 UI (i18n) | 일본 현지 파트너도 쓸 때 |
| Sentry, 사용 분석 | 외부 사용자가 생길 때 |
| Stripe | 외부 고객사에 판매할 때 |
| AWS 직접 구성 | 관리형 서비스의 비용·제약이 문제가 될 때 |

---

## 3. 시스템 구조

```
  [해외마케팅팀 PC]          [일본 소비자 스마트폰] (참조 G)
          ↓                          ↓
  사내 대시보드 (로그인)       피부타입 설문 (공개)
          └────────────┬─────────────┘
                       ↓
      Frontend: Next.js 화면 (Vercel)
                       ↓
      Backend: Next.js Route Handler · Server Action (Vercel)
         │  인증 확인 · 입력 검증(Zod) · SerpApi 호출
                       ↓
      AI: OpenAI API (기본) 또는 Anthropic API  (lib/ai/callAi)
         │  약기법 검토 · 리뷰 분석 · 번역 · GEO 측정 · SNS 핵심 니즈 · 통합 AI 분석
         │  (약기법 기준 문서는 프롬프트에 포함)
                       ↓
      Database: Supabase PostgreSQL + Storage  ←──────┐
                                                      │
              Python 수집기 (사람이 실행, --worker 모드)
                       ↑
      External: Qoo10 (랭킹·리뷰) · Google 자동완성·Trends (SerpApi) · TikTok 영상 정보 (Apify) · AI 검색 응답(GEO)
                (확장용: 라쿠텐 · @cosme · 국내 플랫폼)
```

- 웹 앱과 수집기는 직접 통신하지 않는다. **DB가 유일한 접점**이다 (수집 요청도 `collection_runs` 행으로 주고받는다).
- 수집이 멈춰도 이미 쌓인 데이터로 웹 기능은 계속 동작해야 한다.

---

## 4. 저장소 구조

```
/
├─ apps/web/                     # Next.js (TypeScript)
│  ├─ app/
│  │  ├─ (internal)/             # 사내용 root layout (<html lang="ko">)
│  │  │  ├─ (auth)/              # login/, signup/, onboarding/
│  │  │  └─ (dashboard)/         # 로그인 필요: (홈 page.tsx + _home/), projects/, market/, reviews/, ad-check/,
│  │  │                          #   calendar/(홈 캘린더 전체보기), survey-results/, library/, settings/
│  │  │                          #   approvals/(결재함·버전 미리보기), ai-analysis/
│  │  ├─ (public)/               # 공개용 root layout (<html lang="ja">)
│  │  │  └─ survey/              # (G) 피부타입 설문, 로그인 불필요. shop/ 은 시연용 Qoo10 상세페이지
│  │  └─ api/                    # Route Handler (6장)
│  ├─ components/                # shadcn/ui 기반 공통 컴포넌트 (ui/, layout/, common/, templates/)
│  │                             #   layout/nav-config.ts = 메뉴의 단일 출처
│  ├─ lib/
│  │  ├─ ai/                     # config.ts(제공사·모델), client.ts(callAi), prompts.ts(loadPrompt), <기능>/
│  │  ├─ schemas/                # Zod 스키마 (데이터 모양, AI 응답, API 입력)
│  │  ├─ supabase/               # 브라우저/서버용 클라이언트
│  │  ├─ mock/                   # 샘플 데이터 (Supabase 환경 변수가 없을 때만). 불러올 때 Zod로 검증
│  │  ├─ data/                   # 화면이 부르는 읽기 함수와 *-actions.ts(Server Action 쓰기)
│  │  ├─ own-products.ts         # 자사 제품명 상수 (docs/Product.md)
│  │  └─ own-product-specs.ts    # 자사 제품 규격 (제품규격서 기준)
│  ├─ prompts/                   # 프롬프트 원문 (버전 관리, 7장)
│  └─ scripts/                   # data-link-check.mjs 등 점검 스크립트
├─ collectors/                   # Python 수집기
│  ├─ sources/qoo10.py           # Qoo10 랭킹·리뷰 (사이트 하나 = 파일 하나)
│  ├─ collect_to_db.py           # 수집 요청(collection_runs)을 받아 실행·저장 (--worker)
│  ├─ nlp/                       # (참조 D) 형태소 분석 자리
│  ├─ db.py                      # Supabase upsert
│  └─ requirements.txt
├─ supabase/
│  ├─ migrations/                # 테이블, RLS 정책 SQL (새 파일만 추가)
│  └─ seeds/                     # 시작 데이터 SQL (DB 관리자가 SQL Editor에서 실행)
├─ knowledge/
│  ├─ yakkiho/                   # 약기법 기준 자료
│  └─ content-guide/             # 콘텐츠 제작 가이드 규칙
├─ docs/                         # 기술·DB·기능 문서, archive/ (기록용 보관본)
└─ .github/workflows/
   └─ ci.yml                     # PR 검사 (typecheck · lint · build)
```

---

## 5. DB 테이블 목록

> 칸 정의의 기준은 **`docs/db-frame.md`(현재 DB 지도)**다. 이 장에는 테이블 이름과 역할만 둔다. 칸·테이블·행을 추가하는 절차는 `docs/DB_RULES.md`를 따른다.

모든 업무 테이블은 `workspace_id`를 갖고, RLS로 **자기 워크스페이스 행만** 읽고 쓰게 한다 (`is_member(workspace_id)`, 일부 쓰기는 `is_owner`). 공용 테이블은 지금 없다. 공통 칸: `id uuid pk`, `created_at timestamptz` (수정되는 테이블은 `updated_at`).

| 묶음 | 테이블 | 역할 | 기능 |
| --- | --- | --- | --- |
| 기반 | `profiles`, `workspaces`, `workspace_members` | 사용자, 팀, 팀 멤버 (role `owner` = 팀장 / `member`) | J |
| 프로젝트·제품 | `projects` | 프로젝트 = 제품군 (예: Leaf& Dew) | J |
| | `products` | 자사·경쟁 제품 (`kind`). 자사는 `project_id` · `sale_status` · `skin_line`, 규격은 `source_raw.spec` | J, E, C |
| | `product_competitors` | 자사 제품 ↔ 경쟁 제품 연결 | C, E |
| 리뷰 | `reviews` | 리뷰 원문 (`lang` ja/ko, `body_ko` 번역, `excluded_reason`) | E, D |
| | `review_analyses` | 리뷰 한 건의 AI 분석 (감성·키워드·페인포인트·재구매 요인·주제) | E |
| 수집 | `collection_runs`, `collection_run_products`, `collection_staged_reviews`, `collection_run_skipped` | 화면에서 낸 수집 요청과 수집기의 진행·임시 결과 | E |
| 광고 검토 | `ad_checks`, `ad_check_lines`, `content_guides` | 판정 한 건, 줄별 판정, 콘텐츠 제작 가이드 결과물 | A |
| | `review_translations` | 상세페이지용 리뷰의 일본어 번역과 그 번역을 통과시킨 약기법 검토(`ad_check_id`) | F |
| 시장 | `trend_snapshots`, `search_snapshots`, `geo_snapshots` | 랭킹(Qoo10·라쿠텐), 검색 자동완성·Trends, AI 검색 응답 | B, GEO |
| 캘린더 | `promo_events`, `promo_milestones`, `platform_notes` | 행사·캠페인, 준비 마감, 플랫폼 메모(화면 없음) | I, H |
| 설문 | `surveys`, `survey_responses`, `survey_minor_counts`, `survey_reco_events` | 설문 정의, 응답, 미성년 참여 수, 추천 노출·클릭 | G |
| 시안·결재 | `member_tabs` | 멤버별 담당 탭 (owner는 모든 탭, `has_tab()`) | M |
| | `tab_submissions`, `submission_versions`, `submission_reviews` | 제품 × 탭 시안, 버전 히스토리, 팀장 결재 기록. 상태 바꾸기는 DB 함수로만 | M, L |
| | `ai_analyses` | 탭별 승인본을 모아 돌린 AI 분석 (팀 공유, 팀장 확인 라벨) | N |

**아직 없는 테이블:** `review_insights`(리뷰 분석에서 계산해서 씀), `activity_log`, `platforms`(slug 기준표).

규칙
- 분석 결과에는 항상 **근거 리뷰 ID**(통합 AI 분석은 **근거 버전 ID**)를 남긴다.
- AI 결과 행에는 `model`, `prompt_version`을 저장해 결과가 바뀐 이유를 추적한다.
- 모양이 일정하지 않은 원본 데이터는 `raw`·`source_raw jsonb`에 그대로 둔다. NoSQL은 쓰지 않는다.

---

## 6. API 라우트와 서버 함수

**Route Handler (`app/api/`)**

| 메서드 · 경로 | 하는 일 | 모델 |
| --- | --- | --- |
| `POST /api/ad-check` | 문구 → 위험 표현, 사유, 대체 표현 (JSON) → `ad_checks`·`ad_check_lines` 자동 저장 | 정밀 |
| `PATCH /api/ad-check/[checkId]` | 담당자 승인·반려 저장 (owner만, RLS와 서버 양쪽에서 확인) | - |
| `POST /api/content-guide` | 콘텐츠 제작 가이드(제목·본문) 생성 + 금지 표현 검사(`lint_hits`) → `content_guides` 저장 | 정밀·대량 |
| `POST /api/geo/run` | AI 검색 응답 측정 → `geo_snapshots` | 측정 엔진은 `GEO_MODEL_*`, 키워드 추출은 대량 |
| `POST /api/market/sns-trends` | TikTok 영상 링크 → Apify로 캡션·해시태그·발화 자막 → 소비자 핵심 니즈 순위 (저장하지 않음) | 대량 |
| `POST /api/trends/autocomplete`, `POST /api/trends/search-interest` | SerpApi Google 자동완성·Trends (키는 서버에만) → `search_snapshots` | - |

**Server Action (`lib/data/*-actions.ts`)**: 리뷰 CSV 저장(`review-import-actions`), 리뷰 묶음 분석·번역(`review-analysis-actions`), 수집 요청(`collection-actions`), 캘린더 쓰기(`launch-actions`, 아직 저장하지 않음), 프로젝트·제품 관리(`projects`), 시안 저장·제출·결재·AI 분석 팀장 확인(`submission-actions`), 통합 AI 분석 실행(`ai-analysis-actions`), 설정의 담당 탭(`member-tab-actions`).

**아직 없는 것:** 상품 정보 추출(`/api/products/extract`), 공개 설문 제출 저장, 리뷰 번역 저장(F). 결재·AI 분석은 Route Handler 없이 Server Action과 DB 함수(rpc: `submit_version`·`decide_version` 등)로 한다.

- 대량 분석은 서버 함수 실행 시간 제한을 넘지 않도록 **묶음 단위로 나눠** 호출한다. 한계에 닿으면 작업 큐 도입 (2장 확장).

---

## 7. AI 호출 규칙

1. **출력은 항상 JSON 스키마로 고정**하고, 받은 뒤 Zod로 검증한다. 검증 실패 시 1회 재시도 후 에러 표시.
2. **프롬프트는 `prompts/<이름>.v<N>.md` 파일로** 두고 `lib/ai/prompts.ts`의 `loadPrompt(이름, 버전)`으로 읽는다. 코드에 문자열로 흩어 두지 않는다. 파일 머리말(`---` 앞)은 사람이 읽는 설명이고, 본문만 AI에게 보낸다.
3. **프롬프트를 고칠 때는 새 버전 파일**(`v2`)을 만들고, 쓰는 버전 번호는 `lib/ai/<기능>/` 안의 상수 한곳에서 바꾼다. 결과 행의 `prompt_version`으로 어느 버전의 결과인지 남는다.
4. **예시(Few-shot)와 판단 단계**를 프롬프트에 넣는다. 예: "1) 효능 범위 56항목 안인지 2) 의약품적 표현인지 3) 최상급·보증 표현인지 → 판정".
5. **약기법 기준 자료는 프롬프트에 통째로** 넣는다 (`knowledge/yakkiho/`). Vector DB는 자료가 커지면 도입.
6. **결과를 파일로 저장하지 않는다.** 캐시가 필요하면 DB(또는 Supabase Storage)에 둔다. Vercel 서버는 홈 폴더 등 디스크에 쓸 수 없다.
7. 약기법 결과 화면에는 "법률 자문이 아닌 검토 보조 결과이며 최종 판단은 담당자·전문가가 한다"는 문구를 표시한다. 통합 AI 분석 결과에는 "AI 결과 · 팀장 확인 전" 라벨을 붙인다.

**통합 AI 분석(N) 프롬프트 — 나중에 고칠 수 있게 설계 (2026-10-25 총괄 요청)**
- 원문: `prompts/integrated-analysis.v1.md`. 코드와 맞춰야 하는 곳(입력 형식·출력 형식)과 팀이 자유롭게 고치는 곳(역할·분석 관점·말투·금지 사항)을 파일 안에서 나눠 둔다.
- **분석 관점 목록은 프롬프트 안의 데이터다.** 출력은 관점마다 `{key, title, points[]}` 한 칸이 되는 일반 모양이라, 관점을 더하거나 빼거나 이름을 바꿔도 Zod 스키마와 화면 코드를 고치지 않는다.
- 쓰는 버전은 `lib/ai/integrated-analysis/`의 상수 하나로 고른다. 새 버전은 이전 결과를 지우지 않고, 같은 입력으로 v1·v2를 다시 돌려 비교할 수 있다.
- 자세한 규칙: `docs/team-approval-ai-analysis.md` 10장.

약기법 검토 응답 예시 (요약)

```json
{
  "overall_risk": "high",
  "findings": [
    {
      "text": "シミが消える",
      "risk": "high",
      "reason": "화장품 효능 범위를 넘어 의약품적 효과를 암시",
      "basis": "化粧品の効能の範囲 / 適正広告ガイドライン",
      "suggestions": ["メイクアップ効果によりシミを隠す", "肌にうるおいを与える"]
    }
  ],
  "localized_note": "일본 소비자에게 자연스러운 표현으로 다듬은 이유"
}
```

실제 모양은 `lib/schemas/ad-check.ts`와 `prompts/ad-check.v6.md`, 리뷰 분석은 `lib/schemas/review.ts`와 `prompts/review-analysis.v1.md`가 기준이다.

---

## 8. 데이터 수집 규칙

- **공식 API 우선.** 크롤링은 API가 없는 곳에만. 데모는 Qoo10만 수집한다.
- 크롤링 전 각 사이트의 이용약관과 robots.txt를 확인하고, 요청 간격을 두며 필요한 범위만 수집한다.
- 저장은 `(workspace_id, source, external_id)` 기준 upsert로 중복을 막는다. 수집기는 service role 키로 RLS를 우회하므로 `workspace_id`를 코드에서 반드시 채운다 (`docs/DB_RULES.md` 4장).
- 원본은 `raw jsonb`에 보관해 파서가 바뀌어도 다시 가공할 수 있게 한다.
- 사이트 구조 변경으로 깨지는 것을 전제로 소스별 파일을 분리한다. 실패는 `collection_runs.status`·`error`로 화면에 보인다.

---

## 9. 환경 변수

| 이름 | 사용처 | 비고 |
| --- | --- | --- |
| `AI_PROVIDER` | web 서버 | `openai`(기본) 또는 `anthropic` |
| `OPENAI_API_KEY` | web 서버 | 브라우저 노출 금지. `AI_PROVIDER=openai`일 때 필요 |
| `ANTHROPIC_API_KEY` | web 서버 | 브라우저 노출 금지. `AI_PROVIDER=anthropic`일 때 필요 |
| `AI_MODEL_PRECISE`, `AI_MODEL_BULK` | web 서버 | 선택. 비우면 `lib/ai/` 설정 파일의 기본 모델 |
| `NEXT_PUBLIC_SUPABASE_URL` | web | 공개 가능 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | 공개 가능 (RLS가 보호) |
| `SUPABASE_SERVICE_ROLE_KEY` | collectors, 서버 전용 작업 | RLS 우회 키. 절대 브라우저/커밋 금지 |
| `RAKUTEN_APPLICATION_ID` | (확장용) | 데모에서는 쓰지 않는다. 라쿠텐을 연동할 때 서버 전용으로 |
| `SERPAPI_API_KEY` | web 서버 | 브라우저 노출 금지. 유료 호출이라 수집 버튼·예약 실행에서만 부른다 |
| `APIFY_TOKEN` | web 서버 | 브라우저 노출 금지. 유료 호출이라 SNS [분석 시작] 버튼에서만 부른다 |
| `GEO_MODEL_CHATGPT`, `GEO_MODEL_CLAUDE`, `GEO_REPEAT_COUNT` | web 서버 | 선택. GEO가 측정하는 엔진의 모델과 반복 횟수(1~3). 키는 `OPENAI_API_KEY`·`ANTHROPIC_API_KEY`를 쓴다 |

키는 Vercel 환경 변수와 GitHub Actions Secrets에만 넣는다. `.env*`는 `.gitignore`에 포함.

---

## 10. 개발 순서

**끝난 것 (2026-10-25, PR #77까지)**

- [x] **1. 기반 (J, K):** Supabase, 로그인·가입·워크스페이스 + RLS, 헤더(워크스페이스 → 프로젝트 → 제품), 프로젝트·제품 DB와 Leaf& Dew 6종 시드·규격, Vercel 배포
- [x] **2. 리뷰 분석 (E, D):** `products`/`reviews`, Qoo10 수집기와 수집 요청 화면, CSV 저장, AI 묶음 분석·번역, 리포트·소구점
- [x] **3. 약기법 검토 (A):** 기준 자료, 프롬프트 v6, `/api/ad-check`, 자동 저장·owner 승인, 검토 이력, 콘텐츠 제작 가이드
- [x] **4. 경쟁제품 비교 (C):** Qoo10 수집으로 경쟁 제품 등록, 자사-경쟁 연결, 비교 탭
- [x] **5. 시장 트렌드 (B, GEO):** Qoo10 랭킹 CSV, 검색 자동완성·Trends, GEO, SNS 핵심 니즈(Apify), 탭 구성의 시장 분석
- [x] 홈: 탭 요약 카드·할 일·프로모션 캘린더 (진출 실행 탭 제거)

**결재·AI 분석 (데모 범위, `docs/team-approval-ai-analysis.md` 7장 1~4단계, 원격 DB 적용 대기)**

- [x] **1단계 권한·테이블:** 결재 공통 층 5개 테이블 + RLS + `has_tab()`, 설정 화면의 멤버별 담당 탭
- [x] **2단계 시안 제출·히스토리:** 리뷰 분석·광고 검토 결과에서 시안 저장·제출, 버전 히스토리
- [x] **3단계 팀장 결재함 + 제품 × 탭 진행 표(L):** 버전 미리보기 결재, 판매 중 제품만의 진행 표 (홈의 샘플 8단계 현황판을 대신함)
- [x] **4단계 AI 분석(N):** 탭별 승인본 선택 → 실행 → 저장·공유·팀장 확인 라벨

**그 밖에 남은 것:** 공개 설문 제출 저장(G), 캘린더 쓰기 저장(I), 리뷰 번역 저장(F), 시장 화면의 라쿠텐 스냅샷 정리(Qoo10만 원칙).

1~4단계는 PR 하나로 올린다 (2026-10-26). 마이그레이션 `20261025115007_team_approval.sql`은 머지 뒤 총괄이 원격 DB에 적용하고, 그 뒤 owner·member 두 계정으로 권한과 저장·결재 흐름을 확인한다.

---

## 11. 열린 질문

- [ ] 약기법 기준 자료의 출처와 범위 확정 (효능 범위 56항목, 적정광고 가이드라인, 적발 사례)
- [ ] 수집 대상 사이트(Qoo10)의 이용약관 확인
- [ ] 무료 플랜 한도 확인 (Supabase 무료 플랜은 장기간 미사용 시 일시정지, Vercel Hobby는 하루 빌드 수 한도)
- [ ] (G) 설문 개인정보: 익명만 받을지, 쿠폰용 이메일 등까지 받을지 → APPI 동의·이용 목적·국외 이전 고지 범위
- [ ] (G) 설문 결과 페이지의 제품 추천 문구는 광고 → 약기법 검토 대상으로 처리
- [ ] (F) 국내 플랫폼 리뷰를 일본 상세페이지에 게시할 권리 (리뷰 저작권, 플랫폼 이용약관, 작성자 동의). 콘텐츠 제작 가이드가 한국 리뷰를 일본어 후기로 인용하는 것도 해당 (`docs/tab3-db-plan.md` 4장)
- [ ] (A) 「化粧品等の適正広告ガイドライン」 개정(2026년 7월 α판 초안)의 정식판 여부와 시점
- [ ] (M) 탭별 시안의 `body` 모양(`MarketBody`·`ReviewBody`·`AdBody`) 확정. 안은 `lib/schemas/submission.ts` (ReviewBody는 리뷰 리포트의 주제별 성적표 포함, MarketBody는 시장 탭 연결(5단계) 전까지 판단 목록만). 총괄 확인 대기
- [ ] (N) 통합 AI 분석의 분석 관점 목록 확정 (지금은 `prompts/integrated-analysis.v1.md`의 관점 4개를 코드가 쓴다)

---

## 12. 용어 빠른 참조

| 용어 | 한 줄 설명 |
| --- | --- |
| Route Handler | Next.js 안에 만드는 서버 API (`app/api/.../route.ts`) |
| Server Action | 화면에서 바로 부르는 서버 함수 (`"use server"`, `lib/data/*-actions.ts`) |
| RLS | Row Level Security. DB가 행 단위로 "누가 볼 수 있나"를 강제하는 규칙 |
| 구조화 출력 / JSON 스키마 | AI 답을 정해진 칸(JSON)에 맞춰 받는 방식 |
| Few-shot | 프롬프트에 판정 예시를 몇 개 넣는 기법 |
| RAG | AI가 답하기 전에 관련 문서를 검색해 함께 넣는 방식 (확장 단계) |
| 시안 · 버전 · 결재 | 탭 결과를 팀장에게 올리는 단위(시안), 그 히스토리(버전), 팀장의 승인·반려(결재) |
| upsert | 있으면 갱신, 없으면 추가 |

---

## 13. 작업 요청 프롬프트 (복사해서 사용)

각 프롬프트 앞에 "CLAUDE.md를 먼저 읽고 0장 규칙을 지켜줘."가 들어간다고 가정한다. 번호는 10장 "다음"의 단계와 같다. 한 단계를 확인한 뒤 다음 단계로 넘어간다. 끝난 단계의 옛 프롬프트는 `docs/archive/pre_CLAUDE.md` 13장에 있다.

**1단계. 권한 · 테이블**
```
docs/team-approval-ai-analysis.md와 docs/DB_RULES.md를 읽어줘.
그 문서 5장의 테이블 5개(member_tabs, tab_submissions, submission_versions, submission_reviews, ai_analyses)와
RLS, has_tab(ws, tab) 함수를 새 마이그레이션 하나로 만들어줘 (npx supabase migration new).
Zod(lib/schemas/submission.ts), mock, lib/data 읽기 함수를 같은 PR에서 맞추고,
설정 화면에 팀장(owner)이 멤버별 담당 탭을 주는 칸을 만들어줘. 원격 DB 적용은 하지 마.
```

**2단계. 시안 제출 · 히스토리**
```
리뷰 분석과 광고 검토 결과 화면에 "시안으로 저장 / 제출" 버튼과 버전 히스토리 패널을 붙여줘.
설계 문서 6장 규칙대로 제출한 버전은 고칠 수 없고, 삭제는 숨김이야. 담당이 아닌 탭에서는 버튼을 숨겨줘.
```

**3단계. 팀장 결재함 + 제품 × 탭 진행 표**
```
approvals/ 결재함과 버전 미리보기 페이지(내용 · 근거 · 이전 버전 비교 · 승인/반려, 반려 사유 필수)를 만들어줘.
그리고 판매 중 제품만 행으로 하는 제품 × 탭 진행 표를 만들어 홈의 샘플 8단계 현황판을 대신하게 해줘.
```

**4단계. AI 분석**
```
ai-analysis/ 화면에서 제품을 고르고 탭별 승인본을 하나씩 고르면(기본값 최신 승인본, 기준 날짜 차이 30일 넘으면 경고)
lib/ai/integrated-analysis/가 prompts/integrated-analysis.v1.md로 callAi(정밀 등급)를 불러 결과를 ai_analyses에 저장하게 해줘.
설계 문서 10장대로 분석 관점은 프롬프트 파일에서만 정하고, 출력은 관점별 일반 모양으로 Zod 검증해줘.
결과에는 "AI 결과 · 팀장 확인 전" 라벨과 문장별 근거 버전 링크를 보여줘.
```

**막혔을 때 쓰는 프롬프트**
```
지금 에러를 고치기 전에 원인을 먼저 설명해줘. 관련 파일만 읽고, 고칠 방법이 두 가지 이상이면 장단점을 비교한 뒤 추천안을 말해줘. 내가 확인하기 전에는 코드를 바꾸지 마.
```
