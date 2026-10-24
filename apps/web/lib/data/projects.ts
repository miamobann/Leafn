"use server";

// 프로젝트(제품군)·제품 읽기·쓰기 (Server Action). 상단 헤더와 프로젝트·제품 관리 화면이 부른다.
// 로그인한 워크스페이스가 있으면 Supabase(projects, products.project_id)를 쓰고, 아니면 샘플 데이터라고 알린다.
// 화면 틀(layout)이 쿠키를 읽으면 모든 화면이 매 요청마다 다시 그려지므로, 헤더는 화면이 열린 뒤 이 함수로 불러온다.
// workspace_id는 화면 입력을 믿지 않고 여기서 로그인한 워크스페이스로 채운다 (DB_RULES 4.1).
import { OWN_BRAND } from "@/lib/own-products";
import { NewProject, NewProjectProduct, Project, ProjectProduct } from "@/lib/schemas/project";
import { createClient } from "@/lib/supabase/server";
import { getMyWorkspace, isSupabaseConfigured } from "./workspace";

export type ProjectWithProducts = Project & { products: ProjectProduct[] };

export type ProjectsResult =
  | { source: "db"; projects: ProjectWithProducts[] }
  /** DB를 못 쓰는 경우. reason이 error면 message에 이유 */
  | { source: "sample"; reason: "not_configured" | "signed_out" | "error"; message?: string };

export type SaveResult<T> = { ok: true; row: T } | { ok: false; message: string };

const PROJECT_COLUMNS = "id, created_at, workspace_id, name, platform_id, description";
const PRODUCT_COLUMNS = "id, created_at, workspace_id, project_id, name, sale_status, skin_line, category";

async function workspaceOrNull() {
  if (!isSupabaseConfigured()) return null;
  return (await getMyWorkspace())?.workspace ?? null;
}

function saveError(error: { code?: string; message: string }) {
  if (error.code === "23505") return "같은 이름이 이미 있어요";
  return `저장하지 못했어요: ${error.message}`;
}

export async function listProjects(): Promise<ProjectsResult> {
  if (!isSupabaseConfigured()) return { source: "sample", reason: "not_configured" };
  try {
    const workspace = await workspaceOrNull();
    if (!workspace) return { source: "sample", reason: "signed_out" };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select(`${PROJECT_COLUMNS}, products (${PRODUCT_COLUMNS})`)
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true })
      .order("created_at", { ascending: true, referencedTable: "products" });
    if (error) return { source: "sample", reason: "error", message: error.message };
    const projects = data.map(({ products, ...project }) => ({
      ...Project.parse(project),
      products: ProjectProduct.array().parse(products ?? []),
    }));
    return { source: "db", projects };
  } catch (e) {
    return { source: "sample", reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export async function createProject(input: NewProject): Promise<SaveResult<ProjectWithProducts>> {
  const parsed = NewProject.safeParse(input);
  if (!parsed.success) return { ok: false, message: "입력값을 확인해 주세요" };
  const workspace = await workspaceOrNull();
  if (!workspace) return { ok: false, message: "로그인한 워크스페이스가 없어요" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...parsed.data, workspace_id: workspace.id })
    .select(PROJECT_COLUMNS)
    .single();
  if (error) return { ok: false, message: saveError(error) };
  return { ok: true, row: { ...Project.parse(data), products: [] } };
}

/** 프로젝트에 자사 제품을 더한다 = products에 kind=own 행 하나. 플랫폼은 프로젝트의 진출 플랫폼을 따른다 */
export async function createProjectProduct(projectId: string, input: NewProjectProduct): Promise<SaveResult<ProjectProduct>> {
  const parsed = NewProjectProduct.safeParse(input);
  if (!parsed.success) return { ok: false, message: "입력값을 확인해 주세요" };
  const workspace = await workspaceOrNull();
  if (!workspace) return { ok: false, message: "로그인한 워크스페이스가 없어요" };
  const supabase = await createClient();
  // RLS로 내 워크스페이스의 프로젝트만 보인다. 다른 팀 프로젝트에는 복합 FK (project_id, workspace_id)가 막는다
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("platform_id")
    .eq("id", projectId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (projectError) return { ok: false, message: saveError(projectError) };
  if (!project) return { ok: false, message: "프로젝트를 찾지 못했어요" };
  // products.platform_id는 비울 수 없다 (TAB 2 마이그레이션)
  if (!project.platform_id) return { ok: false, message: "프로젝트의 진출 플랫폼이 정해지지 않았어요" };
  const { data, error } = await supabase
    .from("products")
    .insert({
      ...parsed.data,
      workspace_id: workspace.id,
      project_id: projectId,
      kind: "own",
      brand: OWN_BRAND,
      platform_id: project.platform_id,
    })
    .select(PRODUCT_COLUMNS)
    .single();
  if (error) return { ok: false, message: saveError(error) };
  return { ok: true, row: ProjectProduct.parse(data) };
}
