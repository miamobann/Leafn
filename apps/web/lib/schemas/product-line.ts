import { z } from "zod";
import { PlatformId } from "../platforms";
import { Id, WorkspaceRow } from "./common";

// 제안: 워크스페이스(팀) → 프로젝트(제품군) → 제품 구조 (2026-10-24 총괄 결정).
// 화면에서는 "프로젝트"라고 부른다. 홈 진행 현황판의 projects(프로젝트 하나 = 제품 하나)와 섞이지 않게 코드 이름은 product_lines로 둔다.
// 실제 테이블은 db-frame 합의 전이라 만들지 않고, 가짜 데이터와 이 브라우저 저장소에서만 쓴다.

export const ProductLine = WorkspaceRow.extend({
  name: z.string().min(1),
  /** 진출 플랫폼. 시연은 Qoo10만 연결한다 */
  platform: PlatformId,
  description: z.string().nullable(),
});
export type ProductLine = z.infer<typeof ProductLine>;

export const SkinType = z.enum(["dry", "oily", "combo"]);
export type SkinType = z.infer<typeof SkinType>;

export const SaleStatus = z.enum(["on_sale", "in_development"]);
export type SaleStatus = z.infer<typeof SaleStatus>;

export const LineProduct = WorkspaceRow.extend({
  product_line_id: Id,
  name: z.string().min(1),
  status: SaleStatus,
  skin_type: SkinType.nullable(),
  /** 化粧水 · 美容液처럼 랭킹 카테고리 이름 */
  category: z.string().nullable(),
  /** products(kind=own)에 등록된 행. 아직 리뷰·비교 화면에 올리지 않은 제품은 null */
  product_id: Id.nullable(),
});
export type LineProduct = z.infer<typeof LineProduct>;

/** 추가 폼 입력. id·workspace_id·created_at은 저장하는 쪽이 채운다 */
export const NewProductLine = ProductLine.pick({ name: true, platform: true, description: true });
export type NewProductLine = z.infer<typeof NewProductLine>;

export const NewLineProduct = LineProduct.pick({ name: true, status: true, skin_type: true, category: true });
export type NewLineProduct = z.infer<typeof NewLineProduct>;
