// 콘텐츠 제작 가이드 결과 → 화면·PDF에 보여 줄 블록·해시태그·제품 채우기. 제작 화면(content-guide.tsx)이 쓴다.
import { fillProduct, type GuideBlock, type GuideChannel, type Hashtags, IG_HASHTAG_LIMIT, keywordToHashtag } from "./content-guide-samples";
import type { LabProduct } from "./products";

/** 인스타그램 해시태그에 붙일 검색어 태그 수 (시장 분석 검색어 1위) */
export const KEYWORD_TAGS = 1;

export const isEssence = (product: LabProduct) => product.line.includes("에센스") || product.line.includes("美容液");

/** {product}·{ingredients_*} 자리에 제품 정보를 넣는 함수 */
export function makeFill(product: LabProduct) {
  const essence = isEssence(product);
  return (text: string) =>
    fillProduct(text, product.name_ko, product.ingredients, { kind_ja: essence ? "美容液" : "化粧水", kind_ko: essence ? "에센스" : "스킨", volume: product.volume, product_ja: product.name_ja });
}

export function visibleBlocks(blocks: GuideBlock[], channel: GuideChannel, slideCount: number, hasReviews: boolean) {
  return blocks.filter(
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
