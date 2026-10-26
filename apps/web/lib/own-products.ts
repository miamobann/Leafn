// 자사 제품 이름표. 제품명은 docs/Product.md가 기준이고, 코드에서는 이 상수만 쓴다.
// 이름을 화면·mock·프롬프트에 새로 적지 말고 ownProductName()으로 가져온다. 이름이 바뀌면 Product.md와 여기를 같은 PR에서 고친다.
// 이미지는 apps/web/public/products/ 아래 라인별 세트 사진 (원본 PNG는 팀 드라이브, 여기는 1600px WebP)
export const OWN_BRAND = "Leaf&";
export const OWN_PRODUCT_LINE = "Leaf& Dew";

export const OWN_LINE_IMAGES = {
  dry: "/products/leaf-dew-dry-set.webp",
  combo: "/products/leaf-dew-mild-set.webp",
  oily: "/products/leaf-dew-tea-pure-set.webp",
} as const;

export const OWN_PRODUCTS = [
  { id: "deep-skin", name: "Leaf& Dew Deep Skin", skin_line: "dry", status: "on_sale" },
  { id: "core-essence", name: "Leaf& Dew Core Essence", skin_line: "dry", status: "on_sale" },
  { id: "mild-skin", name: "Leaf& Dew Mild Skin", skin_line: "combo", status: "in_development" },
  { id: "mild-emulsion", name: "Leaf& Dew Mild Emulsion", skin_line: "combo", status: "in_development" },
  { id: "tea-pure-skin", name: "Leaf& Dew Tea-Pure Skin", skin_line: "oily", status: "in_development" },
  { id: "tea-pure-calming-ampoule", name: "Leaf& Dew Tea-Pure Calming Ampoule", skin_line: "oily", status: "in_development" },
] as const;

export type OwnProductId = (typeof OWN_PRODUCTS)[number]["id"];

/** 자사 제품의 확정 이름 */
export function ownProductName(id: OwnProductId): string {
  return OWN_PRODUCTS.find((p) => p.id === id)!.name;
}

/** 자사 제품이 속한 라인의 세트 사진 경로 */
export function ownProductImage(id: OwnProductId): string {
  return OWN_LINE_IMAGES[OWN_PRODUCTS.find((p) => p.id === id)!.skin_line];
}

/** 화면에 자사 제품을 늘어놓는 순서 (OWN_PRODUCTS 순서: Deep Skin → Core Essence → …). 자사 제품이 아니면 맨 뒤 */
export function ownProductOrder(name: string): number {
  const i = OWN_PRODUCTS.findIndex((p) => p.name === name);
  return i === -1 ? OWN_PRODUCTS.length : i;
}
