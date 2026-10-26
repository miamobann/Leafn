// 콘텐츠 제작 가이드 결과 → 화면·PDF에 보여 줄 블록·해시태그·제품 채우기. 제작 화면(content-guide.tsx)이 쓴다.
import { fillProduct, type GuideBlock, type GuideChannel, type Hashtags, IG_HASHTAG_LIMIT, keywordToHashtag } from "./content-guide-samples";
import { withShotDefaults } from "./photo-guide";
import type { LabProduct } from "./products";

/** 인스타그램 해시태그에 붙일 검색어 태그 수 (시장 분석 검색어 1위) */
export const KEYWORD_TAGS = 1;

/** 제품 종류 (AI·미리보기·상품명에 쓰는 이름). 에멀전은 에센스·스킨으로 바꾸지 않고 에멀전(乳液)으로 둔다 */
export function productKind(product: LabProduct): { ko: string; ja: string } {
  const line = product.line;
  if (line.includes("에센스") || line.includes("美容液")) return { ko: "에센스", ja: "美容液" };
  if (line.includes("에멀전") || line.includes("乳液")) return { ko: "에멀전", ja: "乳液" };
  return { ko: "스킨", ja: "化粧水" };
}

/** 피부 라인: DB 값이 있으면 그것, 없으면(샘플) line 글자로 */
export function skinLineOf(product: LabProduct): "dry" | "oily" | "combo" | null {
  if (product.skin_line) return product.skin_line;
  if (product.line.includes("복합성")) return "combo";
  if (product.line.includes("건성")) return "dry";
  if (product.line.includes("지성")) return "oily";
  return null;
}

/** {product}·{ingredients_*} 자리에 제품 정보를 넣는 함수 */
export function makeFill(product: LabProduct) {
  const kind = productKind(product);
  return (text: string) =>
    fillProduct(text, product.name_ko, product.ingredients, { kind_ja: kind.ja, kind_ko: kind.ko, volume: product.volume, product_ja: product.name_ja });
}

export function visibleBlocks(blocks: GuideBlock[], channel: GuideChannel, slideCount: number, hasReviews: boolean) {
  // AI가 비운 사진 칸은 블록별 기본 촬영 지시로 채운다 (미리보기 · PDF · 촬영 가이드가 같이 쓴다)
  return withShotDefaults(blocks, channel).filter(
    (b) =>
      // 리뷰가 없는 제품(개발 중)은 리뷰 블록을 뺀다
      (!b.needs_reviews || hasReviews) &&
      // 인스타그램은 고른 장 수까지만 (1장 = 단일 게시물, 2~5장 = 여러 장)
      (channel !== "instagram" || !b.key.startsWith("slide") || Number(b.key.slice(5)) <= slideCount),
  );
}

/** 해시태그: 인스타그램은 5개(브랜드 1 + 성분·제형 1 + 고민·트렌드 2 + 검색어 1), X는 결과 그대로 */
export function pickHashtags(hashtags: Hashtags, channel: GuideChannel, keywords: string[]) {
  const keywordTags = channel === "instagram" ? keywords.slice(0, KEYWORD_TAGS).map(keywordToHashtag) : [];
  const groups: Hashtags =
    channel === "instagram"
      ? {
          brand: hashtags.brand.slice(0, 2),
          ingredient: hashtags.ingredient.slice(0, 1),
          trend: [...new Set([...hashtags.trend.slice(0, IG_HASHTAG_LIMIT - 3 - KEYWORD_TAGS), ...keywordTags])],
        }
      : hashtags;
  return { groups, keywordTags, list: [...groups.brand, ...groups.ingredient, ...groups.trend] };
}
