# Supabase 연동 방법 (팀원용)

> 5분이면 끝난다. 팀 전체가 Supabase 프로젝트 하나(`Leaf&`)를 같이 쓴다.
> 운영 규칙: [DB_RULES.md](DB_RULES.md) 6장 · 테이블 지도: [db-frame.md](db-frame.md) · 화면별 연결 상태: [DATA_CONNECTIONS.md](DATA_CONNECTIONS.md)
> 갱신 2026-10-25 (정리 전 원문: [archive/pre_SUPABASE_SETUP.md](archive/pre_SUPABASE_SETUP.md))

## 한눈에 보기

```
내 PC의 앱 ──(URL + publishable 키)──▶ 팀 Supabase DB 하나 ◀── 다른 팀원 5명의 앱
                                         │
                       무엇을 읽고 쓸 수 있는지는 테이블의 RLS 정책이 정한다
```

- 레포에는 키가 없다. 연결 정보는 **각자 PC의 `apps/web/.env.local`** 에만 둔다.
- `.env.local`에 Supabase 값이 **없으면** 앱은 샘플 데이터(`lib/mock`)로 뜬다 (샘플 모드). 값을 넣으면 실제 DB를 읽고, 로그인과 워크스페이스 참여가 필요하다.

## 1. 연결하기

1. 최신 코드를 받는다.
   ```bash
   git checkout <내 브랜치>
   git pull origin sub_main
   npm run setup
   ```
2. `apps/web/.env.example`을 복사해서 같은 폴더에 `.env.local`을 만든다.
   ```bash
   # macOS / Linux / Git Bash
   cp apps/web/.env.example apps/web/.env.local
   # Windows PowerShell
   Copy-Item apps/web/.env.example apps/web/.env.local
   ```
3. `.env.local`에 팀 채팅 공지의 두 값을 붙여 넣는다.
   ```
   NEXT_PUBLIC_SUPABASE_URL=<공지의 URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<공지의 sb_publishable_... 키>
   ```
   나머지 줄(`SUPABASE_SERVICE_ROLE_KEY` 등)은 **비워 둔다.**
4. 개발 서버를 켠다.
   ```bash
   npm run dev
   ```
   http://localhost:3000 에서 로그인(또는 가입)하고, 팀 채팅의 참여 코드로 팀 워크스페이스에 들어가면 끝이다. 헤더에 Leaf& Dew 프로젝트와 제품 6종이 보이면 연결된 것이다.

## 2. 잘 안 될 때

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| `Supabase 환경 변수가 없습니다` 오류 | `.env.local`이 없거나 위치가 틀림 | 파일이 `apps/web/` 바로 아래에 있는지, 이름이 `.env.local`인지 확인 (Windows는 `.txt`가 붙지 않았는지) |
| 값을 바꿨는데 그대로 | 개발 서버가 예전 값을 기억함 | `npm run dev`를 끄고 다시 켠다 |
| `Invalid API key` | 키를 잘못 복사함 | 앞뒤 공백 없이 다시 붙여 넣는다 |
| 데이터가 안 보임 | 워크스페이스에 참여하지 않았거나, 새 마이그레이션·시드가 아직 원격에 적용되지 않음 | 설정 화면에서 팀을 확인한다. 머지된 지 얼마 안 된 기능이면 DB 관리자(Min)에게 적용 여부를 묻는다 |
| 조회 오류 화면이 뜸 | 연결된 환경에서 쿼리가 실패하면 샘플로 숨기지 않고 오류를 보여준다 | 오류 문구를 팀 채팅에 올린다 (`DATA_CONNECTIONS.md` "조회 기준") |

## 3. 대시보드도 보고 싶다면

Supabase 대시보드(테이블 보기, SQL Editor)는 DB 관리자(Min)에게 초대를 요청한다. 초대받은 뒤에도 대시보드에서 테이블이나 컬럼을 직접 바꾸지 않는다. 바꿀 게 있으면 마이그레이션 파일을 PR로 올린다 ([DB_RULES.md](DB_RULES.md) 3장, 6장).

## 4. 꼭 지킬 것 3가지

1. `.env.local`은 커밋하지 않는다 (`.gitignore`에 이미 들어 있다).
2. **service_role(secret) 키는 받지도, 붙여 넣지도 않는다.** 누가 채팅에 올리면 바로 관리자에게 알린다.
3. 테스트 데이터는 내 워크스페이스 안에서만 만든다.
