// 리뷰를 가져올 수 있는 플랫폼. CSV 업로드와 플랫폼 수집 화면이 함께 쓴다.
// id는 lib/platforms.ts의 slug이고 products.platform에 적힌 값과 같다. 늘릴 때는 거기에 slug를 먼저 추가한다.
export const IMPORT_PLATFORMS = [
  { id: "qoo10", label: "Qoo10" },
  { id: "rakuten", label: "라쿠텐 (楽天市場)" },
] as const;
