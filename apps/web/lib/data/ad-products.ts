import { getProducts } from "./index";
import { dataContext } from "./db";
import { PRODUCTS, type LabProduct } from "@/app/(internal)/(dashboard)/ad-check/_lib/products";

/** 광고 검토·콘텐츠 제작에서 성분으로 쓰지 않는 성분. 판테놀은 팀 결정(2026-10-23)으로 뺐다 (제품규격서 값은 그대로 두고 불러올 때만 뺀다) */
const EXCLUDED_INGREDIENTS = /パンテノール|판테놀|panthenol/i;

/** 이름으로 샘플 제품을 추정 연결하지 않는다. 미등록 정보는 판정에 사실처럼 보내지 않는다. */
export async function getAdProducts(): Promise<LabProduct[]> {
  if (!(await dataContext())) return PRODUCTS;
  return (await getProducts({ kind: "own" })).filter((p) => p.ingredients.length > 0).map((p) => ({
    id: p.id, name_ko: p.name, name_ja: p.name,
    line: p.category ?? "미등록", launch_status: p.sale_status === "on_sale" ? "live" : "developing",
    product_category: null, volume: p.volume_ml === null ? "미등록" : `${p.volume_ml}ml`,
    price_jpy: p.price_jpy ?? 0, container: "미등록",
    ingredients: p.ingredients.filter((name) => !EXCLUDED_INGREDIENTS.test(name)).map((name) => ({ ko: name, inci: name, ja: name })),
  }));
}
