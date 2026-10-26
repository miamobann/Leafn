import { z } from "zod";
import { PlatformId } from "../platforms";
import { Id, WorkspaceRow } from "./common";

// 워크스페이스(팀) → 프로젝트(제품군, 예: Leaf& Dew) → 제품(products) 구조 (2026-10-24 총괄 결정).
// 테이블: supabase/migrations/20261024104911_projects_products.sql (projects, products.project_id)

export const Project = WorkspaceRow.extend({
  name: z.string().min(1),
  /** 진출 플랫폼. 시연은 Qoo10만 연결한다 */
  platform_id: PlatformId.nullable(),
  description: z.string().nullable(),
});
export type Project = z.infer<typeof Project>;

/** 제품이 겨냥하는 피부 라인 (lib/own-products.ts의 skin_line). 설문의 피부 타입 진단(SkinType)과는 다른 값 */
export const SkinLine = z.enum(["dry", "oily", "combo"]);
export type SkinLine = z.infer<typeof SkinLine>;

export const SaleStatus = z.enum(["on_sale", "in_development"]);
export type SaleStatus = z.infer<typeof SaleStatus>;

/** 프로젝트 화면이 쓰는 products 행의 일부 (products 전체 모양은 product.ts) */
export const ProjectProduct = WorkspaceRow.extend({
  project_id: Id,
  name: z.string().min(1),
  sale_status: SaleStatus.nullable(),
  skin_line: SkinLine.nullable(),
  /** 化粧水 · 美容液처럼 랭킹 카테고리 이름 */
  category: z.string().nullable(),
});
export type ProjectProduct = z.infer<typeof ProjectProduct>;

/** 추가 폼 입력. id·workspace_id·created_at은 저장하는 쪽이 채운다 */
export const NewProject = z.object({
  name: z.string().trim().min(1).max(100),
  platform_id: PlatformId.nullable(),
  description: z.string().trim().max(500).nullable(),
});
export type NewProject = z.infer<typeof NewProject>;

export const NewProjectProduct = z.object({
  name: z.string().trim().min(1).max(100),
  sale_status: SaleStatus,
  skin_line: SkinLine.nullable(),
  category: z.string().trim().max(50).nullable(),
});
export type NewProjectProduct = z.infer<typeof NewProjectProduct>;
