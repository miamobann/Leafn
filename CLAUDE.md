# K-뷰티 일본 진출 지원 서비스 — 개발 레퍼런스

> 팀 코딩용 기준 문서입니다. 근거와 비유를 포함한 전체 분석은 [기술 스택 분석 문서](https://claude.ai/artifact/MA3A2F3vJ7c7u2wNiveKxj)를 보세요.
> 기준: 기획안 v1 · 작성일 2026-10-21 · 상태: 초안 (DB 스키마와 API는 팀 합의 후 확정)
> 프로토타입(화면 뼈대) 계획: `docs/prototype-plan.md`
> DB 작업 규칙: `docs/DB_RULES.md` · 통합 DB 프레임 초안: `docs/db-frame.md`

**한 줄 정의:** 일본 진출을 준비하는 K-뷰티 중소기업 해외마케팅팀이 시장 조사, 리뷰 분석, 약기법 광고 검토, 프로모션 일정을 한곳에서 AI로 처리하는 팀 업무용 웹서비스.

**원칙:** 도구를 먼저 고르지 않는다. 문제 → 기능 → 그 기능에 맞는 언어·도구 순서로 결정하고, 새 기술은 필요해진 시점에 추가한다.

**사용법 (바이브 코딩):** 이 파일을 저장소 루트에 두고 AI 코딩 도구가 매번 읽게 한다. Claude Code는 `CLAUDE.md`, Cursor는 `.cursor/rules/`, 그 밖의 도구는 `AGENTS.md`로 복사하거나 그 파일에서 이 파일을 참조한다 (저장소에 `AGENTS.md`와 `.cursor/rules/leafn.mdc`가 이 파일을 가리키도록 들어 있다). 작업을 시킬 때는 13장의 프롬프트를 복사해 쓴다.

**문서 지도와 우선순위:** 문서끼리 다르면 번호가 앞선 문서를 따르고, 뒤의 문서를 고친다.

1. `CLAUDE.md` (이 파일): 기술 판단의 기준
2. `docs/CODING_RULES.md` (협업·Git·코드 스타일), `docs/DB_RULES.md` (DB 작업 절차)
3. `docs/db-frame.md`: 팀 합의 전 DB 초안. 합의되면 5장에 옮긴다
4. `docs/prototype-plan.md`: 화면 뼈대 계획과 진행 기록

`docs/TECH_STACK.md`는 이 파일로 옮기기 전의 사본이라 따르지 않는다.

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
- 새 테이블에는 `workspace_id`와 RLS 정책을 함께 만든다 (예외: 5장에 적힌 것만. 지금은 없음).
- AI 호출은 `lib/ai/`에서만, 프롬프트 원문은 `prompts/`에만 둔다. 컴포넌트나 Route Handler에 프롬프트 문자열을 직접 쓰지 않는다.
- AI 응답과 API 입력은 `lib/schemas/`의 Zod 스키마로 검증한다.

**보안**
- `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RAKUTEN_APPLICATION_ID`는 서버 코드에서만 쓴다. `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
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
- 서버 함수 하나가 오래 걸리지 않게 리뷰 분석은 묶음(기본 50건) 단위로 처리한다.

**완료 기준 (매 작업 끝에)**
- 타입 검사·린트·빌드가 통과한다 (`npm run typecheck`, `npm run lint`, `npm run build` — 스크립트 이름은 저장소 설정에 맞춘다).
- 바꾼 파일 목록과 직접 확인할 방법(어느 화면에서 무엇을 눌러 보면 되는지)을 요약한다.
- 결정이 필요한 부분이 있었다면 임의로 정하지 말고 11장 "열린 질문"에 추가할 항목으로 보고한다.

---

## 1. 기능 목록과 우선순위

우선순위는 **"이 웹서비스가 성립하려면 꼭 있어야 하는가"**로 정했다. 기획안 3개 탭의 "주요 서비스 기능"이 서비스의 정의이므로 핵심이고, 기획안 끝의 "특별히 신경 쓰고 싶은 기능" 목록은 **참조용**으로만 둔다 (우선순위 근거로 쓰지 않음).

| 순서 | ID | 기능 | 탭 | 구분 | 왜 이 순서인가 |
| --- | --- | --- | --- | --- | --- |
| 1 | J | 팀 워크스페이스 (로그인, 팀별 데이터 분리, 결과 보관) | 공통 | 기반 | 모든 분석 결과와 TAB 3 "담당자 검토 결과 저장"이 사용자·팀 단위로 저장돼야 함 |
| 1 | K | 공통 대시보드 화면 (탭 구조) | 공통 | 기반 | 세 탭이 들어갈 틀 |
| 2 | E | 국내 리뷰 분석 (플랫폼 수집/CSV · 감성 · 키워드 · 페인포인트 · 재구매 요인 · 차트 · 원문 연결) | TAB 2 | 핵심 | 수집 → 저장 → AI 분석 → 시각화의 전체 흐름이 처음 완성되는 기능. `products`/`reviews`와 수집기를 여기서 만들고 다른 탭이 재사용 |
| 3 | A | 약기법 광고 문구 검토 (입력 · 위험 표현 탐지 · 사유/근거 · 대체 표현 · 현지화 · 검토 이력) | TAB 3 | 핵심 | TAB 3의 전부. 외부 데이터 의존이 없어 단독 구현 가능 |
| 4 | C | 경쟁제품 비교 (가격 · 용량 · 성분 · 특징) | TAB 1 | 핵심 | E에서 만든 `products`를 경쟁사까지 확장 |
| 5 | B | 시장 트렌드 분석 (주요 트렌드, 성분별 관심도) | TAB 1 | 핵심 | 외부 데이터(라쿠텐 API 등) 연동이 필요해 기반이 갖춰진 뒤가 효율적 |
| 참조 | D | 일본 현지 제품 리뷰 분석 | TAB 2 | 참조 | E 파이프라인에 일본어 소스만 추가하면 됨 |
| 참조 | F | 한국 리뷰 → 일본어 번역 → 상세페이지용 블록 (A 검토를 거침) | TAB 2 | 참조 | E + A 조합 |
| 참조 | - | GEO (AI 검색의 브랜드 언급 추적) | TAB 1 | 참조 | B의 확장 |
| 참조 | G | 피부타입 설문 (일본 소비자용 공개 모바일 웹) | - | 참조 | 탭 기능 밖 |
| 참조 | H | 진출·홍보 플랫폼별 강점 정리 | - | 참조 | 탭 기능 밖 |
| 참조 | I | 메가와리/프로모션 캘린더 | - | 참조 | 탭 기능 밖 |

**프로토타입 범위 (2026-10-21 결정):** 화면 뼈대(가짜 데이터, 백엔드·API·AI 호출 없음)는 MVP 1~5와 참조 기능(D, F, GEO, G, H, I) 모두 만든다. 계획과 순서는 `docs/prototype-plan.md`를 따른다. 실데이터 연동의 순서와 범위는 이 표 그대로다.

- **MVP = 순서 1~5.** 참조 기능은 MVP가 끝난 뒤 팀이 필요하다고 판단할 때 착수한다.
- AI 코딩 도구는 참조 기능의 **테이블·API·수집기를 요청받기 전에 만들지 않는다.** 화면 뼈대는 `docs/prototype-plan.md`에서 요청된 페이즈 범위 안에서만 만든다. 다만 핵심 기능을 설계할 때 참조 기능이 나중에 붙을 수 있게 막지는 않는다 (예: `reviews.lang`에 `ja`도 허용).

**이번 범위에서 제외:** 결제, 실시간 통신(동시 편집), 별도 관리자 시스템(Supabase 콘솔로 대체).

**구현 메모**
- D와 E는 같은 "리뷰 분석 파이프라인"을 쓴다. 언어(ja/ko)와 데이터 출처만 다르다.
- F를 만들 때는 번역 결과를 반드시 A의 검토를 통과시킨다. 판매자가 상세페이지에 게시한 리뷰는 광고로 취급될 수 있다. (정확한 범위는 전문가 확인 필요)
- GEO는 Generative Engine Optimization으로 해석했다. (팀 확인 필요, 11장 참고)

---

## 2. 기술 스택

### MVP (순서 1~5에 필요한 것)

| 영역 | 기술 | 용도 |
| --- | --- | --- |
| 언어 | TypeScript | 화면 + 서버 |
| 언어 | Python 3 | 리뷰·랭킹 수집 (E, B) |
| 프레임워크 | Next.js (App Router) | 화면과 서버 API (Route Handler)를 한 프로젝트로 |
| UI | Tailwind CSS + shadcn/ui | 화면 부품 |
| 차트 | Recharts | 감성 비율, 키워드 빈도, 트렌드 추이 |
| CSV | Papa Parse | 리뷰 CSV 업로드 파싱 (E) |
| AI SDK | Anthropic SDK (`@anthropic-ai/sdk`) | Claude 호출 |
| 검증 | Zod | AI 응답과 API 입력 검증 |
| DB/인증/파일 | Supabase (PostgreSQL, Auth, Storage, RLS) | 모든 데이터, 로그인, CSV/이미지 보관 |
| 수집 | Playwright (Py), requests + BeautifulSoup, pandas | 쇼핑몰 리뷰·랭킹 수집과 정리 |
| 외부 API | 라쿠텐 시장 API (상품 검색, 랭킹) | 트렌드·경쟁사 데이터 (B, C) |
| 배포 | Vercel | Next.js 배포, PR별 미리보기 |
| 스케줄러 | GitHub Actions (cron) | Python 수집기 정기 실행 |

### AI 모델 사용 규칙

| 작업 | 모델 | 이유 |
| --- | --- | --- |
| 약기법 위험 판단, 대체 표현, 페인포인트 요약 | Claude Sonnet 계열 (`claude-sonnet-5-5`) | 긴 규제 문서 이해, 미묘한 일본어 판단 |
| 리뷰 감성 분류, 키워드, 상품 이미지에서 성분·용량 추출, (참조) 번역 | Claude Haiku 계열 (`claude-haiku-5-5`) | 대량 반복 작업, 속도·비용 |

- 대체 가능: Gemini, GPT. 호출 코드를 `lib/ai/` 한곳에 모아 교체 비용을 낮춘다.
- 모델 ID는 환경 변수나 설정 파일 한곳에서 관리한다. 시작 시점의 최신 버전으로 갱신.

### 참조 기능을 만들 때 추가

| 기술 | 기능 |
| --- | --- |
| FullCalendar | 프로모션 캘린더 (I) |
| SudachiPy | 일본어 리뷰 형태소 분석, 키워드 빈도 (D) |
| HTML/이미지 내보내기 | 상세페이지용 리뷰 블록 (F) |

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
      Backend: Next.js Route Handler (Vercel)
         │  인증 확인 · 입력 검증(Zod) · 라쿠텐 API 호출
                       ↓
      AI: Claude API
         │  약기법 검토 · 리뷰 분석 · 번역 · 상품 정보 추출
         │  (약기법 기준 문서는 프롬프트에 포함)
                       ↓
      Database: Supabase PostgreSQL + Storage  ←──────┐
                                                      │
              Python 수집기 (GitHub Actions, 매일)
                       ↑
      External: 라쿠텐 API · 올리브영 등 국내 플랫폼 · (참조) @cosme · Qoo10 · AI 검색 응답(GEO)
```

- 웹 앱과 수집기는 직접 통신하지 않는다. **DB가 유일한 접점**이다.
- 수집이 멈춰도 이미 쌓인 데이터로 웹 기능은 계속 동작해야 한다.

---

## 4. 저장소 구조 (제안)

```
/
├─ apps/web/                     # Next.js (TypeScript)
│  ├─ app/
│  │  ├─ (internal)/             # 사내용 root layout (<html lang="ko">)
│  │  │  ├─ (auth)/              # login/, onboarding/
│  │  │  └─ (dashboard)/         # 로그인 필요: market/, reviews/, ad-check/, platforms/, calendar/,
│  │  │                          #   survey-results/, library/, settings/
│  │  ├─ (public)/               # 공개용 root layout (<html lang="ja">)
│  │  │  └─ survey/              # (G) 피부타입 설문, 로그인 불필요
│  │  └─ api/                    # Route Handler (5장) — 프로토타입 단계에서는 만들지 않음
│  ├─ components/                # shadcn/ui 기반 공통 컴포넌트 (ui/, layout/, common/, templates/)
│  ├─ lib/
│  │  ├─ ai/                     # Claude 클라이언트, 작업별 호출 함수
│  │  ├─ schemas/                # Zod 스키마 (데이터 모양, AI 응답, API 입력)
│  │  ├─ supabase/               # 브라우저/서버용 클라이언트
│  │  ├─ mock/                   # (프로토타입) 가짜 데이터. 불러올 때 Zod로 검증
│  │  └─ data/                   # 화면이 부르는 읽기 함수. 지금은 mock, 나중에 Supabase
│  └─ prompts/                   # 프롬프트 원문 (버전 관리, 7장)
├─ collectors/                   # Python 수집기
│  ├─ sources/                   # MVP: oliveyoung.py 등 국내 플랫폼, rakuten.py  (참조 D: cosme.py, qoo10.py)
│  ├─ nlp/                       # (참조 D) SudachiPy 키워드 추출
│  ├─ db.py                      # Supabase upsert
│  └─ requirements.txt
├─ supabase/
│  └─ migrations/                # 테이블, RLS 정책 SQL
├─ knowledge/
│  └─ yakkiho/                   # 약기법 기준 자료 (효능 범위 56항목, 적정광고 가이드라인 요약 등)
└─ .github/workflows/
   └─ collect.yml                # 수집기 cron
```

---

## 5. DB 스키마 초안

> 컬럼·테이블·행을 추가하는 규칙은 `docs/DB_RULES.md`, 팀 합의를 기다리는 통합 프레임 초안은 `docs/db-frame.md`에 있다.

표의 "기능"에 **(참조)**가 붙은 테이블은 해당 참조 기능을 만들 때 생성한다. MVP에서는 만들지 않는다.

모든 업무 테이블은 `workspace_id`를 갖고, RLS로 **자기 워크스페이스 행만** 읽고 쓰게 한다. 공통 컬럼: `id uuid pk`, `created_at timestamptz`.

| 테이블 | 주요 컬럼 | 기능 |
| --- | --- | --- |
| `workspaces` | name | J |
| `workspace_members` | workspace_id, user_id, role (`owner` / `member`) | J |
| `products` | workspace_id, kind (`own` / `competitor`), brand, name, platform, url, price_jpy, volume_ml, ingredients jsonb, features text[], image_path, source_raw jsonb | E에서 생성, C에서 확장 |
| `reviews` | workspace_id, product_id, source (`cosme` / `rakuten` / `qoo10` / `oliveyoung` / `csv`), external_id, lang (`ja` / `ko`), rating, body, posted_at, raw jsonb · unique(workspace_id, source, external_id) | E (D는 참조) |
| `review_analyses` | review_id, sentiment (`positive` / `negative` / `neutral`), keywords jsonb `[{text, category}]` (category: `ingredient` / `texture` / `price` / `scent` / `skin_reaction` / `other`), pain_points text[], repurchase_factors text[], model, prompt_version | E (D는 참조) |
| `review_insights` | workspace_id, product_id, kind (`pain_point` / `repurchase_factor` / `keyword`), label, count, evidence_review_ids uuid[] | E (원문 근거 연결) |
| `review_translations` | review_id, text_ja, ad_check_id, status (`draft` / `approved`) | F (참조) |
| `ad_checks` | workspace_id, input_text, input_lang, findings jsonb (대체 표현은 각 항목 안의 `suggestions`, 7장), model, prompt_version, reviewer_id, review_status (`pending` / `approved` / `rejected`), reviewer_note | A |
| `trend_snapshots` | workspace_id, source (`rakuten_ranking` / …), category, captured_at, data jsonb | B |
| `geo_snapshots` | workspace_id, engine, query, answer, brands_mentioned text[], captured_at | GEO (참조) |
| `promo_events` | workspace_id, platform, title, start_date, end_date, prep_due_date, memo | I (참조) |
| `platform_notes` | workspace_id, platform, strengths, audience, fees_note, updated_by | H (참조) |
| `skin_survey_responses` | workspace_id, answers jsonb, skin_type, consent_at, locale | G (참조, 익명 insert만 허용, 조회는 멤버만) |

규칙
- 분석 결과에는 항상 **근거 리뷰 ID**를 남긴다 (E의 "원문 근거 확인").
- AI 결과 행에는 `model`, `prompt_version`을 저장해 결과가 바뀐 이유를 추적한다.
- 모양이 일정하지 않은 원본 데이터는 `raw jsonb`에 그대로 둔다. NoSQL은 쓰지 않는다.

---

## 6. API 라우트 초안

| 메서드 · 경로 | 하는 일 | 모델 |
| --- | --- | --- |
| `POST /api/ad-check` | 문구 → 위험 표현, 사유, 대체 표현 (JSON) → `ad_checks` 저장 | Sonnet |
| `PATCH /api/ad-check/:id` | 담당자 검토 결과 저장 | - |
| `POST /api/reviews/upload` | CSV 업로드 → `reviews` 저장 | - |
| `POST /api/reviews/analyze` | 리뷰 묶음(예: 50건) 분석 → `review_analyses` | Haiku |
| `POST /api/reviews/insights` | 분석 결과 집계 + 페인포인트 요약 → `review_insights` | Sonnet |
| `POST /api/reviews/translate` | (참조 F) 선택 리뷰 일본어 번역 → 자동으로 ad-check 실행 | Haiku + Sonnet |
| `POST /api/products/extract` | 상품 페이지/이미지에서 가격·용량·성분 추출 | Haiku |
| `GET /api/trends/rakuten` | 라쿠텐 랭킹·상품 검색 프록시 (키는 서버에만) | - |
| `POST /api/survey` | (참조 G) 설문 응답 저장 (공개) | - |

- 대량 분석은 서버 함수 실행 시간 제한을 넘지 않도록 **묶음 단위로 나눠** 호출한다. 한계에 닿으면 작업 큐 도입 (2장 확장).

---

## 7. AI 호출 규칙

1. **출력은 항상 JSON 스키마로 고정**하고, 받은 뒤 Zod로 검증한다. 검증 실패 시 1회 재시도 후 에러 표시.
2. **프롬프트는 `prompts/`에 파일로** 두고 버전을 붙인다 (`ad-check.v1.md`). 코드에 문자열로 흩어 두지 않는다.
3. **예시(Few-shot)와 판단 단계**를 프롬프트에 넣는다. 예: "1) 효능 범위 56항목 안인지 2) 의약품적 표현인지 3) 최상급·보증 표현인지 → 판정".
4. **약기법 기준 자료는 MVP에서 프롬프트에 통째로** 넣는다 (`knowledge/yakkiho/`). Vector DB는 자료가 커지면 도입.
5. 약기법 결과 화면에는 "법률 자문이 아닌 검토 보조 결과이며 최종 판단은 담당자·전문가가 한다"는 문구를 표시한다.

약기법 검토 응답 예시 (초안)

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

리뷰 분석 응답 예시 (초안, 리뷰 1건당)

```json
{
  "review_id": "uuid",
  "sentiment": "negative",
  "keywords": [
    { "text": "保湿", "category": "texture" },
    { "text": "べたつき", "category": "texture" },
    { "text": "香り", "category": "scent" }
  ],
  "pain_points": ["べたつきが残る"],
  "repurchase_factors": []
}
```

---

## 8. 데이터 수집 규칙

- **공식 API 우선.** 라쿠텐은 API를 쓰고, 크롤링은 API가 없는 곳에만.
- 크롤링 전 각 사이트의 이용약관과 robots.txt를 확인하고, 요청 간격을 두며 필요한 범위만 수집한다.
- 저장은 `(workspace_id, source, external_id)` 기준 upsert로 중복을 막는다. 수집기는 service role 키로 RLS를 우회하므로 `workspace_id`를 코드에서 반드시 채운다 (`docs/DB_RULES.md` 4장).
- 원본은 `raw jsonb`에 보관해 파서가 바뀌어도 다시 가공할 수 있게 한다.
- 수집 실패는 GitHub Actions 로그로 확인한다. 사이트 구조 변경으로 깨지는 것을 전제로 소스별 파일을 분리한다.

---

## 9. 환경 변수

| 이름 | 사용처 | 비고 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | web 서버 | 브라우저 노출 금지 |
| `NEXT_PUBLIC_SUPABASE_URL` | web | 공개 가능 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | 공개 가능 (RLS가 보호) |
| `SUPABASE_SERVICE_ROLE_KEY` | collectors, 서버 전용 작업 | RLS 우회 키. 절대 브라우저/커밋 금지 |
| `RAKUTEN_APPLICATION_ID` | web 서버, collectors | |

키는 Vercel 환경 변수와 GitHub Actions Secrets에만 넣는다. `.env*`는 `.gitignore`에 포함.

---

## 10. 개발 순서 (MVP)

> 화면 뼈대의 순서는 `docs/prototype-plan.md`를 따른다. 이 장은 실데이터 연동 순서다.

1장의 순서를 따른다. 앞 단계가 뒤 단계의 테이블과 코드를 만들어 주는 순서다.

- [ ] **1. 기반 (J, K):** Supabase 프로젝트, 로그인, `workspaces`/`workspace_members` + RLS, 탭 3개짜리 빈 대시보드, Vercel 배포
- [ ] **2. 국내 리뷰 분석 (E):** `products`/`reviews` 생성 → CSV 업로드 → 묶음 분석 → 집계·차트 → 원문 연결 → Python 수집기(국내 플랫폼) + GitHub Actions
- [ ] **3. 약기법 검토 (A):** 기준 자료 정리 → 프롬프트 v1 → `/api/ad-check` → 결과 화면(현지화 제안 포함) → 담당자 검토 저장·이력
- [ ] **4. 경쟁제품 비교 (C):** 상품 URL/이미지에서 가격·용량·성분·특징 추출 → `products`(competitor) → 자사 vs 경쟁사 비교표
- [ ] **5. 시장 트렌드 (B):** 라쿠텐 랭킹·상품 검색 연동 → `trend_snapshots` → 트렌드·성분별 관심도 차트

**참조 기능 (MVP 이후, 팀이 필요하다고 정할 때):** D 일본 현지 리뷰 · F 리뷰 번역 상세페이지 · GEO · G 피부타입 설문(APPI 동의 문구 필요) · H 플랫폼 강점 · I 프로모션 캘린더

**병렬 작업 분담:** 5장 DB 표만 먼저 합의하면 화면 / 서버·프롬프트 / Python 수집 담당이 동시에 진행할 수 있다.

---

## 11. 열린 질문

- [ ] (참조 기능) "GEO"가 AI 검색 최적화(Generative Engine Optimization)가 맞는지, 지역 분석인지
- [ ] 약기법 기준 자료의 출처와 범위 확정 (효능 범위 56항목, 적정광고 가이드라인, 적발 사례)
- [ ] 라쿠텐 API 이용 조건과 호출 한도 확인
- [ ] 수집 대상 사이트별 이용약관 확인
- [ ] 무료 플랜 한도 확인 (Supabase 무료 플랜은 장기간 미사용 시 일시정지)
- [ ] (G) 피부타입 분류 기준과 문항
- [ ] (G) 설문 개인정보: 익명만 받을지, 쿠폰용 이메일 등까지 받을지 → APPI 동의·이용 목적·국외 이전 고지 범위
- [ ] (G) 설문 결과 페이지의 제품 추천 문구는 광고 → 약기법 검토 대상으로 처리
- [ ] (F) 국내 플랫폼 리뷰를 일본 상세페이지에 게시할 권리 (리뷰 저작권, 플랫폼 이용약관, 작성자 동의)
- [ ] (A) 「化粧品等の適正広告ガイドライン」 개정(2026년 7월 α판 초안)의 정식판 여부와 시점
- [ ] (D) 플랫폼별 평점 척도 (@cosme 등)
- [ ] `docs/prototype-plan.md` 8장 스키마 제안 18개의 5·7장 반영 여부 (프로토타입에서는 optional 필드로 시험 중)

---

## 12. 용어 빠른 참조

| 용어 | 한 줄 설명 |
| --- | --- |
| Route Handler | Next.js 안에 만드는 서버 API (`app/api/.../route.ts`) |
| RLS | Row Level Security. DB가 행 단위로 "누가 볼 수 있나"를 강제하는 규칙 |
| 구조화 출력 / JSON 스키마 | AI 답을 정해진 칸(JSON)에 맞춰 받는 방식 |
| Few-shot | 프롬프트에 판정 예시를 몇 개 넣는 기법 |
| RAG | AI가 답하기 전에 관련 문서를 검색해 함께 넣는 방식 (확장 단계) |
| 형태소 분석 | 띄어쓰기 없는 일본어를 단어로 자르는 작업 (SudachiPy) |
| upsert | 있으면 갱신, 없으면 추가 |

---

## 13. 단계별 작업 요청 프롬프트 (복사해서 사용)

각 프롬프트 앞에 "CLAUDE.md를 먼저 읽고 0장 규칙을 지켜줘."가 들어간다고 가정한다. 번호는 10장 개발 순서와 같다. 한 단계를 확인한 뒤 다음 단계로 넘어간다.

### MVP

**1-1. 프로젝트 생성**
```
apps/web에 Next.js(App Router, TypeScript strict) 프로젝트를 만들고 Tailwind와 shadcn/ui를 설정해줘.
(dashboard) 레이아웃에 사이드바 내비게이션을 만들고, "시장 분석 / 리뷰 분석 / 광고 검토"를 사이드바 상단 그룹으로 둬. 각 페이지는 빈 화면으로 둬.
아직 Supabase나 AI는 연결하지 마.
```

**1-2. 로그인과 워크스페이스**
```
Supabase Auth(이메일 로그인)를 연결하고, 5장의 workspaces, workspace_members 테이블과 RLS 정책을
supabase/migrations에 SQL로 만들어줘. 로그인하지 않으면 (dashboard)에 들어갈 수 없게 하고,
첫 로그인 시 워크스페이스를 만들거나 초대 코드로 참여하는 화면을 만들어줘.
```

**2-1. 리뷰 CSV 업로드와 분석**
```
5장의 products, reviews, review_analyses 테이블을 만들어줘. reviews.lang은 ko와 ja를 모두 허용해줘.
리뷰 분석 탭에서 CSV(컬럼: 상품명, 평점, 본문, 작성일)를 업로드하면 Papa Parse로 읽어 reviews에 저장하고,
POST /api/reviews/analyze가 50건씩 Haiku로 감성·키워드·페인포인트·재구매 요인을 분석하게 해줘.
진행률을 화면에 보여줘.
```

**2-2. 리뷰 집계와 원문 연결**
```
review_insights 테이블과 POST /api/reviews/insights를 만들어줘.
Recharts로 감성 비율(도넛), 키워드 빈도(막대), 주요 불만 유형(막대)을 보여주고,
불만 유형이나 키워드를 클릭하면 근거 리뷰 원문 목록이 열리게 해줘.
```

**2-3. Python 수집기**
```
collectors/에 Python 수집기를 만들어줘. 우선 sources/oliveyoung.py 하나만.
상품 URL 목록을 받아 리뷰를 수집하고 (workspace_id, source, external_id)로 reviews에 upsert해줘. workspace_id는 실행 설정에서 받아 반드시 채우고, 원본은 raw에 저장.
요청 사이에 간격을 두고, 실패해도 다른 상품은 계속 진행되게 해줘.
.github/workflows/collect.yml로 매일 1회 실행되게 하고, 키는 GitHub Secrets에서 읽어줘.
```

**3-1. 약기법 검토 API**
```
5장의 ad_checks 테이블을 만들고, 7장 규칙대로 POST /api/ad-check를 구현해줘.
- 프롬프트: prompts/ad-check.v1.md (knowledge/yakkiho/ 자료를 포함, 판단 단계와 예시 3개)
- 모델: Sonnet 계열, 응답은 7장의 약기법 JSON 예시 모양으로 고정하고 Zod로 검증
- 결과는 ad_checks에 model, prompt_version과 함께 저장
화면은 다음 단계에서 만들 거니까 API와 스키마만 해줘.
```

**3-2. 약기법 검토 화면**
```
광고 검토 탭에 문구 입력창(한국어/일본어 선택)과 결과 화면을 만들어줘.
위험 표현은 원문 위에 위험도별 색으로 표시하고, 클릭하면 사유·근거·대체 표현이 보이게 해줘.
일본 소비자에게 자연스러운 현지화 제안(localized_note)도 함께 보여줘.
담당자가 승인/반려와 메모를 남기면 PATCH /api/ad-check/:id로 저장하고, 아래에 검토 이력 목록을 보여줘.
"법률 자문이 아닌 검토 보조 결과" 안내 문구를 결과 상단에 고정해줘.
```

**4. 경쟁제품 비교**
```
경쟁제품을 URL이나 상품 이미지로 등록하면 POST /api/products/extract가 가격·용량·주요 성분·특징을 추출해
products(kind=competitor)에 넣게 해줘. 시장 분석 탭에 자사 vs 경쟁사 비교표를 보여주고,
추출 값은 사람이 수정할 수 있어야 해.
```

**5. 시장 트렌드**
```
GET /api/trends/rakuten으로 라쿠텐 랭킹/상품 검색을 서버에서 호출하고 trend_snapshots에 저장해줘.
시장 분석 탭에 카테고리별 랭킹 추이와 상품명·설명에 자주 등장하는 성분의 관심도 차트를 보여줘.
```

### 참조 기능 (MVP 이후, 요청할 때만)

**리뷰 번역 → 상세페이지 (F)**
```
분석된 한국어 리뷰를 골라 "일본어로 번역" 버튼을 누르면 POST /api/reviews/translate가
Haiku로 번역한 뒤 자동으로 ad-check를 실행하게 해줘. 위험 표현이 있으면 승인 전까지 내보내기를 막아줘.
승인된 리뷰는 상세페이지에 붙일 HTML 블록으로 복사할 수 있게 해줘.
```

**캘린더 · 플랫폼 · 설문 (I, H, G)**
```
(1) promo_events + FullCalendar로 프로모션 캘린더 (월/주 보기, 준비 마감일 표시)
(2) platform_notes로 플랫폼별 강점 카드 화면 (팀원이 편집 가능)
(3) /survey 공개 페이지: 일본어 모바일 우선 피부타입 설문, 개인정보 동의 체크 필수, 결과는 익명 저장,
    대시보드에서 응답 집계를 볼 수 있게
세 가지는 각각 따로 요청할 테니 지금은 (1)만 해줘.
```

**막혔을 때 쓰는 프롬프트**
```
지금 에러를 고치기 전에 원인을 먼저 설명해줘. 관련 파일만 읽고, 고칠 방법이 두 가지 이상이면 장단점을 비교한 뒤 추천안을 말해줘. 내가 확인하기 전에는 코드를 바꾸지 마.
```
