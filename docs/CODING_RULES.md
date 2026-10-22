# Leafn 코딩 규칙 (시안)

> 상태: 시안 · 2026-10-22 · 팀 합의 후 확정
> 기술 판단의 기준은 [CLAUDE.md](../CLAUDE.md)다. 이 문서는 6명이 같은 레포에서 충돌 없이 일하기 위한 약속만 다룬다. 둘이 다르면 CLAUDE.md를 따르고 이 문서를 고친다.

## 1. 브랜치

```
Leafn_main   배포 기준. 직접 push 금지
└─ sub_main  통합 브랜치. 직접 push 금지, PR로만
   └─ 개인 브랜치 (각자 이름, 예: minseo)
```

- 작업은 항상 개인 브랜치에서 한다. 시작 전에 `sub_main`을 받아 온다.
  ```bash
  git checkout <내 브랜치>
  git pull origin sub_main
  ```
- 큰 기능은 개인 브랜치에서 다시 따도 된다: `<내 브랜치>/<기능>` (예: `minseo/trends-chart`).
- `sub_main` → `Leafn_main` 반영은 총괄(lead)이 페이즈가 끝날 때 PR로 한다.

## 2. 커밋

- 형식: `<타입>(<범위>): <한 줄 요약>` · 요약은 한국어 가능
  - 타입: `feat` 기능 · `fix` 버그 · `ui` 화면만 · `refactor` · `docs` · `chore` 설정·의존성 · `db` 마이그레이션
  - 범위: `market` · `reviews` · `ad-check` · `launch` · `survey` · `common` · `collectors` · `db`
  - 예: `feat(reviews): CSV 미리보기 표 추가`
- 한 커밋에는 한 가지 일만. 기능 + 포맷 변경을 섞지 않는다.
- `.env*`, API 키, 실제 리뷰 원문 대량 데이터, `node_modules`는 커밋하지 않는다.

## 3. Pull Request

- 대상은 항상 `sub_main`. 제목은 커밋 형식과 같다.
- 본문: 무엇을 바꿨나 / 확인 방법(어느 화면에서 무엇을 누르면 되는지) / 스크린샷(화면 변경 시).
- 머지 조건: 리뷰 1명 승인 + `npm run typecheck`, `npm run lint`, `npm run build` 통과.
- 머지 방식: Squash merge. 머지 후 개인 브랜치는 지우지 않고 계속 쓴다.
- 400줄이 넘으면 나눠서 올린다 (자동 생성된 shadcn 컴포넌트, lock 파일 제외).

## 4. 내 영역 / 공용 영역

| 영역 | 경로 | 고칠 수 있는 사람 |
| --- | --- | --- |
| 내 화면 | `app/(internal)/(dashboard)/<내 탭>/`, `app/(public)/survey/` | 담당자 |
| 레이아웃·내비 | `components/layout/`, `nav-config.ts` | 총괄. 다른 사람은 PR에 총괄 리뷰 필수 |
| 공통 부품 | `components/ui/`, `components/common/`, `components/templates/` | 누구나, 단 PR에 2명 리뷰 |
| 스키마·가짜 데이터 | `lib/schemas/`, `lib/mock/`, `lib/data/` | 누구나, 단 총괄 리뷰 필수 |
| DB | `supabase/migrations/` | 새 파일 추가만. 기존 파일 수정 금지 |
| 프롬프트 | `prompts/` | 해당 기능 담당자. 바꿀 땐 새 버전 파일 (`ad-check.v2.md`) |

다른 사람 영역을 고쳐야 하면 먼저 채팅에서 말하고 PR에 그 사람을 리뷰어로 넣는다.

## 5. TypeScript · Next.js

- `strict` 모드. `any` 금지, 불가피하면 이유를 주석으로.
- 기본은 Server Component. 상태·이벤트가 필요한 곳만 `"use client"`를 맨 위에.
- 파일·폴더 이름은 `kebab-case` (`review-table.tsx`), 컴포넌트는 `PascalCase`, 함수·변수는 `camelCase`, 상수는 `UPPER_SNAKE_CASE`.
- import는 별칭 `@/`를 쓴다 (`@/components/common/empty-state`). `../../..` 금지.
- 화면은 `lib/mock/`을 직접 import하지 않고 `lib/data/`의 함수만 부른다.
- 데이터 모양은 `lib/schemas/`의 Zod 스키마에서 `z.infer`로 타입을 만든다. 같은 타입을 따로 선언하지 않는다.
- AI 호출은 `lib/ai/`에서만, 프롬프트 원문은 `prompts/`에만.

## 6. 화면 (Tailwind · shadcn/ui)

- shadcn/ui 컴포넌트를 먼저 쓴다. 새로 추가할 땐 `npx shadcn@latest add <이름>`, 생성물은 손대지 않고 감싸서 쓴다.
- 스타일은 Tailwind 클래스로. 별도 CSS 파일, 인라인 `style`은 쓰지 않는다 (차트 색 등 불가피한 경우 제외).
- 색은 하드코딩(`#ff0000`, `text-red-500`) 대신 `globals.css`의 토큰을 쓴다 (위험도·감성·검토 상태 색).
- 색만으로 구분하지 않는다. 배지에는 아이콘이나 글자를 함께.
- 화면 문구: 대시보드는 한국어, 공개 설문은 일본어. 문구를 컴포넌트 여기저기 흩지 말고 페이지 상단 상수로 모은다.
- 모든 화면은 비었을 때·불러오는 중·오류 상태를 보여준다 (`EmptyState`, `LoadingState`, `ErrorState`).

## 7. Supabase

- 테이블·RLS 변경은 `supabase/migrations/<YYYYMMDDHHMM>_<설명>.sql` 새 파일로만.
- 새 업무 테이블에는 `workspace_id`와 RLS 정책을 같이 만든다.
- 브라우저에서는 anon 키만. `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `RAKUTEN_APPLICATION_ID`는 서버 코드에서만 쓰고 `NEXT_PUBLIC_`을 붙이지 않는다.
- 필요한 환경 변수는 `.env.example`에 이름만 적는다.

## 8. Python 수집기 (`collectors/`)

- Python 3.11+, 포맷은 `ruff format`, 린트는 `ruff check`.
- 사이트 하나 = `sources/` 파일 하나. 한 사이트가 깨져도 다른 사이트는 돌아가게.
- 저장은 `db.py`를 통해 `(source, external_id)` upsert. 원본은 `raw`에.
- 요청 사이 간격을 두고, 이용약관·robots.txt를 확인한 사이트만 수집한다.
- 라이브러리를 추가하면 `requirements.txt`에 버전을 고정해 적는다.

## 9. 의존성

- CLAUDE.md 2장에 없는 라이브러리는 채팅에서 이유를 말하고 합의한 뒤 추가한다.
- `package-lock.json` 충돌은 손으로 고치지 말고 `sub_main` 것을 받은 뒤 `npm install`로 다시 만든다.

## 10. AI 코딩 도구를 쓸 때

- 작업 전에 CLAUDE.md를 읽게 한다 (Claude Code는 자동).
- 한 번에 한 작업. 생성된 코드는 내가 읽고 이해한 것만 커밋한다.
- AI가 정한 설계 결정은 PR 본문에 적어 리뷰어가 볼 수 있게 한다.
