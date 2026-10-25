<!-- 제목은 커밋 형식: <타입>(<범위>): <요약>  예) feat(reviews): CSV 미리보기 표 추가 -->
<!-- base 브랜치는 sub_main (기본값). Leafn_main으로는 총괄만 sub_main에서 PR (CODING_RULES 1·3장) -->

## 무엇을 바꿨나


## 확인 방법
<!-- 어느 화면에서 무엇을 누르면 되는지 -->


## 스크린샷
<!-- 화면을 바꿨을 때만 -->


## AI가 정한 설계 결정
<!-- AI 도구가 스스로 고른 구조·이름·라이브러리가 있으면 적는다. 없으면 "없음" -->


## 체크
- [ ] `npm run typecheck` / `npm run lint` / `npm run build` 통과 (CI도 확인)
- [ ] `.env*`, API 키, 실제 리뷰 원문 대량 데이터를 커밋하지 않았다
- [ ] 다른 사람 영역(CODING_RULES 4장)을 건드렸으면 그 사람을 리뷰어로 넣었다 (공용 영역은 총괄 `@miamobann`)
- [ ] 결정이 필요한 부분은 임의로 정하지 않고 CLAUDE.md 11장 열린 질문에 올렸다

<!-- DB, lib/schemas, lib/mock, lib/data, supabase/, collectors/ 를 건드렸으면 아래를 남기고 체크한다. 아니면 지운다 (DB_RULES 6장) -->
### DB 체크리스트
- [ ] 기존 마이그레이션 파일은 수정하지 않았다 (새 파일만, `supabase migration new`로 생성)
- [ ] 이름 변경·삭제·타입 변경이 없다 (있으면 합의한 채팅 링크: )
- [ ] 새 컬럼은 null 허용이거나 default가 있다
- [ ] 새 테이블에 workspace_id + 인덱스 + RLS 정책이 있다 (공용 테이블이면 이유: )
- [ ] docs/db-frame.md와 CLAUDE.md 5장 표를 같이 고쳤다
- [ ] 외래 키에 on delete 동작과 인덱스를 정했다
- [ ] lib/schemas Zod를 같이 고쳤다 (DB 컬럼은 .nullable())
- [ ] lib/mock 가짜 데이터를 같이 고쳤고 빌드가 통과한다
- [ ] 수집·upsert 키에 workspace_id가 들어 있다
- [ ] platform_id는 코드 상수(lib/platforms.ts)의 slug만 쓴다 (데모는 qoo10)
- [ ] service role 키는 서버 코드에서만 쓴다
- [ ] 다른 탭 테이블을 건드렸으면 그 담당자를 리뷰어로 넣었다
