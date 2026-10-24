"use client";

// 상단 헤더와 프로젝트·제품 관리 화면이 함께 쓰는 프로젝트(제품군) 상태.
// 가짜 데이터(getProductLines)에 이 브라우저에서 추가한 프로젝트·제품을 더한다. DB가 생기면 추가는 lib/data 쓰기 함수로 바꾼다.
// 저장소를 못 쓰는 환경(시크릿 창 등)이면 기억하지 않고 이번 화면에서만 보인다.
import { useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import {
  LineProduct,
  NewLineProduct,
  NewProductLine,
  ProductLine,
} from "@/lib/schemas/product-line";

export type LineWithProducts = ProductLine & { products: LineProduct[] };

const STORAGE_KEY = "leafn.product-lines.v1";

const Saved = z.object({
  lines: z.array(ProductLine),
  products: z.array(LineProduct),
  selectedId: z.string().nullable(),
});
type Saved = z.infer<typeof Saved>;

const EMPTY: Saved = { lines: [], products: [], selectedId: null };

let cache: Saved | null = null;
const listeners = new Set<() => void>();

function load(): Saved {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Saved.safeParse(JSON.parse(raw)) : null;
    cache = parsed?.success ? parsed.data : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function store(next: Saved) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 기억하지 못해도 이번 화면에서는 그대로 보인다
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // 다른 탭에서 추가한 내용도 따라온다
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getServerSnapshot = () => EMPTY;

/** 이 브라우저에서 만든 행의 ID. 실제 DB에서는 uuid를 DB가 만든다 (DB_RULES 4.2) */
function localId(prefix: string) {
  return `${prefix}-local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * base = 서버가 넘긴 가짜 데이터의 프로젝트 목록.
 * current = 헤더에서 고른 프로젝트 (고른 적이 없거나 사라졌으면 첫 프로젝트)
 */
export function useProductLines(base: LineWithProducts[]) {
  const saved = useSyncExternalStore(subscribe, load, getServerSnapshot);

  const lines = useMemo<LineWithProducts[]>(() => {
    const all = [...base, ...saved.lines.map((l) => ({ ...l, products: [] }))];
    return all.map((l) => ({ ...l, products: [...l.products, ...saved.products.filter((p) => p.product_line_id === l.id)] }));
  }, [base, saved]);

  const current = lines.find((l) => l.id === saved.selectedId) ?? lines[0] ?? null;
  const workspaceId = base[0]?.workspace_id ?? "ws-1";

  function select(id: string) {
    store({ ...load(), selectedId: id });
  }

  /** 새 프로젝트를 만들고 바로 고른다. 만든 프로젝트의 ID를 돌려준다 */
  function addLine(input: NewProductLine) {
    const line = ProductLine.parse({ ...NewProductLine.parse(input), id: localId("pl"), workspace_id: workspaceId, created_at: new Date().toISOString() });
    const prev = load();
    store({ ...prev, lines: [...prev.lines, line], selectedId: line.id });
    return line.id;
  }

  function addProduct(lineId: string, input: NewLineProduct) {
    const product = LineProduct.parse({
      ...NewLineProduct.parse(input),
      id: localId("lp"),
      workspace_id: workspaceId,
      created_at: new Date().toISOString(),
      product_line_id: lineId,
      product_id: null,
    });
    const prev = load();
    store({ ...prev, products: [...prev.products, product] });
  }

  return { lines, current, select, addLine, addProduct };
}
