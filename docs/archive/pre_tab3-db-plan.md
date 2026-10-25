> **기록용 보관본 (pre_).** 2026-10-25 문서 정리 전의 내용을 그대로 둔 것이다 (sub_main `cc0ee17`). **따르지 않는다.** 현재 문서: [tab3-db-plan.md](../tab3-db-plan.md)

# TAB 3 광고 검토 DB 안

> 상태: TAB 3 담당자 안 · 2026-10-24 · 총괄(Min) 리뷰 대기
> 근거: `docs/db-frame.md` 2장(ad_checks 세부 칸은 TAB 3 담당자 안을 따른다) · 7장 열린 질문(승인 권한 → TAB 3 담당자) · `docs/DB_RULES.md`
> 마이그레이션: `supabase/migrations/20261024130000_create_ad_checks.sql` (db-frame 5장 4번 파일)
> Zod: `lib/schemas/ad-check.ts`의 `AdCheckRow`·`AdCheckLineRow`, `lib/schemas/content-guide.ts`의 `ContentGuideRow`

## 1. 정한 것

| 항목 | 결정 | 누가 |
| --- | --- | --- |
| 저장 | 판정·제작할 때 **자동 저장** | 총괄 |
| 테이블 | `ad_checks`(검토 한 건) · `ad_check_lines`(줄별 판정) · `content_guides`(콘텐츠 가이드 결과물) 셋으로 나눈다 | 총괄 |
| 삭제 | 약기법 검토는 **숨김**(`deleted_at`), 콘텐츠 가이드 결과물은 **행 삭제** | TAB 3 |
| 숨긴 검토 복구 | 화면에는 두지 않는다. 필요하면 DB 관리자가 `deleted_at`을 비운다 | TAB 3 |
| 콘텐츠 가이드 검사 | `ad_checks.source = 'content_guide'`로 저장. 검토 이력은 기본으로 직접 검토(`manual`)만, 필터로 콘텐츠 가이드 검사도 본다 | TAB 3 |
| AI 사용량(토큰) | 저장하지 않는다. 필요해지면 새 마이그레이션으로 추가 | TAB 3 |
| 승인 권한 | 처음에는 멤버 누구나 (db-frame 4장 기본 규칙). 필요해지면 owner로 좁힌다 | TAB 3 |

## 2. 테이블

```
workspaces ─┬─ ad_checks ──┬── ad_check_lines      (검토를 지우면 같이: cascade)
            │   │  │       └── content_guides.ad_check_id  (결과물을 지워도 검토는 남음)
            │   │  └─ promo_events  (set null)
            │   └──── products      (set null)
            └─ content_guides ── products · promo_events (set null)
```

### ad_checks (검토 한 건)

| 칸 | 타입 | 설명 |
| --- | --- | --- |
| id · created_at · updated_at · workspace_id | | 공통 칸 |
| created_by | uuid → profiles, null 허용 | 검토를 만든 사람 |
| source | `manual` · `content_guide` | 어디서 돌린 검사인지 |
| input_text · input_lang | text · `ko`·`ja` | 입력 원문 (여러 줄) |
| usage | `detail_page`·`sns`·`banner`·`survey_result`·`notify_button`, null 허용 | 어디에 쓸 문구인지 |
| product_category | `general_cosmetic`·`quasi_drug`, null 허용 | 일반 화장품 / 의약부외품 |
| product_id · promo_event_id | uuid, null 허용 | 어느 제품·행사의 문구인지 |
| overall_risk · overall_action | null 허용 | 전체 위험도와 해야 할 일 |
| review_status | `pending`·`approved`·`rejected` | 담당자 검토 상태 |
| reviewer_id · reviewer_note · reviewed_at | null 허용 | 승인·반려한 사람과 메모 |
| final_text | null 허용 | 담당자가 확정한 문구 |
| is_expert_review_requested | boolean | 전문가 확인을 요청했는지 |
| model · prompt_version | text | AI 결과 추적 (CLAUDE.md 5장) |
| deleted_at | null 허용 | 화면의 삭제 = 숨김 |

### ad_check_lines (줄별 판정)

| 칸 | 설명 |
| --- | --- |
| ad_check_id · line_index | 어느 검토의 몇 번째 줄인지. unique |
| block_key | 콘텐츠 가이드 검사일 때 어느 블록인지. 새 검토는 null |
| original | 그 줄 원문 |
| action | 줄의 판정 (`must_fix`·`should_fix`·`expert`·`ok`) |
| findings | 위험 표현 목록 jsonb (`AdFinding[]`: 사유·근거·대체 표현·재검토) |
| ingredient_check · translated_text · back_translation_ko · localized_note | 줄 단위로 나오는 성분 확인·번역·역번역·현지화 메모 |

### content_guides (콘텐츠 가이드 결과물)

| 칸 | 설명 |
| --- | --- |
| created_by · product_id · promo_event_id | 만든 사람, 제품, 행사 |
| channel · post_type | 채널(큐텐 상세·인스타·X·배너), 글 종류(일반·메가와리·시즌) |
| input · title · body | 제작 요청, 고른 제목, 본문 결과 (jsonb, 모양은 Zod) |
| lint_hits | 규칙 검사에 걸린 곳 |
| ad_check_id | 이 결과물을 판정한 검사 (`ad_checks.source = 'content_guide'`) |
| model · prompt_version | AI 결과 추적 |

## 3. 프레임과 달라진 점

| 프레임 (db-frame 2장) | 이 안 | 이유 |
| --- | --- | --- |
| `ad_checks.findings jsonb` | `ad_check_lines.findings`로 옮김 | 한 검토가 여러 줄이고, 줄마다 판정·번역이 따로 나온다 (총괄 결정: 테이블 따로) |
| 4번 파일에 `review_translations` | 이번에는 만들지 않음 | 참조 기능 F 테이블. F를 만들 때 추가 (CLAUDE.md 1장) |
| 테이블마다 정책 4개 | `ad_checks`·`ad_check_lines`는 delete 정책 없음 | 화면의 삭제가 숨김(update)이라 행 삭제를 막는다. 행 삭제는 DB 관리자만 |
| (없음) | `ad_check_lines`, `content_guides` 추가 | 위 1장 결정 |

## 4. 총괄(Min)께 확인 부탁

1. 위 3장의 차이(특히 delete 정책을 두지 않은 것)가 괜찮은지
2. 실데이터 전환: 콘텐츠 가이드가 읽는 리뷰 원문·메가와리 일정은 지금 가짜 데이터. TAB 3은 `lib/data` 함수만 바꾸면 되니, TAB 2·진출 실행 화면이 Supabase로 바뀐 뒤에 따라가도 되는지
3. 열린 질문(CLAUDE.md 11장) 추가: 콘텐츠 가이드가 한국 리뷰를 일본어 후기로 인용한다. (F) "국내 리뷰를 일본 상세페이지에 게시할 권리"와 같은 문제라서 그 줄에 "콘텐츠 가이드도 해당"을 붙이자는 제안
4. 합의되면 CLAUDE.md 5장·db-frame 2장 표에 세 테이블을 반영

## 5. 다음 단계 (이 안이 머지되고 DB에 적용된 뒤)

- 새 검토: 판정하면 `ad_checks` + `ad_check_lines` 자동 저장, 검토 이력에서 삭제(숨김)·출처 필터
- 콘텐츠 가이드: 만들면 `content_guides` + 검사(`ad_checks`, source=content_guide) 자동 저장, 「만든 결과물」 목록과 삭제 버튼
- `lib/data`의 `getAdChecks`·`getAdCheck`를 Supabase 조회로 바꾸고 `deleted_at`이 있는 행은 뺀다
