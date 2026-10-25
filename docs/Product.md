# 제품명

> 자사 제품명은 이 문서가 기준이다. 코드에서는 `apps/web/lib/own-products.ts`의 상수를 쓰고, 이름을 새로 지어 적지 않는다.
> 제품 사진은 `apps/web/public/products/`에 라인별 세트로 있다.
> DB: 프로젝트 `Leaf& Dew` 1개(`projects`) + 자사 제품 6행(`products`, `kind = own`). 라인은 `skin_line`(건성 `dry` · 지성 `oily` · 복합성 `combo`), 판매 상태는 `sale_status`(판매 중 `on_sale` · 개발 중 `in_development`). 시드: `supabase/seeds/projects_leaf_dew.sql`.
> 개발 중 제품은 제품 × 탭 진행 표 · 시안 · AI 분석 대상이 아니다. 판매를 시작하면 `sale_status`만 바꾼다.

**Leaf& Dew (리프앤 듀)**
 - 잎사귀에 맺힌 아침 이슬처럼 맑고 촉촉한 수분 공급을 연상시킵니다.
 - **건성**: Leaf& Dew Deep Skin / Leaf& Dew Core Essence
 - **지성 (개발중)**: Leaf& Dew Tea-Pure Skin / Leaf& Dew Tea-Pure Calming Ampoule
 - **복합성 (개발중)**: Leaf& Dew Mild Skin / Leaf& Dew Mild Emulsion

| 라인 | 제품 | 사진 |
| --- | --- | --- |
| 건성 | Deep Skin · Core Essence | `/products/leaf-dew-dry-set.webp` |
| 지성 (개발중) | Tea-Pure Skin · Tea-Pure Calming Ampoule | `/products/leaf-dew-tea-pure-set.webp` |
| 복합성 (개발중) | Mild Skin · Mild Emulsion | `/products/leaf-dew-mild-set.webp` |

## 제품 규격 (제품규격서 2026-10-25)

> 출처: Leaf_and_Dew_제품규격서.pdf. 가격은 Qoo10 가상 가격(세금 포함). 전성분·제형·사용감·유효성분·라인 카피까지 전체 값은 `apps/web/lib/own-product-specs.ts`에 있고, DB에는 `supabase/seeds/leaf_dew_product_specs.sql`로 넣는다.
> 표기: 회사명은 「Leaf &」, 브랜드(라인업)는 「Leaf& Dew」, 일본어는 「リーフ＆デュー」. 메인 컬러 #D4E6D9 (세이지 그린), 서브 컬러 #CCE1EB (소프트 스카이블루).

| 라인 | 제품 | 일본어명 | 종류 | 용량 | 가격 | 상태 | 용기 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 건성 | Deep Skin | リーフ＆デュー ディープスキン | 化粧水 | 200mL | 2,480円 | 판매 중 | 플라스틱 병, 우드 캡 |
| 건성 | Core Essence | リーフ＆デュー コアエッセンス | 美容液 | 50mL | 2,980円 | 판매 중 | 유리 펌프 |
| 복합성 | Mild Skin | リーフ＆デュー マイルドスキン | 化粧水 | 150mL | 2,480円 | 개발 중 | 플라스틱 병 |
| 복합성 | Mild Emulsion | リーフ＆デュー マイルドエマルジョン | 乳液 | 120mL | 2,680円 | 개발 중 (신규) | 펌프 병 |
| 지성 | Tea-Pure Skin | リーフ＆デュー ティーピュアスキン | 化粧水 | 150mL | 2,480円 | 개발 중 | 플라스틱 병 |
| 지성 | Tea-Pure Calming Ampoule | リーフ＆デュー ティーピュアカーミングアンプル | アンプル | 30mL | 2,780円 | 개발 중 (신규) | 유리 펌프 |
