import { LineProduct, ProductLine } from "@/lib/schemas/product-line";
import { OWN_PRODUCT_LINE, OWN_PRODUCTS } from "@/lib/own-products";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 프로젝트(제품군) 하나 = Leaf& Dew. 제품 6종은 lib/own-products.ts의 이름표를 그대로 쓴다.
export const productLines = parseAll(
  ProductLine,
  [
    {
      id: "pl-1",
      name: OWN_PRODUCT_LINE,
      platform: "qoo10",
      description: "건성·지성·복합성 3라인 6종의 Qoo10 진출",
    },
  ].map((l) => ({ ...l, workspace_id: WORKSPACE_ID, created_at: ts("2026-09-20") })),
  "productLines",
);

const SKIN_TYPE = { dry: "dry", oily: "oily", combo: "combo" } as const;

// products(kind=own)에 이미 있는 자사 제품과 연결한다 (lib/mock/products.ts의 p-own-1~4)
const PRODUCT_ROW: Partial<Record<(typeof OWN_PRODUCTS)[number]["id"], string>> = {
  "deep-skin": "p-own-1",
  "core-essence": "p-own-2",
  "tea-pure-skin": "p-own-3",
  "mild-skin": "p-own-4",
};

const CATEGORY: Record<(typeof OWN_PRODUCTS)[number]["id"], string> = {
  "deep-skin": "化粧水",
  "core-essence": "美容液",
  "mild-skin": "化粧水",
  "mild-emulsion": "乳液",
  "tea-pure-skin": "化粧水",
  "tea-pure-calming-ampoule": "美容液",
};

export const lineProducts = parseAll(
  LineProduct,
  OWN_PRODUCTS.map((p, i) => ({
    id: `lp-${i + 1}`,
    workspace_id: WORKSPACE_ID,
    created_at: ts("2026-09-20"),
    product_line_id: "pl-1",
    name: p.name,
    status: p.status,
    skin_type: SKIN_TYPE[p.skin_line],
    category: CATEGORY[p.id],
    product_id: PRODUCT_ROW[p.id] ?? null,
  })),
  "lineProducts",
);
