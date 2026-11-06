# 게스트 모드 (포트폴리오 공개용)

로그인 화면의 「게스트로 둘러보기」를 누르면 데모 계정으로 로그인한다. 실데이터를 읽기 전용으로 보여 준다.

## 동작

- `/auth/guest` (POST): service role로 데모 계정의 매직 링크 토큰을 만들고 바로 검증해 세션을 만든다. 메일은 보내지 않는다. 비밀번호를 쓰지 않으므로 게스트가 비밀번호를 바꿔도 계속 동작한다.
- 데모 계정 판별 기준: `auth.users.raw_app_meta_data.demo = true`. app_metadata는 service role만 바꿀 수 있다.
- `app_metadata.demo`가 없는 계정은 `DEMO_USER_ID`에 넣어도 세션을 만들지 않는다.

## 쓰기 막기 (세 겹)

| 위치 | 막는 것 |
| --- | --- |
| DB 트리거 `zz_block_demo_writes` (`20261106050000_guest_read_only.sql`) | 데모 계정 세션의 모든 public 테이블 insert · update · delete · truncate. security definer 함수(rpc) 안의 쓰기 포함 |
| `middleware.ts` | 게스트의 `/api/*` 쓰기 요청(GET · HEAD · OPTIONS 외) → 403 |
| Server Action | `writeContext()`(시안 · 결재 · AI 분석. AI 분석 저장은 service role이라 트리거를 거치지 않음)와 AI · 외부 호출 액션(리뷰 분석 · 번역, 제품명 정리, 비교 번역, 수집 요청 · 깨우기)에서 먼저 반환 |

- 트리거는 마이그레이션 시점의 테이블에만 걸린다. 새 테이블을 만들면 같은 트리거를 같이 건다.
- 화면의 쓰기 버튼은 그대로 보인다. 누르면 "게스트 모드는 읽기 전용이에요" 오류가 뜬다.
- 설정 화면에서 게스트에게는 초대 코드를 숨긴다. 다만 REST로 직접 읽을 수는 있으므로 아래 4번(가입 끄기)을 같이 한다.

## 설정 순서 (총괄)

순서를 지킨다. 마이그레이션을 적용하기 전에 `DEMO_USER_ID`를 넣으면 게스트가 쓰기를 할 수 있다.

1. 마이그레이션 적용: `supabase/migrations/20261106050000_guest_read_only.sql`
2. 데모 계정 만들기: Supabase 대시보드 → Authentication → Users → Add user → Create new user (예: `guest@leafn.demo`, 비밀번호 아무거나, Auto Confirm User 체크)
3. SQL Editor에서 실행 (이메일은 2번에서 만든 값):

   ```sql
   -- 데모 표시
   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"demo": true}'
   where email = 'guest@leafn.demo';
   -- 화면에 보일 이름
   update public.profiles set display_name = '게스트'
   where id = (select id from auth.users where email = 'guest@leafn.demo');
   -- 팀 워크스페이스에 owner로 넣기 (결재함 등 owner 화면까지 보이게. 쓰기는 트리거가 막는다)
   insert into public.workspace_members (workspace_id, user_id, role)
   select w.id, u.id, 'owner'
   from public.workspaces w, auth.users u
   where w.name = 'Leaf& 해외마케팅 1팀' and u.email = 'guest@leafn.demo';
   -- DEMO_USER_ID로 쓸 값
   select id from auth.users where email = 'guest@leafn.demo';
   ```

4. 신규 가입 끄기: Authentication → Sign In / Providers → "Allow new users to sign up" 끄기. 기존 팀원 로그인과 게스트 로그인은 영향 없음.
5. Vercel 환경 변수: `DEMO_USER_ID` 추가, `SUPABASE_SERVICE_ROLE_KEY` 있는지 확인 → 재배포.

## 확인

- 로그인 화면 → 「게스트로 둘러보기」 → 홈으로 이동, 상단에 게스트 안내 띠
- 캘린더에서 행사 추가 → "게스트 모드는 읽기 전용이에요" 오류, DB에 행 없음
- 설정 화면에 초대 코드가 안 보임

## 게스트 모드 끄기

Vercel에서 `DEMO_USER_ID`를 지우고 재배포하면 버튼이 사라진다. 데모 계정은 Authentication → Users에서 삭제한다.
