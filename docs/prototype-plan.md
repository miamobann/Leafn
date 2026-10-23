# K-뷰티 일본 진출 지원 서비스 — 프로토타입 계획 (화면 뼈대)

> 기준: 기획안 v1 + `TECH_STACK.md`(2026-10-21 초안, 수정안을 반영해 저장소 루트 `CLAUDE.md`로 복사함) · 작성일 2026-10-21 · 상태: P1 구현 완료, 첫 클릭 테스트 전 (12장)
> 범위: 백엔드·DB·API·AI 호출 없이 **가짜 데이터로 클릭해 볼 수 있는 화면**. 3개 탭 + 관심 기능 8개 전부를 화면 뼈대 수준으로.
> 이 문서의 장 번호는 이 문서 기준이다. TECH_STACK.md의 장은 "TECH_STACK n장"으로 적는다. **TECH_STACK.md는 루트 `CLAUDE.md`로 옮겨졌으므로 "TECH_STACK n장"은 지금의 "CLAUDE.md n장"으로 읽는다** (`docs/TECH_STACK.md`는 옛 사본이라 따르지 않는다).
> 문서끼리 다르면 CLAUDE.md 머리의 "문서 지도와 우선순위"를 따른다. 이 문서의 계획과 실제 코드가 다르면 코드(`apps/web/package.json`, 실제 파일)가 기준이다.

---

## 0. 한눈에 보기

| 페이즈 | 만드는 것 | 사용자에게 확인할 질문 | 기획안 기능 | 먼저 끝나야 하는 것 |
| --- | --- | --- | --- | --- |
| **P1** | 전체 뼈대: 프로젝트, 레이아웃 2종, 화면 27개, 템플릿 7종, 타입·스키마·가짜 데이터, 상태 화면 | 메뉴 구조가 업무 흐름과 맞나? 원하는 기능을 첫 클릭에 찾나? | K, J(틀), 전 기능(빈 화면) | — |
| **P2** | 약기법 광고 검토 | 담당자가 AI 판정을 보고 승인/반려를 결정할 수 있나? | A · 관심 1 | P1 |
| **P3** | 시장 분석: 트렌드·성분 관심도·GEO·경쟁제품 비교 | 비교표로 가격 포지셔닝을 정할 수 있나? GEO 해석이 맞나? | B, C, GEO · 관심 2 | P1 |
| **P4** | 리뷰 분석: 국내 + 일본 현지 + 소구점 찾기 | 차트에서 원문 근거까지 내려가 소구점을 뽑을 수 있나? | E, D · 관심 3 | P1 |
| **P5** | 리뷰 번역 → 상세페이지 블록 | 번역 → 검토 → 승인 → 복사의 관문을 이해하나? | F · 관심 4 | P2, P4 |
| **P6** | 플랫폼별 강점 + 프로모션 캘린더 | 진출 순서를 정하고 준비 마감을 놓치지 않나? | H, I · 관심 6, 7 | P2 |
| **P7** | 피부타입 설문(공개, 일본어) + 응답 집계 | 일본 소비자가 휴대폰으로 끝까지 답하나? | G · 관심 5 | P1 (P2~P6와 병렬 가능) |
| **P8** | 워크스페이스 홈·자료실·설정·로그인 | 홈에서 이번 주 할 일을 1분 안에 파악하나? | J · 관심 8 | P2~P7 |

**순서를 이렇게 정한 이유.** TECH_STACK 10장의 순서(J→E→A→C→B)는 "앞 단계가 뒤 단계의 테이블을 만들어 준다"는 DB 의존성 순서다. 화면만 만들 때는 그 제약이 없으므로, **이 화면으로 사용자에게 무엇을 확인하는가**를 기준으로 다시 정했다.

- **P1** — 모든 화면의 틀과 데이터 모양이 먼저 있어야 이후 페이즈가 "채우기"가 된다. 메뉴 구조(정보 구조)는 빈 화면만으로도 검증할 수 있다.
- **P2 약기법** — 페르소나 관심 1순위이고, 틀리면 법적 위험이 생기는 유일한 화면이다. "표시가 달린 문구" UI는 표준 부품이 없어 디자인 불확실성도 가장 크다. P5(리뷰 번역)와 P7(설문 결과 문구)이 이 결과 화면을 다시 쓴다.
- **P3 시장 분석** — 관심 2순위. GEO 해석은 TECH_STACK 11장의 열린 질문이라, 화면을 보여주며 확인하는 게 가장 빠르다. 비교표는 흔한 패턴이지만 열 구성은 실제 의사결정으로 확인해야 한다.
- **P4 리뷰 분석** — TAB 2 전체 + 관심 3. 차트 → 근거 원문으로 내려가는 패턴을 여기서 완성한다. 근거 패널(EvidenceSheet)은 P1에서 골격을 만들고, P3(성분·GEO 근거)에서 처음 쓰고, P4에서 리뷰용으로 완성한다.
- **P5 리뷰 번역** — P2의 검토 결과 화면과 P4의 리뷰 목록을 조립하는 페이즈라 둘 다 끝난 뒤에 한다.
- **P6 플랫폼·캘린더** — 관심 6·7. 다른 기능과 독립적이지만, 캘린더 일정에서 "행사용 문구 승인 여부"를 보여주려면 P2가 먼저다.
- **P7 설문** — 관심 5지만 사용자(일본 소비자)·언어·기기가 모두 달라 별도 트랙이다. 원어민 검수와 개인정보 문구 확인이라는 외부 의존이 있으므로, **P1 직후 그 요청부터 보내고** 화면은 다른 페이즈와 병렬로 만든다.
- **P8 워크스페이스** — 홈 요약과 자료실은 모든 모듈의 데이터를 모으므로 마지막이다. 워크스페이스의 틀(사이드바의 워크스페이스 이름, 로그인 화면 자리)은 P1에 이미 있다.

---

## 1. 범위 결정과 TECH_STACK.md 수정안

### 1.1 결정 (2026-10-21)

3개 탭 + 관심 기능 8개 전부를 **화면 뼈대**로 만든다. 실데이터 연동(테이블·API·수집기)의 순서와 범위는 TECH_STACK 1장·10장을 그대로 따른다.

| 관심 기능 | TECH_STACK ID | TECH_STACK 분류 | 프로토타입 페이즈 |
| --- | --- | --- | --- |
| 1. 약기법 | A | 핵심 (순서 3) | P2 |
| 2. 시장트렌드분석(GEO) + 경쟁사 비교 | B, C, GEO | 핵심 (순서 4, 5) + 참조 | P3 |
| 3. 리뷰 분석 1: 일본 현지 제품 리뷰 | D | 참조 | P4 |
| 4. 리뷰 분석 2: 한국 리뷰 → 일본어 상세페이지 | F | 참조 | P5 |
| 5. 피부타입 설문조사 | G | 참조 | P7 |
| 6. 진출·홍보 플랫폼별 강점 | H | 참조 | P6 |
| 7. 메가와리/프로모션 캘린더 | I | 참조 | P6 |
| 8. 팀 워크스페이스 데이터베이스 | J | 기반 (순서 1) | P1(틀), P8(홈·자료실) |

### 1.2 TECH_STACK.md 수정안

P1 1단계에서 TECH_STACK.md를 저장소 루트 `CLAUDE.md`로 복사할 때 함께 반영한다.

**1장 — 우선순위 표 바로 아래에 추가**

> **프로토타입 범위 (2026-10-21 결정):** 화면 뼈대(가짜 데이터, 백엔드·API·AI 호출 없음)는 MVP 1~5와 참조 기능(D, F, GEO, G, H, I) 모두 만든다. 계획과 순서는 `docs/prototype-plan.md`를 따른다. 실데이터 연동의 순서와 범위는 이 표 그대로다.

**1장 — 목록 아래 두 번째 항목 수정**

- 기존: "AI 코딩 도구는 참조 기능을 **요청받기 전에 만들지 않는다.**"
- 수정: "AI 코딩 도구는 참조 기능의 **테이블·API·수집기를 요청받기 전에 만들지 않는다.** 화면 뼈대는 `docs/prototype-plan.md`에서 요청된 페이즈 범위 안에서만 만든다."

**4장 — 저장소 구조의 `app/`과 `lib/` 부분 수정**

```
│  ├─ app/
│  │  ├─ (internal)/             # 사내용 root layout (<html lang="ko">)
│  │  │  ├─ (auth)/              # login/, onboarding/
│  │  │  └─ (dashboard)/         # 로그인 필요: market/, reviews/, ad-check/, platforms/, calendar/,
│  │  │                          #   survey-results/, library/, settings/
│  │  ├─ (public)/               # 공개용 root layout (<html lang="ja">)
│  │  │  └─ survey/              # (G) 피부타입 설문, 로그인 불필요
│  │  └─ api/                    # Route Handler (5장) — 프로토타입 단계에서는 만들지 않음
│  ├─ lib/
│  │  ├─ ai/  schemas/  supabase/   # (기존)
│  │  ├─ mock/                   # (프로토타입) 가짜 데이터. 불러올 때 Zod로 검증
│  │  └─ data/                   # 화면이 부르는 읽기 함수. 지금은 mock, 나중에 Supabase
```

이유: 사내 화면(한국어)과 공개 설문(일본어)은 `<html lang>`, 글꼴, 메타데이터가 달라야 하고, 공개 페이지가 사내 화면 코드를 불러오지 않아야 한다. Next.js의 다중 root layout으로 나눈다.

**10장 — 맨 위에 한 줄 추가**

> 화면 뼈대의 순서는 `docs/prototype-plan.md`를 따른다. 이 장은 실데이터 연동 순서다.

**13장 1-1 — "탭 내비게이션"을 "사이드바 내비게이션"으로**

- 수정: "(dashboard) 레이아웃에 사이드바 내비게이션을 만들고, '시장 분석 / 리뷰 분석 / 광고 검토'를 사이드바 상단 그룹으로 둬."
- 이유: 관심 기능 8개까지 들어가면 상단 탭 3개로는 메뉴가 모자란다. 3개 탭은 사이드바 그룹으로 그대로 보인다.

**11장 — 열린 질문 추가:** 이 문서 11장의 "팀·전문가 확인" 목록.

---

## 2. 유저 스토리 맵

김도훈 팀장의 일본 런칭 업무 흐름 순서다. 위에서 아래로 가는 줄이 이 서비스의 뼈대(backbone)다.

| 활동 (업무 흐름 순) | 김도훈 팀장이 묻는 것 | 화면 | 완성 페이즈 |
| --- | --- | --- | --- |
| 1. 시장 파악 | 일본에서 지금 뜨는 카테고리·성분은? AI 검색에서 우리·경쟁 브랜드가 추천되나? | 시장 트렌드, 성분 관심도, AI 검색 노출(GEO) | P3 |
| 2. 경쟁 분석 | 경쟁 제품의 가격·용량·성분·특징은? 우리 제품은 어느 가격대에 놓이나? | 경쟁제품 비교, 제품 상세 | P3 |
| 3. 소구점 도출 | 국내 소비자가 우리 제품을 다시 사는 이유는? 일본 소비자가 경쟁 제품에 불만인 점은? 둘을 겹치면? | 리뷰 가져오기, 리뷰 리포트, 원문 목록, 소구점 찾기 | P4 |
| 4. 고객 이해 | 일본 타깃의 피부타입·고민 분포는? | 공개 설문, 응답 집계 | P7 |
| 5. 메시지 작성·검토 | 이 문구를 일본 광고에 써도 되나? 대체 문구는? 국내 리뷰를 일본 상세페이지에 써도 되나? | 새 검토, 검토 이력, 검토 상세, 상세페이지용 리뷰 번역 | P2, P5 |
| 6. 채널 선택 | 어느 플랫폼부터 들어가나? 플랫폼별 강점은? | 플랫폼별 강점, 플랫폼 상세 | P6 |
| 7. 프로모션 실행 | 다음 메가와리까지 무엇을 언제까지 준비하나? | 프로모션 캘린더 | P6 |
| 8. 출시 후 점검 | 일본 현지 리뷰 반응은? AI 검색 노출이 바뀌었나? | 리뷰 리포트(일본 현지·자사), AI 검색 노출 | P4, P3 |
| 공통: 팀 운영 | 이번 주 할 일은? 지난 결과를 다시 찾으려면? 팀원은 누구? | 홈, 자료실, 설정, 로그인, 워크스페이스 시작 | P1(틀), P8 |

**Walking skeleton:** P1이 끝나면 이 표의 모든 줄이 "모양은 있지만 거의 빈" 화면을 하나 이상 갖는다. P2~P8은 줄을 하나씩 두껍게 만든다. 탭 하나를 끝까지 완성하고 다음 탭으로 넘어가는 방식과 반대다.

---

## 3. 사이트맵과 라우트

### 3.1 두 개의 사이트

| | 사내 대시보드 | 공개 설문 |
| --- | --- | --- |
| 사용자 | 해외사업팀 | 일본 소비자 |
| 언어 | 한국어 (일본어 데이터는 한국어 해석 병기) | 일본어 |
| 기기 | PC 우선 (1280px 기준, 1024px까지 깨지지 않게) | 모바일 우선 (375px 기준) |
| 로그인 | 필요 (프로토타입은 가짜 로그인) | 없음 |
| root layout | `app/(internal)/layout.tsx` · `<html lang="ko">` | `app/(public)/layout.tsx` · `<html lang="ja">` |

### 3.2 사이드바

내비게이션의 단일 출처는 `components/layout/nav-config.ts`다 (라벨·경로·그룹·기획안 기능 ID·페이즈).

```
홈                               /
시장 분석 (TAB 1)
  ├ 시장 트렌드                   /market/trends
  ├ 성분 관심도                   /market/ingredients
  ├ AI 검색 노출 (GEO)            /market/geo
  └ 경쟁제품 비교                 /market/competitors
리뷰 분석 (TAB 2)
  ├ 리뷰 리포트                   /reviews
  ├ 소구점 찾기                   /reviews/compare
  └ 리뷰 가져오기                 /reviews/import
광고 검토 (TAB 3)
  ├ 새 검토                       /ad-check
  └ 검토 이력                     /ad-check/history
진출 실행
  ├ 플랫폼별 강점                 /platforms
  └ 프로모션 캘린더               /calendar
소비자 설문
  ├ 응답 집계                     /survey-results
  └ 공개 설문 열기 ↗              /survey  (새 탭)
──────────
자료실                            /library
설정                              /settings
```

### 3.3 파일 구조 (`apps/web/app/`)

```
app/
├─ (internal)/
│  ├─ layout.tsx                         # <html lang="ko">, 글꼴
│  ├─ (auth)/
│  │  ├─ layout.tsx                      # 가운데 카드
│  │  ├─ login/page.tsx                  # /login
│  │  └─ onboarding/page.tsx             # /onboarding
│  └─ (dashboard)/
│     ├─ layout.tsx                      # 사이드바 + 상단바 (K)
│     ├─ page.tsx                        # /
│     ├─ market/
│     │  ├─ page.tsx                     # /market → /market/trends 리다이렉트
│     │  ├─ trends/page.tsx
│     │  ├─ ingredients/page.tsx
│     │  ├─ geo/page.tsx
│     │  └─ competitors/
│     │     ├─ page.tsx
│     │     └─ [productId]/page.tsx
│     ├─ reviews/
│     │  ├─ page.tsx
│     │  ├─ import/page.tsx
│     │  ├─ compare/page.tsx
│     │  └─ [productId]/
│     │     ├─ page.tsx
│     │     ├─ list/page.tsx
│     │     └─ translate/page.tsx
│     ├─ ad-check/
│     │  ├─ page.tsx
│     │  ├─ history/page.tsx
│     │  └─ [checkId]/page.tsx
│     ├─ platforms/
│     │  ├─ page.tsx
│     │  └─ [platformId]/page.tsx
│     ├─ calendar/page.tsx
│     ├─ survey-results/page.tsx
│     ├─ library/page.tsx
│     └─ settings/page.tsx
└─ (public)/
   ├─ layout.tsx                         # <html lang="ja">, 모바일 우선
   └─ survey/
      ├─ page.tsx                        # /survey
      ├─ questions/page.tsx
      ├─ result/page.tsx
      └─ privacy/page.tsx
```

- 동적 라우트(`[productId]`, `[checkId]`, `[platformId]`)는 `generateStaticParams`로 가짜 데이터의 ID를 모두 미리 생성한다. 그러면 `npm run build`가 모든 화면을 실제로 한 번씩 렌더링해 본다 (10.1).
- 정적 세그먼트(`import`, `compare`)는 `[productId]`보다 우선한다. 제품 ID는 uuid라 겹치지 않는다.
- 다중 root layout이라 전역 404 화면은 따로 설정해야 한다. P1에서는 Next.js 기본 404를 쓴다.

---

## 4. 화면 템플릿과 인벤토리

### 4.1 템플릿 7종 (`components/templates/`)

| 템플릿 | 구성 | 쓰는 화면 |
| --- | --- | --- |
| T1 요약 | 숫자 카드 줄 + 목록 위젯 2~3개 | 홈, 응답 집계(상단) |
| T2 표 | 필터 바 + 표(또는 카드) + 행을 누르면 상세(옆 패널 또는 상세 페이지) | 경쟁제품 비교, 리뷰 리포트 목록, 리뷰 가져오기, 원문 목록, 검토 이력, 플랫폼별 강점(카드 보기), 자료실 |
| T3 차트 리포트 | 필터(기간·카테고리·출처) + 차트 카드 격자 + 항목을 누르면 근거 패널 | 시장 트렌드, 성분 관심도, GEO, 리뷰 리포트, 소구점 찾기, 응답 집계 |
| T4 문구 검토 | 입력 패널 + 결과 패널(표시가 달린 원문, 항목 카드, 승인 바) | 새 검토, 상세페이지용 리뷰 번역 |
| T5 캘린더 | 월/목록 보기 + 필터 + 일정 패널 | 프로모션 캘린더 |
| T6 단계형 폼 | 진행 바 + 한 화면 한 단계 + 이전/다음 + 결과 | 워크스페이스 시작, 공개 설문(시작·문항·결과) |
| T7 상세 | 헤더(이름·배지·출처) + 속성 목록 + 섹션 + 관련 항목 | 로그인(카드 변형), 제품 상세, 검토 상세, 플랫폼 상세, 설정, 개인정보 안내 |

모든 템플릿은 `state: 'ready' | 'empty' | 'loading' | 'error'`를 받아 4.2의 상태 컴포넌트를 보여준다. 주소에 `?state=empty`처럼 붙이면 어느 화면이든 그 상태로 강제할 수 있다 (상단바의 개발용 메뉴로도 전환).

### 4.2 공통 컴포넌트 (`components/common/`)

| 컴포넌트 | 하는 일 |
| --- | --- |
| SampleDataBadge + 상단 배너 | "샘플 데이터 · 저장되지 않음" 표시 |
| EmptyState | 비었을 때 다음 행동 버튼 (예: "리뷰 CSV 올리기") |
| LoadingState | Skeleton + 단계·진행률 (예: "50건 묶음 중 2번째 분석 중") |
| ErrorState | 무엇이 실패했는지 + 다시 시도 |
| AiDisclaimer | "법률 자문이 아닌 검토 보조 결과이며 최종 판단은 담당자·전문가가 한다" (TECH_STACK 7장 5번). 결과 상단에 고정 |
| AiResultMeta | 모델·프롬프트 버전·생성 시각 (TECH_STACK 5장 규칙: AI 결과에 model, prompt_version) |
| EvidenceSheet | 인사이트·성분·브랜드 언급을 누르면 근거 원문 목록을 여는 옆 패널 |
| RiskBadge, SentimentBadge, StatusBadge, LangBadge, SourceBadge | 위험도, 감성, 검토 상태, ko/ja, 출처 플랫폼. 색만으로 구분하지 않고 아이콘·글자를 함께 쓴다 |
| FeatureTag | 화면 제목 옆의 기획안 기능 ID (A, B…). 테스트·리뷰 때 추적용, 정식 출시 전 제거 |

### 4.3 화면 인벤토리 (27개 + 리다이렉트 1)

`chart`는 shadcn/ui의 Recharts 래퍼다.

| # | 화면 | 라우트 | 템플릿 | 주요 shadcn/ui | 가짜 데이터 | 기획안 기능 | 완성 페이즈 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 로그인 | `/login` | T7 (카드) | card, input, button | — | J | P8 |
| 2 | 워크스페이스 시작 | `/onboarding` | T6 | card, tabs, input | workspace | J | P8 |
| 3 | 홈 | `/` | T1 | card, badge, separator | 전 모듈 요약, activity | J, K | P8 |
| 4 | 시장 트렌드 | `/market/trends` | T3 | chart, select, tabs, table | trends | B | P3 |
| 5 | 성분 관심도 | `/market/ingredients` | T3 | chart, sheet, badge | trends, products | B | P3 |
| 6 | AI 검색 노출 (GEO) | `/market/geo` | T3 | table, chart, sheet | geo | GEO | P3 |
| 7 | 경쟁제품 비교 | `/market/competitors` | T2 | table, checkbox, sheet, input | products | C | P3 |
| 8 | 제품 상세 | `/market/competitors/[productId]` | T7 | card, badge, tabs | products | C | P3 |
| 9 | 리뷰 리포트 목록 | `/reviews` | T2 | card, toggle-group, badge | products, review-insights | E, D | P4 |
| 10 | 리뷰 가져오기 | `/reviews/import` | T2 | tabs, input, table, progress | reviews (샘플 CSV) | E | P4 |
| 11 | 소구점 찾기 | `/reviews/compare` | T3 | chart, select, sheet | review-insights (ko·ja) | E, D | P4 |
| 12 | 리뷰 리포트 | `/reviews/[productId]` | T3 | chart, sheet, badge, toggle-group | reviews, review-analyses, review-insights | E, D | P4 |
| 13 | 리뷰 원문 목록 | `/reviews/[productId]/list` | T2 | table, select, input | reviews, review-analyses | E, D | P4 |
| 14 | 상세페이지용 리뷰 번역 | `/reviews/[productId]/translate` | T4 | checkbox, card, button, tooltip | reviews, review-translations, ad-checks | F | P5 |
| 15 | 새 광고 검토 | `/ad-check` | T4 | textarea, toggle-group, select, card, alert | ad-checks | A | P2 |
| 16 | 검토 이력 | `/ad-check/history` | T2 | table, select, badge | ad-checks, workspace | A | P2 |
| 17 | 검토 상세 | `/ad-check/[checkId]` | T7 | card, badge, textarea | ad-checks | A | P2 |
| 18 | 플랫폼별 강점 | `/platforms` | T2 (카드 보기) | card, tabs, badge | platforms | H | P6 |
| 19 | 플랫폼 상세 | `/platforms/[platformId]` | T7 | card, textarea, badge | platforms, promo-events | H | P6 |
| 20 | 프로모션 캘린더 | `/calendar` | T5 | FullCalendar(P6), sheet, select | promo-events, ad-checks | I | P6 |
| 21 | 설문 응답 집계 | `/survey-results` | T1 + T3 | card, chart, button | survey | G | P7 |
| 22 | 자료실 | `/library` | T2 | table, input, select | 전 모듈 (파생) | J | P8 |
| 23 | 설정 | `/settings` | T7 | card, table, input | workspace | J | P8 |
| 24 | 설문 시작 (ja) | `/survey` | T6 | card, checkbox, button | survey (문항) | G | P7 |
| 25 | 설문 문항 (ja) | `/survey/questions` | T6 | radio-group, progress, button | survey (문항) | G | P7 |
| 26 | 설문 결과 (ja) | `/survey/result` | T6 | card, badge | survey (결과 유형) | G | P7 |
| 27 | 개인정보 안내 (ja) | `/survey/privacy` | T7 | — | 고정 문구 | G | P7 |
| — | (리다이렉트) | `/market` → `/market/trends` | — | — | — | — | P1 |

---

## 5. 페이즈 계획

각 페이즈 끝에는 10.1 기계 검증을 모두 통과해야 하고, 해당 실무자 과제(10.3)를 한 번 돌린 뒤 다음 페이즈 순서를 다시 본다.

### P1 — Walking skeleton

- **확인할 질문:** 메뉴 구조가 업무 흐름과 맞나? 김도훈 팀장(또는 비슷한 실무자)이 원하는 기능을 첫 클릭에 찾나?
- **만드는 것:** 6장 전체.
- **완료 기준:** 10.1 전부 통과 + 첫 클릭 테스트 8문항(10.3) 준비 완료.

### P2 — 약기법 광고 검토 (A · 관심 1)

- **확인할 질문:** 담당자가 위험 표현·사유·근거·대체 표현을 보고, 원문에서 무엇이 왜 바뀌는지 이해한 뒤 승인/반려를 결정할 수 있나? 한국어 문구를 넣었을 때 "번역 → 검토" 흐름이 자연스러운가?
- **화면:** 새 검토, 검토 이력, 검토 상세
- **핵심 상호작용**
  - 입력: 문구, 언어(ko/ja), 제품 구분(一般化粧品 / 医薬部外品), 사용처(상세페이지·SNS·광고 배너·설문 결과). 같은 문구라도 제품 구분에 따라 판정이 달라진다 (8장 제안 3).
  - 진행 상태: TECH_STACK 7장의 판단 단계 순서로 보여준다 (효능 범위 → 의약품적 표현 → 최상급·보증 표현).
  - 결과: AiDisclaimer 고정, 전체 위험도, 원문 위 위험 표현 표시(위험도별 색 + 아이콘). 표시를 누르면 사유·근거(조항)·대체 표현 카드가 열리고, 대체 표현을 고르면 원문 미리보기에 바로 반영된다. 현지화 메모(localized_note)도 함께.
  - 한국어 입력이면 일본어 번역문과 한국어 역번역을 나란히 보여준다 (기획안 TAB 3 페인포인트 "번역 과정에서 뉘앙스가 달라짐").
  - 승인 바: 승인 / 반려 / 메모 / 최종 문구. 로컬 상태로만 바뀌고 "저장되지 않음"을 표시한다.
  - "위험 표현 없음" 결과도 근거와 함께 따로 디자인한다.
- **가짜 데이터:** 검토 10건. 효능 범위 안 문구(문제 없음), 의약품적 표현(「シミが消える」「ニキビが治る」 등), 한국 기능성 화장품 클레임(미백·주름 개선)을 일본 一般化粧品에 그대로 쓴 경우, 최상급·No.1 표현, 안전성 보증(「副作用なし」 등), 의사·전문가 추천, 체험담 형식의 효능 표현. 상태는 대기·승인·반려를 섞는다.
  - 출처: 厚生労働省 「化粧品の効能の範囲」(56項目), 日本化粧品工業会(JCIA) 「化粧品等の適正広告ガイドライン」, 厚生労働省 「医薬品等適正広告基準」. 각 예시의 `basis` 칸에 조항을 적는다.
  - 가이드라인 판: 확인된 최신 정식판은 2020년판이고, 2026년 7월자 개정 α판(초안)이 공개돼 있다. 정식판이 됐는지 확인한다 (11장).
- **완료 기준:** 과제 T1 수행 가능. 같은 표현이 두 번 나와도 위험 표현 표시가 원문 위치와 정확히 일치. 스크롤해도 면책 문구가 보임. 예시 10건의 판정이 원문 조항과 대조됨 (10.4).

### P3 — 시장 분석 (B, C, GEO · 관심 2)

- **확인할 질문:** 비교표의 열만으로 자사 가격 포지셔닝을 정할 수 있나? GEO 화면을 보고 "우리가 말한 GEO가 이것인가"를 확인한다 (TECH_STACK 11장 첫 질문 해소).
- **화면:** 시장 트렌드, 성분 관심도, AI 검색 노출(GEO), 경쟁제품 비교, 제품 상세
- **핵심 상호작용**
  - 시장 트렌드: 카테고리(化粧水·美容液·クリーム·シートマスク 등) 선택 → 12주간 랭킹 상위권의 K-뷰티 비중 추이, 이번 주 랭킹 표, 급상승 상품.
  - 성분 관심도: 랭킹 상품명·설명에 나온 성분 빈도(TECH_STACK 13장 5번의 정의) 막대 + 추이 선. 성분을 누르면 해당 상품 목록 패널. 자사 제품에 든 성분은 따로 표시.
  - GEO: 일본어 질의(예: 「乾燥肌におすすめの韓国スキンケア」) × AI 엔진 표에 언급 여부, 자사·경쟁 언급 점유율, 답변 원문 패널에서 브랜드 표시, 측정 일시.
  - 경쟁제품 비교: 행 = 제품(자사 행 고정·강조), 열 = 판매 플랫폼, 税込 가격, 용량, ml당 가격(화면에서 계산), 주요 성분, 특징, 평점·리뷰 수. 2~4개를 골라 나란히 비교. 등록 패널: URL 또는 이미지 → "추출 결과(샘플)" → 사람이 고치는 폼 (TECH_STACK 13장 4번).
  - 제품 상세: 全成分, 특징, 출처 링크, 추출 원본(source_raw) 보기.
- **가짜 데이터:** 자사 3 + 경쟁 8 제품(가상 브랜드), 3개 카테고리 × 12주 랭킹 스냅샷, 성분 10개 추이, GEO 질의 5 × 엔진 3.
  - 출처: 楽天ランキング 화면의 항목 구성, Qoo10·楽天·@cosme 상세페이지의 표기 방식(세금 포함 총액 표시, 용량 단위, 全成分 순서), 실제 AI 검색 답변의 형식.
- **완료 기준:** 과제 T2 수행 가능. ml당 가격이 계산되고 정렬됨. GEO 해석 확인 결과를 TECH_STACK 11장에 기록.

### P4 — 리뷰 분석 (E, D · 관심 3)

- **확인할 질문:** 차트(감성·키워드·불만 유형·재구매 요인)에서 근거 원문까지 내려가 "일본 상세페이지에 쓸 소구점"을 뽑을 수 있나? 국내 리뷰와 일본 현지 리뷰를 같은 틀로 읽을 수 있나?
- **화면:** 리뷰 리포트 목록, 리뷰 가져오기, 리뷰 리포트, 리뷰 원문 목록, 소구점 찾기
- **핵심 상호작용**
  - 리뷰 가져오기: CSV 탭은 Papa Parse로 **브라우저에서만** 읽어 미리보기와 열 매핑(상품명·평점·본문·작성일, TECH_STACK 13장 2-1)을 보여주고 "저장 안 됨"을 표시한다. 플랫폼 수집 탭은 상품 URL 목록과 마지막 수집 시각(샘플). 분석 진행률은 50건 묶음 단위로 보여준다.
  - 리뷰 리포트: 감성 도넛, 키워드 막대(성분·사용감·가격·향·피부 반응 필터 — 기획안 TAB 2), 불만 유형 막대, 재구매 요인 목록. 어느 항목이든 누르면 EvidenceSheet에 근거 리뷰 원문이 열린다.
  - 일본어 리뷰: 원문 + 한국어 해석 병기. 키워드·불만 라벨도 일본어/한국어 둘 다 (8장 제안 7).
  - 원문 목록: 감성·키워드·평점·작성자 속성(연령대·피부타입) 필터, 검색.
  - 소구점 찾기: 한쪽에 "국내 리뷰에서 칭찬받는 점(자사)", 다른 쪽에 "일본 리뷰에서 불만인 점(경쟁)", 둘이 겹치는 항목을 소구점 후보로 보여준다. 각 항목에서 근거로 이동 (기획안 TAB 2 기대 효과 "마케팅 소구점 도출").
- **가짜 데이터:** 국내 리뷰 40건(자사 제품 3개), 일본 리뷰 30건(경쟁 제품 2개 + 출시 후 자사 1개). 분석·인사이트는 리뷰와 맞물리게 만든다 (근거 ID가 실제 가짜 리뷰를 가리킴).
  - 출처: 올리브영 리뷰 화면(평점, 피부타입·피부고민 태그), @cosme·楽天 리뷰 화면(연령대·肌質 표시). 평점 척도는 플랫폼마다 다를 수 있다 (@cosme는 5점이 아닌 7점 척도로 알려져 있으나 확인 필요).
  - 실제 리뷰를 복사하지 않고, 패턴을 참고해 새로 쓴다 (TECH_STACK 0장: 실제 리뷰 원문 대량 커밋 금지).
- **완료 기준:** 과제 T3 수행 가능. 모든 근거 ID가 실제 가짜 리뷰를 가리킴 (빌드 때 검사). 국내/일본 전환 시 같은 화면 틀 유지.

### P5 — 리뷰 번역 → 상세페이지 블록 (F · 관심 4)

- **확인할 질문:** "리뷰 고르기 → 일본어 번역 → 약기법 검토 → 승인 → 상세페이지 블록 복사"에서, 승인 전에는 복사할 수 없다는 관문을 이해하고 받아들이나?
- **화면:** 상세페이지용 리뷰 번역 (리뷰 리포트의 "상세페이지용 리뷰 만들기" 버튼으로 들어감)
- **핵심 상호작용**
  - 리뷰 고르기: 재구매 요인·긍정 근거가 된 리뷰가 위로 (P4 데이터 재사용).
  - 번역: 일본어 번역 + 한국어 역번역 + 약기법 결과 (P2의 결과 패널을 그대로 재사용).
  - 블록 미리보기: 일본어 리뷰 카드(별점, 연령대·피부타입, 체험담 주석 자리). 주석이 위험 표현을 면책하지 않는다는 점은 가이드라인 원문으로 확인한다 (10.4).
  - 내보내기: "HTML 복사" 버튼은 승인 전 비활성 + 이유 툴팁 (TECH_STACK 13장 F). 이미지 내보내기는 범위 밖 (9장).
- **가짜 데이터:** 번역 10건(초안·검토 중·승인). 그중 2건은 위험 표현 포함.
- **완료 기준:** 승인 전 복사 불가. 승인 후 복사한 HTML이 미리보기와 같음. 열린 질문 "국내 리뷰를 일본 상세페이지에 게시할 권리"(11장)가 팀에 전달됨.

### P6 — 플랫폼별 강점 + 프로모션 캘린더 (H, I · 관심 6, 7)

- **확인할 질문:** 플랫폼별 강점을 비교해 진출 순서를 정할 수 있나? 행사 일정에서 거꾸로 계산한 준비 마감을 놓치지 않게 볼 수 있나?
- **화면:** 플랫폼별 강점, 플랫폼 상세, 프로모션 캘린더
- **핵심 상호작용**
  - 플랫폼별 강점: 그룹(판매 EC / 리뷰·SNS 홍보 / 오프라인 버라이어티숍) 카드 — 강점, 주 고객층, 수수료 메모, 주요 행사, 우리 상태(검토·준비·입점). 표 보기로 전환해 비교.
  - 플랫폼 상세: 메모 편집(로컬 상태), 마지막 수정자, 이 플랫폼의 다가오는 행사.
  - 캘린더: 월·목록 보기, 플랫폼별 색과 필터, 행사 기간 막대 + 준비 마감 표시(D-day). 일정 패널에서 관련 광고 검토 상태를 보여준다 ("행사용 문구 승인됨 / 대기").
- **가짜 데이터:** 플랫폼 11개(Qoo10, 楽天市場, Amazon.co.jp, Yahoo!ショッピング, @cosme SHOPPING, LIPS, Instagram, X, TikTok, LINE, 버라이어티숍(ロフト·PLAZA 등)). 강점·고객층 문구는 "샘플", 수수료 수치는 비워 둔다. 앞으로 6개월 행사 12건.
  - 출처: Qoo10 メガ割(연 4회 개최, 최근 회차 2026-08-28~09-09 — 다음 회차는 공식 공지로 확인), 楽天スーパーSALE, Amazon 대형 세일의 공식 공지. 날짜는 패턴만 반영한 샘플이다.
  - 라이브러리: FullCalendar. TECH_STACK 2장 "참조 기능을 만들 때 추가"에 I용으로 이미 있다 (daygrid·list·interaction 등 무료 플러그인만).
- **완료 기준:** 과제 T4 수행 가능. 수수료 등 틀리면 해가 되는 수치 칸은 공식 자료 전까지 비어 있음.

### P7 — 피부타입 설문 (G · 관심 5) — 병렬 트랙

- **확인할 질문:** 일본 소비자가 휴대폰에서 동의 → 문항 → 결과까지 끝까지 답하나? 팀은 집계에서 타깃 피부타입·고민을 읽어낼 수 있나?
- **화면:** 설문 시작, 설문 문항, 설문 결과, 개인정보 안내(모두 일본어), 설문 응답 집계(대시보드)
- **핵심 상호작용**
  - 시작: 소요 시간, 이용 목적, 동의 체크 없이는 시작 불가, 개인정보 안내 링크.
  - 문항: 한 화면 한 문항, 진행 바, 이전으로. 8~10문항(세안 후 당김, T존 유분, 트러블 빈도, 자극 반응, 연령대, 고민 등).
  - 결과: 피부타입(예: 乾燥肌·脂性肌·混合肌·普通肌·敏感肌) + 관리 팁. 제품을 추천하면 그 문구는 광고이므로 P2 검토 대상이다.
  - 응답 집계: 응답 수, 피부타입 분포, 연령대 × 고민 교차, 설문 링크 복사.
- **가짜 데이터:** 문항 세트(일본어), 응답 120건 집계.
- **외부 의존 (P1 직후 요청):** 일본어 원어민 검수, 개인정보 문구 확인(APPI), 피부타입 분류 기준.
- **완료 기준:** 과제 T5 수행 가능. 375px에서 가로 스크롤 없음. `<html lang="ja">`. 동의 전 시작 불가. 원어민 검수 통과.

### P8 — 워크스페이스 홈·자료실·설정 (J · 관심 8)

- **확인할 질문:** 팀장이 홈에서 이번 주 할 일(승인 대기 문구, 다가오는 준비 마감, 새 분석 결과)을 1분 안에 말할 수 있나? 팀원이 지난 결과를 자료실에서 찾아 다시 쓰나?
- **화면:** 홈, 자료실, 설정, 로그인, 워크스페이스 시작
- **핵심 상호작용**
  - 홈: 숫자 카드(승인 대기 N건, 다음 행사 D-day, 이번 주 새 리뷰, 설문 응답 수), 내 할 일, 팀 활동 피드.
  - 자료실: 모든 결과(검토 이력, 리뷰 리포트, 비교표, 번역 블록, GEO 측정)를 한곳에서 검색·필터(유형·제품·플랫폼·상태·작성자·기간)하고 원래 화면으로 이동. "팀 워크스페이스 데이터베이스"가 사용자에게 보이는 모습이다.
  - 설정: 워크스페이스 이름, 팀원과 역할(owner/member), 초대 코드(가짜).
  - 로그인·워크스페이스 시작: 이메일 로그인 모양, 워크스페이스 만들기 / 초대 코드로 참여 (TECH_STACK 13장 1-2).
- **가짜 데이터:** 팀원 4명, 활동 30건. 자료실은 다른 가짜 데이터에서 파생.
- **완료 기준:** 10.3 보조 과제(홈에서 오늘 할 일 3가지 말하기, 자료실에서 반려된 문구 찾기) 수행 가능.

---

## 6. Phase 1 상세

### 6.1 작업 순서

1. **저장소 준비:** `git init`, `.gitignore`(`.env*`, `node_modules`, `.next`). TECH_STACK.md를 루트 `CLAUDE.md`로 복사하고 1.2 수정안 반영.
2. **`apps/web` 생성:** create-next-app (TypeScript, App Router, Tailwind, ESLint, `src/` 폴더 없음, npm). `package.json`에 `"typecheck": "tsc --noEmit"` 추가, `tsconfig.json`의 strict 확인.
3. **shadcn/ui:** init 후 컴포넌트 추가 — sidebar, button, card, badge, table, tabs, sheet, dialog, input, textarea, select, toggle-group, checkbox, radio-group, tooltip, skeleton, progress, alert, separator, scroll-area, dropdown-menu, chart.
4. **root layout 2개와 글꼴:** `next/font`로 Noto Sans KR·Noto Sans JP (CJK 글꼴이라 preload 끔). `globals.css`에 `:lang(ko) { word-break: keep-all }`, `:lang(ja) { line-break: strict }`. 색 토큰: 위험도(high·medium·low), 감성(positive·negative·neutral), 검토 상태(pending·approved·rejected).
5. **내비게이션:** `nav-config.ts` → AppSidebar, TopBar(워크스페이스 이름, 샘플 데이터 배너, 개발용 상태 전환 메뉴), PageHeader(제목·설명·FeatureTag).
6. **`lib/schemas/`:** TECH_STACK 5장 테이블과 7장 AI 응답 모양의 Zod 스키마. 8장 제안 필드는 optional로 넣고 `// 제안: docs/prototype-plan.md 8장` 주석을 단다.
7. **`lib/mock/`:** 화면이 모양을 보일 만큼의 최소 가짜 데이터 (6.4). 모듈을 불러올 때 Zod로 parse하고, `index.ts`에서 교차 참조를 검사한다.
8. **`lib/data/`:** 화면이 부르는 async 읽기 함수 (6.5). 지금은 mock을 돌려주고, 나중에 같은 시그니처의 Supabase 쿼리로 바꾼다.
9. **공통 컴포넌트** (4.2).
10. **템플릿 7종 골격** (4.1). 각각 `state` prop으로 4가지 상태.
11. **화면 27개 + `/market` 리다이렉트:** 각 페이지 = PageHeader + 템플릿 + 최소 가짜 데이터. 동적 라우트는 `generateStaticParams`.
12. **검증** (10.1) 후 첫 클릭 테스트 준비 (10.3).

### 6.2 Phase 1에서 각 화면에 보이는 것

| 라우트 | Phase 1에서 보이는 것 |
| --- | --- |
| `/login` | 이메일·비밀번호 칸 모양, "로그인"을 누르면 `/`로 이동 (인증 없음) |
| `/onboarding` | "워크스페이스 만들기 / 초대 코드로 참여" 두 단계 |
| `/` | 숫자 카드 4개 자리, "할 일"·"최근 활동" 목록 자리 |
| `/market/trends` | 카테고리 선택 + 차트 카드 2개 + 랭킹 표 3행 |
| `/market/ingredients` | 성분 막대 차트(성분 5개) + 근거 패널 열기 |
| `/market/geo` | 질의 × 엔진 표 2행 + 답변 패널 |
| `/market/competitors` | 비교표 4행(자사 1 + 경쟁 3) + 등록 패널 골격 |
| `/market/competitors/[productId]` | 제품 속성 목록 + 全成分 섹션 |
| `/reviews` | 제품별 리포트 카드 + 국내/일본 전환 |
| `/reviews/import` | CSV / 플랫폼 수집 탭, 빈 미리보기 표, 진행률 막대 |
| `/reviews/compare` | 두 열(국내 강점 / 일본 불만) 목록 자리 |
| `/reviews/[productId]` | 차트 카드 4개(감성·키워드·불만·재구매) + 근거 패널 |
| `/reviews/[productId]/list` | 리뷰 표 5행 + 필터 바 |
| `/reviews/[productId]/translate` | 세 칸(리뷰 고르기 / 번역·검토 / 블록 미리보기) 골격, 복사 버튼 비활성 |
| `/ad-check` | 입력 패널 + 결과 패널 골격, AiDisclaimer 고정 |
| `/ad-check/history` | 이력 표 4행 + 상태 필터 |
| `/ad-check/[checkId]` | 원문·최종 문구·판정·검토 기록 섹션 |
| `/platforms` | 그룹별 카드 4개 |
| `/platforms/[platformId]` | 속성 목록 + 메모 칸 |
| `/calendar` | 다가오는 행사 목록 4건 (월 보기는 P6에서 FullCalendar로) |
| `/survey-results` | 숫자 카드 + 분포 차트 자리 + 설문 링크 |
| `/library` | 통합 표 + 유형 필터 |
| `/settings` | 워크스페이스 이름 + 팀원 표 |
| `/survey` | 일본어 소개 + 동의 체크 + 시작 버튼 |
| `/survey/questions` | 문항 2개짜리 단계 폼 + 진행 바 |
| `/survey/result` | 결과 카드 1개 |
| `/survey/privacy` | 개인정보 안내 자리 문구 |

### 6.3 Phase 1에서 만드는 파일

```
marketing-prototype/
├─ CLAUDE.md                     # TECH_STACK.md 복사 + 1.2 수정안
├─ .gitignore
├─ docs/prototype-plan.md        # 이 문서
└─ apps/web/
   ├─ app/                       # 3.3
   ├─ components/
   │  ├─ ui/                     # shadcn/ui 생성물
   │  ├─ layout/                 # app-sidebar.tsx, top-bar.tsx, page-header.tsx, nav-config.ts
   │  ├─ common/                 # (실제) ai.tsx, badges.tsx, evidence-list.tsx, states.tsx, view-state.tsx
   │  │                          #   — 4.2의 부품들을 이 파일들에 묶어 두었다
   │  └─ templates/              # (실제) index.tsx 하나에 템플릿 7종
   ├─ lib/
   │  ├─ schemas/                # common.ts, workspace.ts, product.ts, review.ts, ad-check.ts,
   │  │                          # trend.ts, geo.ts, promo.ts, platform.ts, survey.ts, activity.ts
   │  ├─ mock/                   # 6.4
   │  └─ data/                   # 6.5
   └─ package.json, tsconfig.json, components.json 등 (생성물)
```

### 6.4 가짜 데이터 파일 (`lib/mock/`)

| 파일 | P1 최소 분량 | 이후 분량 | 스키마 (TECH_STACK 5·7장) |
| --- | --- | --- | --- |
| `workspace.ts` | 워크스페이스 1, 팀원 4 | — | workspaces, workspace_members |
| `products.ts` | 자사 1 + 경쟁 3 | 자사 3 + 경쟁 8 (P3) | products |
| `reviews.ts` | 국내 5 + 일본 5 | 국내 40 + 일본 30 (P4) | reviews |
| `review-analyses.ts` | 리뷰 수만큼 | 〃 | review_analyses (7장 리뷰 JSON) |
| `review-insights.ts` | 제품 1개 분 | 제품별 (P4) | review_insights |
| `review-translations.ts` | 2 | 10 (P5) | review_translations |
| `ad-checks.ts` | 4 (상태별 1개 이상) | 10 (P2) | ad_checks + 7장 약기법 JSON |
| `trends.ts` | 1 카테고리 × 4주 | 3 × 12주 (P3) | trend_snapshots |
| `geo.ts` | 질의 2 × 엔진 2 | 5 × 3 (P3) | geo_snapshots |
| `promo-events.ts` | 4 | 12 (P6) | promo_events |
| `platforms.ts` | 4 | 11 (P6) | platform_notes |
| `survey.ts` | 문항 2 + 집계 1 | 문항 8~10 + 응답 120 (P7) | skin_survey_responses + 문항 설정 |
| `activity.ts` | 5 | 30 (P8) | (8장 제안 14) activity_log |
| `index.ts` | 교차 참조 검사: `reviews.product_id`, `review_insights.evidence_review_ids`, `review_translations.ad_check_id` 등이 모두 존재하는 ID인지 | | |

### 6.5 읽기 함수 (`lib/data/`)

```
getWorkspace(), getMembers()
getProducts({ kind? }), getProduct(id)
getReviews({ productId, lang?, sentiment? }), getReviewReport(productId), getAppealCandidates()
getReviewTranslations(productId)
getAdChecks({ status? }), getAdCheck(id)
getTrendSnapshots({ category }), getIngredientInterest({ category })
getGeoSnapshots()
getPromoEvents({ from, to, platform? })
getPlatforms(), getPlatform(id)
getSurveyQuestions(), getSurveySummary()
getLibraryItems({ type?, q? }), getActivity()
```

규칙: 화면은 `lib/mock/`을 직접 import하지 않고 `lib/data/`만 부른다. 나중에 Supabase로 바꿀 경계를 한 곳으로 모으기 위해서다.

### 6.6 Phase 1의 기본값 (바꾸려면 말만 하면 됨)

- **내비게이션:** 상단 탭 대신 사이드바 (1.2의 13장 1-1 수정안).
- **상태 변경**(승인·반려, 메모 수정, 일정 추가): 클라이언트 로컬 상태로만 처리하고 "저장되지 않음" 배너를 띄운다. 페이지를 넘어가도 유지돼야 하는 테스트 과제가 생기면 그때 sessionStorage를 추가한다.
- **상태 화면:** 모든 템플릿이 `?state=empty|loading|error`를 지원한다.
- **화면 폭:** 데스크톱 1280px 기준(1024px까지 깨지지 않게). 다크 모드는 범위 밖.
- **가짜 데이터 브랜드:** 가상 브랜드 + 실제 플랫폼 표기 방식 (11장 결정 1).

---

## 7. 가짜 데이터 원칙과 출처

**원칙**

1. 모양은 TECH_STACK 5·7장에서, 내용은 실제 원자료의 형식에서 가져온다. 빈 상자는 사용자 테스트에서 아무것도 확인해 주지 않는다.
2. 실제 리뷰·상품 정보를 복사하지 않는다. 형식과 패턴만 따라 새로 쓴다 (TECH_STACK 0장 커밋 금지 규칙, 저작권).
3. 모든 화면에 "샘플 데이터"를 표시한다. 수수료·행사 날짜처럼 틀리면 해가 되는 수치는 비우거나 "샘플"로 표시한다.
4. 불러올 때 Zod 검증 + 교차 참조 검사를 한다. 잘못된 가짜 데이터는 빌드에서 걸린다.

| 데이터 | 형식을 따를 원자료 | 주의 |
| --- | --- | --- |
| 약기법 판정 예시 | 「化粧品の効能の範囲」(56項目), 「化粧品等の適正広告ガイドライン」(JCIA), 「医薬品等適正広告基準」 | 조항 단위로 OK/NG 문구 쌍을 뽑고 `basis`에 조항 표기. 원문 대조로 검증 (10.4) |
| 경쟁제품 | Qoo10·楽天·@cosme 상세페이지 | 세금 포함 총액 가격, 용량, 全成分 표기 방식만 따른다. 가상 브랜드 |
| 국내 리뷰 | 올리브영 리뷰 화면 (평점, 피부타입·고민 태그) | 실제 리뷰 원문 복사·커밋 금지 |
| 일본 리뷰 | @cosme, 楽天 리뷰 화면 (연령대·肌質, 평점 척도) | 〃. 평점 척도 확인 |
| 랭킹·성분 추이 | 楽天ランキング 화면의 항목 구성 | 12주 합성 시계열, "샘플" 표시 |
| GEO | ChatGPT, Gemini, Perplexity, Google AI 개요의 실제 답변 형식 | 일본어 질의, 가상 브랜드 |
| 프로모션 일정 | Qoo10 メガ割, 楽天スーパーSALE, Amazon 대형 세일 공식 공지 | 행사 패턴만 반영, 날짜는 샘플 |
| 플랫폼 | 각 플랫폼의 판매자 안내 페이지 | 강점·고객층은 "샘플 문구", 수수료 수치는 비움 |
| 피부타입 설문 | 일본 화장품 브랜드 사이트의 肌診断 형식 | 분류 기준은 열린 질문 (11장) |
| 워크스페이스 | — | 팀원 4명(김도훈 팀장 owner + 3명), 활동 30건 |

---

## 8. 스키마 제안 (화면을 그리다 드러난 빈칸)

화면을 먼저 그리면 데이터 계약의 빈칸이 드러난다. 아래 항목은 프로토타입 스키마에 **optional 필드로 넣어 화면에서 시험**하고, 백엔드 착수 전에 팀이 TECH_STACK 5·7장 반영 여부를 정한다.

| # | 대상 | 제안 | 이유 (화면) |
| --- | --- | --- | --- |
| 1 | 7장 약기법 JSON `findings[]` | `start`, `end` (원문 내 위치) | 같은 표현이 두 번 나오거나 AI가 표현을 살짝 바꾸면 문자열 검색으로는 표시 위치가 틀린다 (새 검토) |
| 2 | `ad_checks` | `final_text` (승인된 최종 문구) | 이력에서 "결국 무엇을 썼나"가 가장 많이 다시 쓰이는 정보다 (검토 이력·자료실) |
| 3 | `ad_checks` 입력, `POST /api/ad-check` | `product_category` (一般化粧品 / 医薬部外品), `usage` (상세페이지·SNS·배너·설문 결과) | 같은 문구도 제품 구분에 따라 판정이 다르다. 특히 한국 기능성 화장품 클레임 (새 검토) |
| 4 | 7장 약기법 JSON | `translated_text`, `back_translation_ko` | 한국어 입력의 뉘앙스 확인 (새 검토, 리뷰 번역) |
| 5 | 5장 `ad_checks.suggestions` vs 7장 `findings[].suggestions` | 하나로 정리 (7장처럼 항목 안에) | 두 곳에 있으면 어느 쪽이 기준인지 모호하다 |
| 6 | `review_analyses.keywords` | 문자열 → `{ text, category }` (성분·사용감·가격·향·피부 반응·기타) | 기획안 TAB 2의 키워드 분류로 차트를 거른다 (리뷰 리포트) |
| 7 | `review_insights` | `label_ko` (일본어 인사이트의 한국어 라벨) | 한국어 대시보드에서 일본 현지 리뷰 결과를 읽어야 한다 (D) |
| 8 | `reviews` | `rating_scale` 또는 5점 정규화 규칙 | 플랫폼마다 평점 척도가 다를 수 있다 (리뷰 리포트) |
| 9 | `reviews` | `reviewer_attrs` (연령대·피부타입) | 올리브영·@cosme 모두 작성자 속성을 보여주고, 필터와 설문 비교에 쓰인다 (원문 목록) |
| 10 | `trend_snapshots.data` | 모양 정의: 랭킹 `[{ rank, name, brand, price_jpy, review_count, is_kbeauty }]`, 성분 빈도 `[{ ingredient, count }]` | jsonb라 화면이 기대하는 모양을 문서로 고정해야 한다 (시장 트렌드·성분 관심도) |
| 11 | `products` | 가격 구분(정가·행사가). ml당 가격은 저장하지 않고 계산 | 메가와리 기간 가격과 평시 가격이 섞이면 비교가 틀린다 (경쟁제품 비교) |
| 12 | `promo_events` | `kind` (플랫폼 행사·자사 캠페인), `milestones` (마감 여러 개) | 행사 하나에 참가 신청·할인 설정·입고 등 마감이 여러 개일 수 있다. 공식 공지 확인 후 결정 (캘린더) |
| 13 | `platform_notes` | `channel_type` (EC·리뷰/SNS·오프라인), `status` (검토·준비·입점) | 플랫폼 화면의 그룹과 진행 상태 (플랫폼별 강점) |
| 14 | 새 테이블 `activity_log` | workspace_id, actor_id, action, target_type, target_id | 홈의 팀 활동 피드 (홈) |
| 15 | `products` | `category` (化粧水·美容液 등) | 같은 카테고리끼리 비교하려면 필요하다 (경쟁제품 비교·시장 트렌드) — P1 구현 중 추가 |
| 16 | 사용자 프로필 | `display_name`, `title` (Supabase Auth 메타데이터 또는 `profiles` 테이블) | 검토자·팀원 이름을 보여줄 곳이 없다 (검토 이력·설정) — P1 구현 중 추가 |
| 17 | `ad_checks` | `overall_risk`, `localized_note`, `reviewed_at` 저장 칸 | 7장 응답에는 있지만 5장 컬럼에 없다 (검토 이력·검토 상세) — P1 구현 중 추가 |
| 18 | `ad_checks` | `product_id`, `promo_event_id` | 어느 제품·행사용 문구인지 알아야 캘린더에 "행사용 문구 승인 여부"를 보일 수 있다 (캘린더·자료실) — P1 구현 중 추가 |
| 19 | `review_analyses` | `topics` (`[{ topic, polarity }]` · 주제 6개: 사용감, 보습 지속, 자극, 향, 가성비, 용기 / polarity: positive, negative) | 일본어 불만과 한국어 칭찬을 같은 주제로 묶어야 소구점 후보를 찾는다. 6번 키워드 카테고리는 너무 넓다 (소구점 찾기) — P4 구현 중 추가 |

제안 7은 구현하면서 `reviews.body_ko`(일본어 리뷰의 한국어 해석)까지 넓혔다. 근거 패널에서 원문과 해석을 함께 보여주기 위해서다.

---

## 9. TECH_STACK 2장에 없는 라이브러리

| 라이브러리 | 쓰려는 곳 | 지금 판단 | 대안 |
| --- | --- | --- | --- |
| FullCalendar | 프로모션 캘린더 (P6) | 2장 "참조 기능을 만들 때 추가"에 I용으로 있다. P6에서 도입 (무료 플러그인만) | — |
| @tanstack/react-table | 비교표·이력표의 정렬·필터 | 지금은 필요 없음 | shadcn Table + 배열 정렬. 표가 수백 행이 되면 다시 판단 |
| react-hook-form | shadcn Form | 필요 없음 | 저장이 없는 폼이라 기본 form + Zod |
| html-to-image 등 | 상세페이지 블록 이미지 내보내기 (P5) | 범위 밖 | HTML 복사만 |
| QR 코드 생성 | 설문 링크 배포 (P7) | 필요 없음 | 링크 복사 |
| Playwright(TS) 또는 Vitest | 라우트 순회 자동화 | 필요 없음 | 빌드 + 브라우저 순회 (10.1) |

shadcn/ui CLI가 컴포넌트와 함께 설치하는 의존성(Base UI `@base-ui/react`, `cn`, lucide-react, chart의 Recharts 등)은 2장의 shadcn/ui·Recharts에 포함된 것으로 본다.

---

## 10. 검증 계획

### 10.1 기계 검증 (매 페이즈 끝)

| 검사 | 방법 | 통과 기준 |
| --- | --- | --- |
| 타입·린트·빌드 | `npm run typecheck`, `npm run lint`, `npm run build` | 오류 0 |
| 가짜 데이터 | 모듈을 불러올 때 Zod parse + 교차 참조 검사 (빌드의 정적 생성 중 실행) | 빌드 성공 |
| 라우트 | 빌드 출력의 라우트 목록과 4.3 인벤토리 대조 | 27개 + 리다이렉트 1 모두 존재 |
| 클릭 순회 | 브라우저로 사이드바의 모든 링크와 화면 안 상세 링크를 따라감 | 404 0개, 콘솔 오류 0개 |
| 상태 화면 | 템플릿 7종 × `?state=empty`·`loading`·`error` | 모두 렌더링 |
| 설문 모바일 | 375px 폭 | 가로 스크롤 없음, `<html lang="ja">` |
| 접근성 | Lighthouse 접근성 (설문, 새 검토) | 팀이 정한 기준 (제안: 90점 이상) |

### 10.2 추적성 매트릭스 (기획안 → 화면)

| 기획안 기능 | 화면 (라우트) | 페이즈 |
| --- | --- | --- |
| TAB 1 · 시장 트렌드: 주요 트렌드 | `/market/trends` | P3 |
| TAB 1 · 시장 트렌드: 성분별 관심도 | `/market/ingredients` | P3 |
| TAB 1 · 경쟁제품 비교: 가격·용량·주요 성분·특징 | `/market/competitors`, `/market/competitors/[productId]` | P3 |
| TAB 2 · 리뷰 데이터 통합 (수집·CSV) | `/reviews/import` | P4 |
| TAB 2 · AI 감성 분석 | `/reviews/[productId]` (도넛), `/reviews/[productId]/list` (필터) | P4 |
| TAB 2 · 핵심 키워드 추출 | `/reviews/[productId]` (키워드 막대·분류 필터) | P4 |
| TAB 2 · 소비자 페인포인트 도출 | `/reviews/[productId]` (불만 유형), `/reviews/compare` | P4 |
| TAB 2 · 반복 구매 요인 도출 | `/reviews/[productId]` (재구매 요인) | P4 |
| TAB 2 · 리뷰 시각화 | `/reviews/[productId]` | P4 |
| TAB 2 · 원문 근거 확인 | EvidenceSheet, `/reviews/[productId]/list` | P4 |
| TAB 2 · 기대 효과: 마케팅 소구점 도출 | `/reviews/compare` | P4 |
| TAB 3 · 광고 문구 입력 | `/ad-check` | P2 |
| TAB 3 · AI 위험 표현 탐지 | `/ad-check` (원문 위 표시) | P2 |
| TAB 3 · 위험 사유 설명·규제 근거 | `/ad-check` (항목 카드), `/ad-check/[checkId]` | P2 |
| TAB 3 · 대체 표현 제안 | `/ad-check` (항목 카드) | P2 |
| TAB 3 · 현지화 지원 | `/ad-check` (localized_note, 번역·역번역) | P2 |
| TAB 3 · 검토 이력 관리 | `/ad-check/history`, `/ad-check/[checkId]`, `/library` | P2, P8 |
| 관심 1 · 약기법 | TAB 3 전체 | P2 |
| 관심 2 · 시장트렌드(GEO) + 경쟁사 비교 | `/market/trends`, `/market/ingredients`, `/market/geo`, `/market/competitors` | P3 |
| 관심 3 · 일본 현지 제품 리뷰 분석 | `/reviews` (일본 전환), `/reviews/[productId]`, `/reviews/compare` | P4 |
| 관심 4 · 한국 리뷰 → 일본어 상세페이지 | `/reviews/[productId]/translate` | P5 |
| 관심 5 · 피부타입 설문조사 | `/survey`, `/survey/questions`, `/survey/result`, `/survey/privacy`, `/survey-results` | P7 |
| 관심 6 · 진출·홍보 플랫폼별 강점 | `/platforms`, `/platforms/[platformId]` | P6 |
| 관심 7 · 메가와리/프로모션 캘린더 | `/calendar` | P6 |
| 관심 8 · 팀 워크스페이스 데이터베이스 | `/`, `/library`, `/settings`, `/login`, `/onboarding` | P1(틀), P8 |
| 공통 · 대시보드 틀 (K) | `(dashboard)/layout.tsx` | P1 |

화면이 없는 기능: **0개**.

### 10.3 실무자 테스트

**P1 뒤 — 첫 클릭 테스트.** 빈 화면만으로 메뉴 구조를 확인한다. 대상은 해외사업·마케팅 실무자 3~5명. "어디를 먼저 누르겠어요?" 8문항, 기준은 첫 클릭 정답 80% 이상 (팀 기준으로 조정).

| # | 질문 | 정답 |
| --- | --- | --- |
| 1 | 일본에서 요즘 뜨는 성분을 보려면? | 성분 관심도 |
| 2 | 경쟁 제품 가격을 비교하려면? | 경쟁제품 비교 |
| 3 | ChatGPT가 우리 브랜드를 추천하는지 보려면? | AI 검색 노출 (GEO) |
| 4 | 올리브영 리뷰 파일을 올리려면? | 리뷰 가져오기 |
| 5 | 이 광고 문구를 일본에서 써도 되는지 보려면? | 새 검토 |
| 6 | 지난주 반려된 문구를 다시 보려면? | 검토 이력 (자료실도 정답) |
| 7 | 다음 메가와리 일정은? | 프로모션 캘린더 |
| 8 | Qoo10과 楽天 중 어디가 나은지 보려면? | 플랫폼별 강점 |

**P2~P7 뒤 — 핵심 과제 5개.** 도움 없이, 생각을 소리 내 말하며 수행한다.

| # | 과제 | 성공 기준 | 페이즈 |
| --- | --- | --- | --- |
| T1 | 「シミが消える美容液」를 검토하고 대체 문구 하나를 골라 승인하세요 | 3분 안, 왜 위험한지 근거를 말할 수 있음 | P2 |
| T2 | 자사 세럼보다 ml당 가격이 낮고 나이아신아마이드가 든 경쟁 제품을 찾으세요 | 2분 안 | P3 |
| T3 | 국내 리뷰에서 가장 많은 재구매 요인을 찾고 근거 리뷰 3개를 여세요 | 근거 원문까지 도달 | P4 |
| T4 | 다음 메가와리 준비 마감까지 며칠 남았고, 그 행사용 문구가 승인됐는지 확인하세요 | 캘린더 → 검토 상태 연결을 사용 | P6 |
| T5 | (일본 소비자) 휴대폰으로 설문을 끝까지 답하세요 | 이탈 없이 결과 도달, 동의 내용을 설명할 수 있음 | P7 |

보조 과제: 리뷰 번역 블록을 승인한 뒤 복사하기 (P5), 홈에서 오늘 할 일 3가지 말하기와 자료실에서 반려된 문구 찾기 (P8).

기록: 성공·실패, 걸린 시간, 막힌 곳, 한 말. 이 기록으로 다음 페이즈의 순서와 범위를 조정한다.

### 10.4 전문가·원어민 검수

- **약기법 예시 10건:** 56項目·適正広告ガイドライン·医薬品等適正広告基準 원문과 조항 단위로 대조한다. 가능하면 薬機法 전문가에게 한 번 검토받는다. 가이드라인 개정(2026년 7월 α판 초안)이 정식판이 됐는지 확인한다.
- **체험담 주석 (P5):** 주석이 위험 표현을 면책하지 않는다는 점을 가이드라인 원문으로 확인한다.
- **일본어:** 설문 전체 문구, 대체 표현, 상세페이지 블록을 원어민이 검수한다.
- **개인정보:** 설문 동의·이용 목적 문구를 전문가가 확인한다 (APPI).

---

## 11. 열린 질문과 결정 필요

**결정 필요 (P1 시작 전 또는 진행 중)**

1. **가짜 데이터의 브랜드:** 가상 브랜드 + 실제 표기 방식(추천 — 공유 링크가 돌아도 실제 제품에 대한 틀린 정보가 퍼지지 않음) vs 실제 브랜드(사내 테스트의 현실감이 높음). → **결정(2026-10-21): 가상 브랜드**
2. **8장 스키마 제안 19개:** 프로토타입에서 optional로 시험하고, 백엔드 착수 전 팀 합의. → **결정(2026-10-21): optional로 시험** (19번은 2026-10-23 소구점 찾기 구현 중 추가)
3. **"팀 워크스페이스 데이터베이스"의 뜻:** 로그인·팀 분리·결과 보관 + 자료실(현재 가정) vs 제품 정보·성분표·브랜드 자료 같은 팀 지식 DB까지. → **결정(2026-10-21): 결과 보관 + 자료실**
4. **1.2의 TECH_STACK 수정안 적용:** P1 1단계에서 CLAUDE.md로 복사할 때. → **결정(2026-10-21): 적용, 루트 `CLAUDE.md`에 반영함**

**팀·전문가 확인 (TECH_STACK 11장에 추가)**

- [ ] GEO = AI 검색 최적화라는 가정 → P3 화면으로 확인
- [ ] 국내 플랫폼 리뷰를 일본 상세페이지에 게시할 권리 (리뷰 저작권, 플랫폼 이용약관, 작성자 동의) — F
- [ ] 피부타입 분류 기준과 문항 — G
- [ ] 설문 개인정보: 익명만 받을지, 쿠폰용 이메일 등까지 받을지 → APPI 동의·이용 목적·국외 이전 고지 범위 — G
- [ ] 설문 결과 페이지의 제품 추천 문구 = 광고 → 약기법 검토 대상으로 처리 — G
- [ ] 「化粧品等の適正広告ガイドライン」 개정(2026년 7월 α판 초안)의 정식판 여부와 시점 — A
- [ ] 플랫폼별 평점 척도 (@cosme 등) — D

---

## 12. P1 진행 기록 (2026-10-21)

> **확인 필요 (2026-10-22):** `sub_main`에 올라간 코드는 Next.js 15.5.28, shadcn `base-nova` 프리셋(`@base-ui/react`)이고 `components/ui`에는 10개 컴포넌트만 있다. 아래 기록의 버전(Next.js 16.4.2, Radix)·파일 이름과 다르다. 다르면 `apps/web/package.json`과 실제 파일이 기준이며, 이 장은 담당자가 실제 코드에 맞춰 고친다.

**만든 것:** 6장 전체. 화면 27개 + `/market` 리다이렉트, 템플릿 7종, 공통 부품, Zod 스키마 11개 파일, 가짜 데이터 13개 파일, 읽기 함수 11개 파일, 대시보드용 404 화면 (`(dashboard)/not-found.tsx`, 계획에 없던 추가).

**설치된 버전과 계획과 달라진 점**

- Next.js 16.4.2 (Cache Components + Partial Prefetching이 기본으로 켜져 있음). 그래서 다음을 지킨다.
  - 렌더링 중 현재 시각을 읽지 않는다 → "오늘"을 `PROTOTYPE_TODAY = 2026-10-21`로 고정 (`lib/mock/helpers.ts`). D-day 계산도 문자열로 한다 (`lib/format.ts`).
  - 동적 라우트는 `generateStaticParams` + `params`를 `<Suspense>` 안에서 기다리는 형태.
  - `?state=` 전환은 `useSearchParams` 대신 `window.location`을 외부 저장소로 구독한다 (`useSyncExternalStore`). 정적 렌더링을 막지 않기 위해서다.
- shadcn/ui 4.22 (Radix 기반, nova 프리셋). 화면 문구 규칙(0장)에 맞춰 생성 컴포넌트의 화면 낭독용 영어 문구("Close" 등)를 한국어로 바꿨다. `hooks/use-mobile.ts`는 린트 규칙(effect 안 setState) 때문에 `useSyncExternalStore`로 고쳤다.
- 추가 의존성: `zod`, `papaparse`(둘 다 TECH_STACK 2장에 있음). 2장에 없는 라이브러리는 추가하지 않았다.
- 차트 색: dataviz 검증 팔레트의 범주 색 1~5번, 감성은 파랑↔빨강 + 회색 가운데. 색만으로 구분하지 않게 범례·글자를 함께 둔다.

**검증 결과 (10.1)**

| 검사 | 결과 |
| --- | --- |
| `npm run typecheck` / `lint` / `build` | 모두 통과 |
| 라우트 | 빌드 출력 = 화면 27개 + 리다이렉트 1 (4.3과 일치) |
| 가짜 데이터 검증이 실제로 빌드를 막는지 | 근거 리뷰 ID 하나를 일부러 틀리게 바꿔 빌드 → `교차 참조 검사 실패`로 빌드 실패 확인 후 원복 |
| 클릭 순회 | 모든 화면 HTTP 200 (주소 순회), 주요 화면 7개 콘솔 오류 0 |
| 상태 화면 | `?state=empty`·`error` 전환 확인 |
| 설문 모바일 | 375px에서 가로 스크롤 없음, `<html lang="ja">`, 동의 전 시작 버튼 비활성, 1/2 → 2/2 → 결과 이동 확인 |
| 1024px 대시보드 | 표가 있는 화면 모두 페이지 가로 넘침 없음 (넓은 표는 표 안에서 스크롤) |
| 접근성 점수 (Lighthouse) | 아직 측정 안 함 |

**알려진 점**

- 없는 ID를 열면 대시보드 안 404 화면이 보이지만 HTTP 상태는 200이다. 스트리밍 렌더링(Partial Prerendering)에서는 응답이 시작된 뒤 상태 코드를 바꿀 수 없기 때문이다. 실데이터 연동 때 다시 본다.
- 쓰기 동작(승인·반려·저장·번역·추출)은 모두 비활성 버튼 + "Pn에서 연결" 표시.
- 리뷰 가져오기의 CSV 미리보기(Papa Parse)는 실제 파일을 올려 보는 확인을 아직 하지 않았다.

**다음:** 10.3의 첫 클릭 테스트 8문항을 실무자 3~5명과 진행한 뒤 P2(약기법 검토)로 간다. P7의 외부 확인 요청(원어민 검수, APPI 문구, 피부타입 분류 기준)은 지금 보내 두면 좋다.

---

## 참고한 자료

- 「化粧品等の適正広告ガイドライン」 관련 JCIA 자료 (京都府 게시 PDF): https://www.pref.kyoto.jp/yakumu/documents/kesyouhinkougyoukai.pdf
- 「化粧品等の適正広告ガイドライン 改訂α版」 초안 목록 (ChemLinked): https://cosmetic.chemlinked.com/database/view/2755
- Qoo10 「20%メガ割」 2026-08-28~09-09 개최 (ECのミカタ): https://ecnomikata.com/ecnews/51445/
- Qoo10 メガ割 연 4회 개최 주기 (mobinc): https://mobinc.jp/column/2026/04/01/latest-qoo10-megawari-coupon-strategies-and-next-event-date/
