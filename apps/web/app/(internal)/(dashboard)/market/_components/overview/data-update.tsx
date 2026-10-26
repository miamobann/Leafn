"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { HelpTip } from "@/components/common/help-tip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TRENDS_CATEGORIES } from "@/lib/external/search-terms";
import { GEO_ENGINE_LABEL, GeoRunResult, type GeoEngine, type GeoSnap } from "@/lib/schemas/geo";
import { AutocompleteRunResult, type SearchSnap } from "@/lib/schemas/search";

// 시장 분석 제목 옆 [데이터 업데이트] (2026-10-26): 탭마다 따로 누르던 「지금 수집」·「AI 질의」를 한 번에 한다.
// 고른 카테고리 기준 · 성분 검색 관심도(SerpApi) + 고민 검색 추천어(SerpApi) + AI 검색 답변(GEO, 엔진마다).
// 결과는 각 API가 DB에 저장하고(이전 결과는 그대로 쌓임), 화면은 새 결과로 바로 바뀐다. 랭킹(CSV)과 SNS(영상 링크 필요)는 여기서 하지 않는다

const ENGINES: GeoEngine[] = ["chatgpt", "claude"];

type ItemResult = { label: string; status: "ok" | "skip" | "error"; note: string };

function errorOf(json: unknown, status: number): string {
  return typeof json === "object" && json && "error" in json && typeof json.error === "string" ? json.error : `오류 (${status})`;
}

async function post(url: string, body?: unknown): Promise<{ ok: true; json: unknown } | { ok: false; status: number; message: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json: unknown = await res.json();
    return res.ok ? { ok: true, json } : { ok: false, status: res.status, message: errorOf(json, res.status) };
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : "요청 실패" };
  }
}

const day = (iso: string | null | undefined) => (iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}` : "없음");
const latestOf = (dates: string[]) => dates.toSorted().at(-1) ?? null;

export function DataUpdate({
  category,
  rankingAt,
  search,
  geo,
  snsAt,
  onSearch,
  onGeo,
}: {
  category: string;
  /** 지금 보고 있는 랭킹의 수집 시각 (CSV) */
  rankingAt: string | null;
  search: SearchSnap[];
  geo: GeoSnap[];
  /** 이 카테고리의 마지막 저장 SNS 분석 시각 */
  snsAt: string | null;
  onSearch: (added: SearchSnap[]) => void;
  onGeo: (engine: GeoEngine, category: string, fresh: GeoSnap[]) => void;
}) {
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<{ at: string; category: string; items: ItemResult[] } | null>(null);
  const trendsSupported = (TRENDS_CATEGORIES as readonly string[]).includes(category);

  async function run() {
    setRunning(true);
    const searchTask = async (label: string, url: string, body?: unknown): Promise<ItemResult> => {
      const r = await post(url, body);
      if (!r.ok) return { label, status: "error", note: r.message };
      const result = AutocompleteRunResult.parse(r.json);
      onSearch(result.snapshots);
      return { label, status: "ok", note: result.saved ? `${result.snapshots.length}건 저장` : `화면에만 반영 (저장 안 됨: ${result.saveError})` };
    };
    const geoTask = async (engine: GeoEngine): Promise<ItemResult> => {
      const label = `AI 검색 답변 · ${GEO_ENGINE_LABEL[engine]}`;
      const r = await post("/api/geo/run", { category, engine, precise: true });
      // 키가 없는 엔진(503)은 실패가 아니라 건너뜀 (예: Claude 키를 넣지 않기로 한 경우)
      if (!r.ok) return { label, status: r.status === 503 ? "skip" : "error", note: r.status === 503 ? "키가 없어 건너뜀" : r.message };
      const result = GeoRunResult.parse(r.json);
      onGeo(engine, category, result.snapshots);
      return { label, status: "ok", note: `답변 ${result.snapshots.length}건` };
    };
    const items = await Promise.all([
      trendsSupported
        ? searchTask("성분 검색 관심도", "/api/trends/search-interest", { category })
        : Promise.resolve<ItemResult>({ label: "성분 검색 관심도", status: "skip", note: `${category}는 수집 대상이 아니에요` }),
      searchTask("고민 검색 추천어", "/api/trends/autocomplete"),
      ...ENGINES.map(geoTask),
    ]);
    setLast({ at: new Date().toISOString(), category, items });
    setRunning(false);
  }

  // 저장된 데이터의 마지막 시각 (누가 언제 업데이트했든 같은 값이 보인다)
  const status = [
    { label: "랭킹 (CSV 업로드)", at: rankingAt },
    { label: "성분 검색 관심도", at: latestOf(search.filter((s) => s.engine === "google_trends" && s.seed === category).map((s) => s.captured_at)) },
    { label: "고민 검색 추천어", at: latestOf(search.filter((s) => s.engine === "google_autocomplete").map((s) => s.captured_at)) },
    { label: "AI 검색 답변", at: latestOf(geo.filter((g) => g.category === category).map((g) => g.captured_at)) },
    { label: "SNS 핵심 니즈", at: snsAt },
  ];
  const failed = last?.items.filter((i) => i.status === "error").length ?? 0;

  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="outline" onClick={run} disabled={running}>
        <RefreshCw className={cn("size-4", running && "animate-spin")} aria-hidden />
        {running ? "업데이트 중… (AI 검색은 몇 분 걸려요)" : "데이터 업데이트"}
      </Button>
      <HelpTip>
        <span className="block font-medium">{category} 마지막 업데이트</span>
        {status.map((s) => (
          <span key={s.label} className="flex justify-between gap-4">
            <span>{s.label}</span>
            <span className="tabular-nums">{day(s.at)}</span>
          </span>
        ))}
        {last && (
          <>
            <span className="mt-2 block font-medium">
              방금 업데이트 ({last.category} · {new Date(last.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })})
            </span>
            {last.items.map((i) => (
              <span key={i.label} className="block">
                {i.status === "ok" ? "✓" : i.status === "skip" ? "–" : "✕"} {i.label}: {i.note}
              </span>
            ))}
          </>
        )}
        <span className="mt-2 block opacity-80">누르면 고른 카테고리의 성분 검색 관심도 · 고민 검색 추천어 · AI 검색 답변을 새로 모아요 (유료 호출). 랭킹은 플랫폼 분석 탭의 CSV, SNS는 소비자 트렌드 탭의 영상 링크로 업데이트해요.</span>
      </HelpTip>
      {last && !running && (
        <span className={cn("text-xs", failed > 0 ? "text-risk-high" : "text-muted-foreground")}>
          {failed > 0 ? `${failed}개 실패 · ?에서 확인` : "업데이트 완료"}
        </span>
      )}
    </div>
  );
}
