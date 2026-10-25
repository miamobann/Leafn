import { Project } from "@/lib/schemas/project";
import { OWN_PRODUCT_LINE } from "@/lib/own-products";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 프로젝트(제품군) 하나 = Leaf& Dew. 자사 제품(products kind=own)이 project_id로 여기에 붙는다 (lib/mock/products.ts)
export const OWN_PROJECT_ID = "pj-1";

export const projects = parseAll(
  Project,
  [
    {
      id: OWN_PROJECT_ID,
      name: OWN_PRODUCT_LINE,
      platform_id: "qoo10",
      description: "건성·지성·복합성 3라인 6종의 Qoo10 진출",
    },
  ].map((p) => ({ ...p, workspace_id: WORKSPACE_ID, created_at: ts("2026-09-20") })),
  "projects",
);
