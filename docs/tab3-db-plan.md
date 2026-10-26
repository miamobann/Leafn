# TAB 3 광고 검토 DB 안

> 상태: **반영 완료** · 안 2026-10-24 · 머지 #66, 권한 보완 `20261024172221_harden_ad_review_writes.sql` · 화면 연결 #78 (2026-10-25) · 정리 2026-10-25 (정리 전 원문: [archive/pre_tab3-db-plan.md](archive/pre_tab3-db-plan.md))
> 지금 테이블 칸의 기준은 마이그레이션과 [db-frame.md](db-frame.md) "광고 검토" 절이다. 이 문서는 그 결정의 이유를 남긴 기록이다.
> 근거: `docs/db-frame.md` 2장(ad_checks 세부 칸은 TAB 3 담당자 안을 따른다) · 7장 열린 질문(승인 권한 → TAB 3 담당자) · `docs/DB_RULES.md`
> 마이그레이션: `supabase/migrations/20261024130000_create_ad_checks.sql`, `20261024172221_harden_ad_review_writes.sql`
> Zod: `lib/schemas/ad-check.ts`의 `AdCheckRow`·`AdCheckLineRow`, `lib/schemas/content-guide.ts`의 `ContentGuideRow`

## 1. 정한 것

| 항목 | 결정 | 누가 |
| --- | --- | --- |
| 저장 | 판정·제작할 때 **자동 저장** | 총괄 |
| 테이블 | `ad_checks`(검토 한 건) · `ad_check_lines`(줄별 판정) · `content_guides`(콘텐츠 가이드 결과물) 셋으로 나눈다 | 총괄 |
| 삭제 | 약기법 검토는 **숨김**(`deleted_at`), 콘텐츠 가이드 결과물은 **행 삭제** | TAB 3 |
| 숨긴 검토 복구 | 화면에는 두지 않는다. 필요하면 DB 관리자가 `deleted_at`을 비운다 | TAB 3 |
| 삭제 버튼 | owner(팀장) 화면에만 그린다. 팀원 화면에는 버튼이 없다 (검토 이력 · 만든 가이드) | TAB 3 (2026-10-25) |
| 콘텐츠 가이드 제목 | 고른 제목 하나만 저장한다. AI가 낸 후보 제목은 저장하지 않는다 | TAB 3 |
| 검사 저장 실패 | 결과물은 저장하고 화면에 "검사 기록 저장 실패" 안내만 띄운다 | TAB 3 (2026-10-25) |
| 콘텐츠 가이드 검사 승인 | 승인 대상이 아니다. 검토 상세에서 보기만 한다 | TAB 3 (2026-10-25) |
| 콘텐츠 문구 자동 검사 | `ad_checks.source = 'content_guide'`로 저장. 검토 이력에는 보이지 않고 「만든 가이드」의 약기법 칸·상세에서 본다 | TAB 3 (2026-10-25) |
| 만든 가이드 → 새 검토 | 결과 아래 「이 문구로 새 검토 →」: 제목과 블록별 첫 안을 한 줄씩 새 검토 입력칸에 채운다 (`/ad-check?guide=<id>`, 자동 판정 안 함) | TAB 3 (2026-10-25, 실무자 비판 5번) |
| 새 검토 → 가이드에 반영 | 만든 가이드에서 넘어온 새 검토는 판정 뒤 「가이드에 반영」: 고른 대체 표현으로 **수정본을 새 행**으로 만든다 (`parent_id` = 원본, `ad_check_id` = 그 새 검토). 원본과 그 검사 기록은 덮어쓰지 않는다. 「고쳐야 함」 줄은 대체 표현을 골라야 하고, 서버가 재검토 통과 대체 표현인지 다시 확인한다. 줄을 더하거나 빼면 반영할 수 없다. 「만든 가이드」 목록은 수정본이 있는 이전 버전을 숨기고 최신 수정본만 보여 준다 (지우지 않음, 수정본의 「이전 버전 보기」로 연다) | TAB 3 (2026-10-26) |
| 검토 상세에서 가이드에 반영 | 만든 가이드에서 온 새 검토는 `ad_checks.content_guide_id`에 그 가이드를 남긴다. 검토 상세에서 누구나(팀장이 팀원 검토를 이어받아도) 대체 표현을 골라 「가이드에 반영」. 같은 검토로 두 번 반영하지 않고(「반영됨 · 수정본 보기」), 그 사이 더 새 수정본이 생겼으면 막고 최신에서 다시 검토하게 한다. 팀장 승인(내부 검토 완료)과 반영은 따로 | TAB 3 (2026-10-26) |
| 블록별 메모 | `content_guides.memos`에 자동 저장. update가 owner만이라 멤버는 `set_content_guide_memos()`로 메모 칸만 바꾼다 | TAB 3 (2026-10-26) |
| 리뷰 탭 연결 | 「소구점 찾기」 → `/ad-check/guide?product=&topics=`: 고른 소구점을 미리 골라 두고, 담당자가 「참고 자료」에서 눌러 다시 고를 수 있다 (순함은 약기법으로 목록에서 빠짐). 승인된 일본어 후기는 프롬프트 v4 `[승인된 일본어 후기]`로 그대로 인용, 없으면 한국어 리뷰 원문. 승인본 번역 ID는 `input.approved_quotes[].translation_id`로 남는다 | TAB 3 · 리뷰 탭 (2026-10-26) |
| 검토 이력의 리뷰 번역 검토 | `review_translations.ad_check_id`로 연결된 검토는 용도 칸에 「리뷰」로 표시하고 「종류」 필터(직접 검토 · 리뷰 번역)를 둔다. DB 용도 값은 `detail_page` 그대로 (마이그레이션 없음). 화면의 「사용처」는 「용도」로 | TAB 3 (2026-10-26) |
| 전문가 확인 자료 | 만들지 않는다 (보조 기능이 신뢰를 떨어뜨린다는 피드백) | TAB 3 (2026-10-25) |
| AI 사용량(토큰) | 저장하지 않는다. 필요해지면 새 마이그레이션으로 추가 | TAB 3 |
| 승인·수정·삭제 권한 | ~~처음에는 멤버 누구나~~ → **owner(팀장)만** 승인·반려·수정·삭제를 한다 (RLS `owners update` + 서버 확인). 저장(insert)은 멤버 누구나 | 총괄 (2026-10-24, harden 마이그레이션) |

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

## 4. 총괄(Min) 확인 결과 (2026-10-25 정리)

1. 3장의 차이(delete 정책을 두지 않은 것): 그대로 머지됐다 (#66).
2. 실데이터 전환: 광고 검토 화면이 DB를 읽고 쓴다 (#66). 콘텐츠 가이드가 읽는 리뷰·행사 일정도 DB 조회로 바뀌었다 (`docs/DATA_CONNECTIONS.md`).
3. 콘텐츠 가이드의 한국 리뷰 인용 문제: CLAUDE.md 11장 (F) 줄에 함께 적었다.
4. CLAUDE.md 5장·db-frame 2장 반영: 했다 (2026-10-25 문서 정리).

## 5. 화면 연결 (2026-10-25, 새 검토 자동 저장·조회는 #66, 콘텐츠 가이드 검사 저장·「만든 가이드」는 #78에서 반영)

- 새 검토: 판정하면 `ad_checks` + `ad_check_lines` 자동 저장 (총괄). 검토 이력은 직접 검토만 보여 주고 owner 삭제(숨김) 버튼. 콘텐츠 문구 자동 검사는 「만든 가이드」에서만 본다 (2026-10-25 결정)
- 콘텐츠 가이드: 만들면 검사(`ad_checks`, source=content_guide, 블록마다 한 줄 + block_key)와 `content_guides`(ad_check_id로 연결) 자동 저장
- 「만든 가이드」 탭 `/ad-check/guide/history`: 검토 이력과 같은 표, owner 삭제 버튼. 줄을 누르면 `/ad-check/guide/history/<id>`에서 만들었을 때 화면 그대로 다시 연다 (AI 다시 안 부름)
- API: `DELETE /api/ad-check/:id`(숨김), `DELETE /api/content-guide/:id`(행 삭제). 둘 다 owner만
