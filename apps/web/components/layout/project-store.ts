"use client";

// 상단 헤더와 프로젝트·제품 관리 화면이 함께 쓰는 프로젝트(제품군) 상태.
// 로그인한 워크스페이스가 있으면 DB(lib/data/projects.ts)에서 읽고 쓴다.
// DB를 못 쓰면(로그인 전, 마이그레이션 적용 전) 가짜 데이터(base)에 이 브라우저에서 추가한 프로젝트·제품을 더한다.
// 헤더에서 고른 프로젝트는 어느 쪽이든 이 브라우저에 기억한다.
import { useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import {
  createProjectProduct,
  createProject,
  type ProjectWithProducts,
  listProjects,
  type ProjectsResult,
} from "@/lib/data/projects";
import { ProjectProduct, NewProjectProduct, NewProject, Project } from "@/lib/schemas/project";

export type { ProjectWithProducts };

const STORAGE_KEY = "leafn.projects.v1";

const Saved = z.object({
  projects: z.array(Project),
  products: z.array(ProjectProduct),
  selectedId: z.string().nullable(),
});
type Saved = z.infer<typeof Saved>;

/** loading = DB 확인 중, db = DB 행, sample = 가짜 데이터 + 이 브라우저 저장 */
type SampleReason = Extract<ProjectsResult, { source: "sample" }>["reason"];
export type StoreSource =
  | { kind: "loading" }
  | { kind: "db"; projects: ProjectWithProducts[] }
  | { kind: "sample"; reason: SampleReason; message?: string };

type State = { saved: Saved; source: StoreSource };

const EMPTY: Saved = { projects: [], products: [], selectedId: null };
const SERVER_STATE: State = { saved: EMPTY, source: { kind: "loading" } };

let state: State | null = null;
let fetching = false;
const listeners = new Set<() => void>();

function readSaved(): Saved {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Saved.safeParse(JSON.parse(raw)) : null;
    return parsed?.success ? parsed.data : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getState(): State {
  if (!state) state = { saved: readSaved(), source: { kind: "loading" } };
  return state;
}

function setState(next: State) {
  const prev = getState();
  state = next;
  if (next.saved !== prev.saved) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.saved));
    } catch {
      // 기억하지 못해도 이번 화면에서는 그대로 보인다
    }
  }
  listeners.forEach((l) => l());
}

/** 화면이 처음 구독할 때 한 번 DB를 확인한다 */
function fetchOnce() {
  if (fetching) return;
  fetching = true;
  listProjects()
    .then((r) => {
      setState({ ...getState(), source: r.source === "db" ? { kind: "db", projects: r.projects } : { kind: "sample", reason: r.reason, message: r.message } });
    })
    .catch((e: unknown) => {
      setState({ ...getState(), source: { kind: "sample", reason: "error", message: e instanceof Error ? e.message : String(e) } });
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  fetchOnce();
  // 다른 탭에서 고르거나 추가한 내용도 따라온다
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    setState({ ...getState(), saved: readSaved() });
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** 이 브라우저에서 만든 행의 ID. DB 행은 uuid를 DB가 만든다 (DB_RULES 4.2) */
function localId(prefix: string) {
  return `${prefix}-local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export type AddResult = { ok: true; id: string } | { ok: false; message: string };

/**
 * base = 서버가 넘긴 가짜 데이터의 프로젝트 목록 (DB를 못 쓸 때와 확인 중에 보인다).
 * current = 헤더에서 고른 프로젝트 (고른 적이 없거나 사라졌으면 첫 프로젝트)
 */
export function useProjects(base: ProjectWithProducts[]) {
  const { saved, source } = useSyncExternalStore(subscribe, getState, () => SERVER_STATE);

  const projects = useMemo<ProjectWithProducts[]>(() => {
    if (source.kind === "db") return source.projects;
    if (source.kind === "sample" && source.reason !== "not_configured") return [];
    if (source.kind === "loading") return base;
    const all = [...base, ...saved.projects.map((p) => ({ ...p, products: [] }))];
    return all.map((pj) => ({ ...pj, products: [...pj.products, ...saved.products.filter((p) => p.project_id === pj.id)] }));
  }, [base, saved, source]);

  const current = projects.find((p) => p.id === saved.selectedId) ?? projects[0] ?? null;
  const workspaceId = base[0]?.workspace_id ?? "ws-1";

  function select(id: string) {
    setState({ ...getState(), saved: { ...getState().saved, selectedId: id } });
  }

  /** 새 프로젝트를 만들고 바로 고른다 */
  async function addProject(input: NewProject): Promise<AddResult> {
    const s = getState();
    if (s.source.kind === "loading") return { ok: false, message: "아직 불러오는 중이에요. 잠시 뒤 다시 눌러 주세요" };
    if (s.source.kind === "db") {
      const r = await createProject(input);
      if (!r.ok) return r;
      const now = getState();
      const dbProjects = now.source.kind === "db" ? now.source.projects : [];
      setState({ saved: { ...now.saved, selectedId: r.row.id }, source: { kind: "db", projects: [...dbProjects, r.row] } });
      return { ok: true, id: r.row.id };
    }
    if (s.source.kind === "sample" && s.source.reason !== "not_configured") return { ok: false, message: s.source.message ?? "로그인과 워크스페이스를 확인해 주세요" };
    const project = Project.parse({ ...NewProject.parse(input), id: localId("pl"), workspace_id: workspaceId, created_at: new Date().toISOString() });
    setState({ ...s, saved: { ...s.saved, projects: [...s.saved.projects, project], selectedId: project.id } });
    return { ok: true, id: project.id };
  }

  async function addProduct(projectId: string, input: NewProjectProduct): Promise<AddResult> {
    const s = getState();
    if (s.source.kind === "loading") return { ok: false, message: "아직 불러오는 중이에요. 잠시 뒤 다시 눌러 주세요" };
    if (s.source.kind === "db") {
      const r = await createProjectProduct(projectId, input);
      if (!r.ok) return r;
      const now = getState();
      if (now.source.kind === "db") {
        const nextProjects = now.source.projects.map((p) => (p.id === projectId ? { ...p, products: [...p.products, r.row] } : p));
        setState({ ...now, source: { kind: "db", projects: nextProjects } });
      }
      return { ok: true, id: r.row.id };
    }
    if (s.source.kind === "sample" && s.source.reason !== "not_configured") return { ok: false, message: s.source.message ?? "로그인과 워크스페이스를 확인해 주세요" };
    const product = ProjectProduct.parse({
      ...NewProjectProduct.parse(input),
      id: localId("lp"),
      workspace_id: workspaceId,
      created_at: new Date().toISOString(),
      project_id: projectId,
    });
    setState({ ...s, saved: { ...s.saved, products: [...s.saved.products, product] } });
    return { ok: true, id: product.id };
  }

  return { projects, current, source, select, addProject, addProduct };
}
