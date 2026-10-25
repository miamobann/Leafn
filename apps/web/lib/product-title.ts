// 제품명 표시: AI가 정리한 제품명(products.title_ai)이 있으면 "브랜드 · 짧은 제품명 · 용량 · 대표 성분"으로 줄이고,
// 한국어 캡션을 따로 준다. 정리 전이면 원문 제품명을 그대로 보여 준다 (원문은 항상 full 로 남는다).
import type { ProductTitleAi } from "@/lib/schemas/product";

export type TitleView = {
  /** 화면에 크게 보이는 제목 (일본어) */
  main: string;
  /** 그 아래 한국어 캡션. 정리 전이면 null */
  caption: string | null;
  /** 원문 제품명 (브랜드 + 제목). 툴팁이나 "원문 보기"에 쓴다 */
  full: string;
  /** AI 정리 결과로 줄였는가 */
  cleaned: boolean;
};

const join = (parts: (string | null | undefined)[]) => parts.filter((p): p is string => Boolean(p && p.trim())).join(" · ");

export function titleParts(p: { brand: string; name: string; title_ai?: ProductTitleAi | null }): TitleView {
  const full = `${p.brand} ${p.name}`.trim();
  const t = p.title_ai;
  if (!t) return { main: full, caption: null, full, cleaned: false };
  return {
    main: join([p.brand, t.name_short_ja, t.volume, t.key_ingredient_ja]),
    caption: join([t.brand_ko, t.name_ko, t.volume, t.key_ingredient_ko]) || null,
    full,
    cleaned: true,
  };
}
