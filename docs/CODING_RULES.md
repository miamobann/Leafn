# Leafn 코딩 규칙 (시안)

> 상태: 시안 · 2026-10-22 · 갱신 2026-10-25 (정리 전 원문: [archive/pre_CODING_RULES.md](archive/pre_CODING_RULES.md))
> 기술 판단의 기준은 [CLAUDE.md](../CLAUDE.md)다. 이 문서는 6명이 같은 레포에서 충돌 없이 일하기 위한 약속만 다룬다. 둘이 다르면 CLAUDE.md를 따르고 이 문서를 고친다.

## 1. 브랜치

```
Leafn_main   배포 기준. 직접 push하지 않는다
└─ sub_main  통합 브랜치. 기본은 PR로 들어온다
   └─ 개인 브랜치 (각자 이름, 예: minseo)
```

브랜치 운영은 유동적으로 한다. 아래는 기본 흐름이고, 예외는 채팅에서 알리면 된다.

- 작업은 기본적으로 개인 브랜치에서 한다. 시작 전에 `sub_main`을 받아 온다.
  ```bash
  git checkout <내 브랜치>
  git pull origin sub_main
  ```
- 문서 수정, 급한 수정, 팀이 합의한 작업은 `sub_main`에 직접 push해도 된다. push 전에 `npm run typecheck`, `npm run lint`, `npm run build`를 통과시키고, push 뒤 채팅에 무엇을 올렸는지 알린다.
- 기능을 따로 나누고 싶으면 `<이름>-<기능>`으로 딴다 (예: `minseo-trends-chart`). `minseo/trends-chart`처럼 `/`를 쓰면 이미 있는 `minseo` 브랜치와 이름이 겹쳐 git이 만들지 못한다.
- `sub_main` → `Leafn_main` 반영은 총괄(lead)이 PR로 한다. `Leafn_main`이 Vercel 배포 브랜치이고 Vercel Hobby는 하루 빌드 수 한도가 있어서, `sub_main`에 쌓인 머지를 모아서 한 번에 반영한다. 개인 브랜치의 PR은 `Leafn_main`이 아니라 `sub_main`으로 보낸다.
- `Leafn_main` 보호는 GitHub가 강제하지 않는다 (개인 계정 비공개 레포는 무료 플랜에서 브랜치 규칙이 적용되지 않음). 그래서 약속으로 지킨다: `Leafn_main`에는 총괄만 머지하고, `sub_main` → `Leafn_main` PR의 CI가 초록일 때만 머지한다. 직접 push, 강제 push, 브랜치 삭제는 하지 않는다.
- GitHub 기본 브랜치는 `sub_main`이다. 새로 받는 사람과 AI 도구, 새 PR은 기본으로 `sub_main`을 본다.

## 2. 커밋

- 형식: `<타입>(<범위>): <한 줄 요약>` · 요약은 한국어 가능
  - 타입: `feat` 기능 · `fix` 버그 · `ui` 화면만 · `refactor` · `docs` · `chore` 설정·의존성 · `db` 마이그레이션
  - 범위: `market` · `reviews` · `ad-check` · `calendar` · `survey` · `common` · `collectors` · `db` · (다음) `approval` · `ai-analysis`
  - `launch`(진출 실행)는 탭이 없어져 2026-10-25부터 `calendar`로 쓴다. 예전 커밋은 그대로 둔다
  - 예: `feat(reviews): CSV 미리보기 표 추가`
- 한 커밋에는 한 가지 일만. 기능 + 포맷 변경을 섞지 않는다.
- `.env*`, API 키, 실제 리뷰 원문 대량 데이터, `node_modules`는 커밋하지 않는다.

## 3. Pull Request

- 대상은 `sub_main` (GitHub 기본 브랜치라 자동으로 잡힌다). 제목은 커밋 형식과 같다.
- 본문은 `.github/pull_request_template.md`가 자동으로 채우는 칸을 쓴다: 무엇을 바꿨나 / 확인 방법 / 스크린샷 / AI가 정한 설계 결정 / (DB를 건드렸으면) DB 체크리스트.
- 머지 조건: 리뷰 1명 승인 + CI 통과. CI(`.github/workflows/ci.yml`, 검사 이름 `web`)가 PR마다 `typecheck`, `lint`, `build`를 자동으로 돌린다. GitHub가 머지를 막지는 않으므로 CI가 빨간 PR은 머지하지 않는다는 약속으로 지킨다.
- 머지 방식: Merge commit (GitHub 기본, 지금까지 쓴 방식). Squash는 쓰지 않는다. 개인 브랜치를 계속 쓰는 방식에서 Squash를 하면 다음 PR에 이미 머지된 커밋이 다시 나온다.
- 머지 후 개인 브랜치는 지우지 않고 계속 쓴다.
- 400줄이 넘으면 나눠서 올린다 (자동 생성된 shadcn 컴포넌트, lock 파일 제외).

## 4. 내 영역 / 공용 영역

**총괄은 Min(GitHub `@miamobann`, 해외사업팀장)이다.** 이 문서와 DB_RULES의 "총괄"은 모두 Min을 뜻한다. 아래 표에서 총괄 리뷰가 필요한 PR은 Min을 리뷰어로 직접 넣는다. 리뷰어 자동 지정(CODEOWNERS)은 무료 플랜의 비공개 레포에서 동작하지 않아서 쓰지 않는다.

| 영역 | 경로 | 고칠 수 있는 사람 |
| --- | --- | --- |
| 내 화면 | `app/(internal)/(dashboard)/<내 탭>/`, `app/(public)/survey/` | 담당자 |
| 레이아웃·내비 | `components/layout/`, `nav-config.ts` | 총괄. 다른 사람은 PR에 총괄 리뷰 필수 |
| 공통 부품 | `components/ui/`, `components/common/`, `components/templates/` | 누구나, 단 PR에 2명 리뷰 |
| 스키마·가짜 데이터 | `lib/schemas/`, `lib/mock/`, `lib/data/` | 누구나, 단 총괄 리뷰 필수 |
| 자사 제품 기준 | `lib/own-products.ts`, `lib/own-product-specs.ts`, `docs/Product.md` | 총괄. 다른 사람은 PR에 총괄 리뷰 필수 |
| DB | `supabase/migrations/` | 새 파일 추가만. 기존 파일 수정 금지 |
| 시작 데이터 | `supabase/seeds/` | 누구나 PR로. 실행은 DB 관리자(총괄)가 SQL Editor에서 |
| 프롬프트 | `prompts/` | 해당 기능 담당자. 바꿀 땐 새 버전 파일 (`ad-check.v2.md`)을 만들고 쓰는 버전 상수만 바꾼다 (CLAUDE.md 7장) |
| 기록용 보관본 | `docs/archive/pre_*.md` | 고치지 않는다. 지금 문서를 고친다 |

다른 사람 영역을 고쳐야 하면 먼저 채팅에서 말하고 PR에 그 사람을 리뷰어로 넣는다.

## 5. TypeScript · Next.js

- `strict` 모드. `any` 금지, 불가피하면 이유를 주석으로.
- 기본은 Server Component. 상태·이벤트가 필요한 곳만 `"use client"`를 맨 위에.
- 파일·폴더 이름은 `kebab-case` (`review-table.tsx`), 컴포넌트는 `PascalCase`, 함수·변수는 `camelCase`, 상수는 `UPPER_SNAKE_CASE`.
- import는 별칭 `@/`를 쓴다 (`@/components/common/states`). `../../..` 금지.
- 화면은 `lib/mock/`을 직접 import하지 않고 `lib/data/`의 함수만 부른다.
- 데이터 모양은 `lib/schemas/`의 Zod 스키마에서 `z.infer`로 타입을 만든다. 같은 타입을 따로 선언하지 않는다.
- AI 호출은 `lib/ai/`에서만, 프롬프트 원문은 `prompts/`에만. 제공사(OpenAI 기본·Anthropic 선택)는 `lib/ai/` 안에서 `AI_PROVIDER`로 고르고, 화면은 제공사를 모른다 (CLAUDE.md 2장).

## 6. 화면 (Tailwind · shadcn/ui)

- shadcn/ui 컴포넌트를 먼저 쓴다. 새로 추가할 땐 `npx shadcn@latest add <이름>`, 생성물은 손대지 않고 감싸서 쓴다.
- 스타일은 Tailwind 클래스로. 별도 CSS 파일, 인라인 `style`은 쓰지 않는다 (차트 색 등 불가피한 경우 제외).
- 색은 하드코딩(`#ff0000`, `text-red-500`) 대신 `globals.css`의 토큰을 쓴다 (위험도·감성·검토 상태 색).
- 색만으로 구분하지 않는다. 배지에는 아이콘이나 글자를 함께.
- 화면 문구: 대시보드는 한국어, 공개 설문은 일본어. 문구를 컴포넌트 여기저기 흩지 말고 페이지 상단 상수로 모은다.
- 모든 화면은 비었을 때·불러오는 중·오류 상태를 보여준다 (`EmptyState`, `LoadingState`, `ErrorState`).

## 7. Supabase

> 행·열·테이블 추가 규칙과 PR 체크리스트는 [DB_RULES.md](DB_RULES.md)에 있다.

- 테이블·RLS 변경은 새 마이그레이션 파일로만. 파일은 Supabase CLI로 만든다: `npx supabase migration new <설명>` → `supabase/migrations/<YYYYMMDDHHMMSS>_<설명>.sql` (14자리 시각). 손으로 이름을 지으면 자릿수가 달라져 적용 순서가 꼬일 수 있다.
- 새 업무 테이블에는 `workspace_id`와 RLS 정책을 같이 만든다.
- 브라우저에서는 anon 키만. `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `RAKUTEN_APPLICATION_ID`, `SERPAPI_API_KEY`, `APIFY_TOKEN`은 서버 코드에서만 쓰고 `NEXT_PUBLIC_`을 붙이지 않는다.
- 필요한 환경 변수는 `apps/web/.env.example`에 이름만 적는다. 실제 값은 그 파일을 복사한 `apps/web/.env.local`(로컬), Vercel 환경 변수, GitHub Actions Secrets에만 넣는다 (연동 방법: `docs/SUPABASE_SETUP.md`).

## 8. Python 수집기 (`collectors/`)

- Python 3.11+, 포맷은 `ruff format`, 린트는 `ruff check`.
- 사이트 하나 = `sources/` 파일 하나. 한 사이트가 깨져도 다른 사이트는 돌아가게.
- 저장은 `db.py`를 통해 `(workspace_id, source, external_id)` upsert. `workspace_id`는 반드시 채운다. 원본은 `raw`에.
- 요청 사이 간격을 두고, 이용약관·robots.txt를 확인한 사이트만 수집한다.
- 라이브러리를 추가하면 `requirements.txt`에 버전을 고정해 적는다.

## 9. 의존성

- CLAUDE.md 2장에 없는 라이브러리는 채팅에서 이유를 말하고 합의한 뒤 추가한다.
- `package-lock.json` 충돌은 손으로 고치지 말고 `sub_main` 것을 받은 뒤 `npm install`로 다시 만든다.

## 10. AI 코딩 도구를 쓸 때

- 작업 전에 CLAUDE.md를 읽게 한다. Claude Code는 자동으로, Codex·Gemini CLI 등은 `AGENTS.md`, Cursor는 `.cursor/rules/leafn.mdc`를 거쳐 읽는다.
- AI에게 커밋·push를 맡길 때는 대상 브랜치를 말해 준다. AI는 `Leafn_main`에 push하지 않는다 (CLAUDE.md 0장 Git).
- 한 번에 한 작업. 생성된 코드는 내가 읽고 이해한 것만 커밋한다.
- AI가 정한 설계 결정은 PR 본문에 적어 리뷰어가 볼 수 있게 한다.
