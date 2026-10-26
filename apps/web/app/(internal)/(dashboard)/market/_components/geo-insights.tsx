"use client";

import { useState } from "react";
import { HelpTip } from "@/components/common/help-tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportTemplate } from "@/components/templates";
import { DOMAIN_KIND_LABEL, GEO_CATEGORIES } from "@/lib/external/geo-terms";
import { GEO_ENGINE_LABEL, GeoRunResult, type GeoEngine, type GeoSnap } from "@/lib/schemas/geo";
import type { Product } from "@/lib/schemas/product";
import { OWN_BRAND } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { citationShare, keywordGap, keywordStats, targetMedia, type GapStatus } from "@/app/(internal)/(dashboard)/market/_lib/geo";
import { HorizontalBarChart } from "@/app/(internal)/(dashboard)/market/_components/charts";
import { ToggleGroup } from "@/app/(internal)/(dashboard)/market/_components/toggle-group";

// AI 검색 답변은 매번 달라서, 답변 하나하나가 아니라 여러 답변을 모은 핵심 포인트(추천 사유·인용 출처·자사 Gap)만 보여 준다.
// 질의는 항상 정밀 모드(질의마다 3회)로 돌려 평균을 쓴다

type GeoRow = GeoSnap & { id: string };
type Card = { title: string; content: React.ReactNode; wide?: boolean; help?: React.ReactNode };

/** Gap 액션 플랜(마지막 카드)을 맨 앞으로 */
function orderCards(cards: Card[], gapFirst: boolean): Card[] {
  return gapFirst ? [cards[cards.length - 1], ...cards.slice(0, -1)] : cards;
}

const CATEGORY_OPTIONS = GEO_CATEGORIES.map((c) => c.category);
/** 버튼 한 번에 차례로 묻는 엔진. 키가 없는 엔진은 건너뛴다 */
const ENGINES: GeoEngine[] = ["chatgpt", "claude"];

const GAP_LABEL: Record<GapStatus, { badge: string; variant: "default" | "secondary" | "outline"; action: (k: string) => string }> = {
  missing: { badge: "누락", variant: "default", action: (k) => `근거가 있다면 상세페이지·보도자료에 「${k}」를 명시` },
  ingredient: { badge: "미배합 성분", variant: "outline", action: (k) => `자사 제품에 「${k}」가 없음 → 문구로 넣지 말고, 대체 성분·사용감 비교로 대응` },
  weak: { badge: "노출 부족", variant: "secondary", action: (k) => `제품엔 있으나 AI가 자사와 연결하지 못함 → 일본어 상세페이지·FAQ에 「${k}」 문구 추가` },
  linked: { badge: "연결됨", variant: "outline", action: () => "유지 (AI가 이미 자사와 함께 언급)" },
};

type EngineResult = { engine: GeoEngine; ok: true; result: GeoRunResult } | { engine: GeoEngine; ok: false; message: string };

/** category를 넘기면 원페이지 조건 바의 카테고리를 따르고 카테고리 버튼을 숨긴다 */
export function GeoInsights({
  initial,
  ownProducts,
  category: fixedCategory,
  gapFirst = false,
}: {
  initial: GeoRow[];
  ownProducts: Product[];
  category?: string;
  /** Gap 액션 플랜을 맨 앞에 (원페이지 「우리 제품 대응」) */
  gapFirst?: boolean;
}) {
  const [all, setAll] = useState(initial);
  const [pickedCategory, setCategory] = useState<string>(CATEGORY_OPTIONS[0]);
  const category = fixedCategory ?? pickedCategory;
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<EngineResult[]>([]);

  const snapshots = all.filter((g) => g.category === category);
  const keywords = keywordStats(snapshots, OWN_BRAND).filter((k) => k.competitor > 0).slice(0, 8);
  const domains = citationShare(snapshots);
  const gap = keywordGap(snapshots, ownProducts, OWN_BRAND);
  const media = targetMedia(snapshots, OWN_BRAND);
  const measuredAt = snapshots.map((s) => s.captured_at).toSorted().at(-1);
  const isLive = snapshots.some((s) => s.id.startsWith("run-"));

  async function runAll() {
    setRunning(true);
    const out: EngineResult[] = [];
    for (const engine of ENGINES) {
      try {
        const res = await fetch("/api/geo/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, engine, precise: true }),
        });
        const body: unknown = await res.json();
        if (!res.ok) {
          const message = typeof body === "object" && body && "error" in body && typeof body.error === "string" ? body.error : `오류 (${res.status})`;
          out.push({ engine, ok: false, message });
          continue;
        }
        const result = GeoRunResult.parse(body);
        // 같은 엔진·카테고리의 이전 결과는 화면에서 새 결과로 바꾼다 (DB에는 측정 시각별로 쌓인다)
        const fresh = result.snapshots.map((s) => ({ ...s, id: `run-${s.engine}-${s.captured_at}-${s.query}-${s.run_index}` }));
        setAll((prev) => [...prev.filter((g) => !(g.engine === engine && g.category === category)), ...fresh]);
        out.push({ engine, ok: true, result });
      } catch (e) {
        out.push({ engine, ok: false, message: e instanceof Error ? e.message : "요청 실패" });
      }
    }
    setResults(out);
    setRunning(false);
  }

  return (
    <ReportTemplate
      // 원페이지에서는 측정 전이어도 측정 버튼이 보여야 해서 빈 상태로 바꾸지 않는다
      state={snapshots.length === 0 && !fixedCategory ? "empty" : undefined}
      filters={
        <div className="flex flex-wrap items-start gap-4">
          {!fixedCategory && <ToggleGroup label="카테고리" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />}
          <div className="space-y-1 text-xs">
            <Button size="sm" variant="outline" disabled={running} onClick={runAll}>
              {running ? "AI에 질의 중… (1~3분)" : "AI에 질의 (질의마다 3회 평균)"}
            </Button>
            <p className="text-muted-foreground">
              {snapshots.length > 0 ? `답변 ${snapshots.length}건 기준 · 측정 ${measuredAt?.slice(0, 10)}${isLive ? "" : " (샘플)"}` : "이 카테고리는 아직 측정하지 않았어요"}
            </p>
            {results.map((r) => (
              <p key={r.engine} className={r.ok ? "text-muted-foreground" : "text-risk-high"}>
                {GEO_ENGINE_LABEL[r.engine]}:{" "}
                {r.ok
                  ? `답변 ${r.result.snapshots.length}건 · ${r.result.saved ? "저장됨" : `저장 안 됨: ${r.result.saveError}`}${r.result.failures.length ? ` · 실패 ${r.result.failures.length}건` : ""}`
                  : r.message}
              </p>
            ))}
          </div>
        </div>
      }
      cards={orderCards([
        {
          title: "AI가 경쟁 제품을 추천한 이유",
          help: "AI 답변에서 경쟁 브랜드를 추천하며 든 말이에요 (같은 문장 안). ＋ = 미리 정한 목록에 없던 말 (답변 원문에 그대로 있는 것만).",
          content: (
            <>
              <HorizontalBarChart
                items={keywords.map((k) => ({ id: k.keyword, label: `${k.keyword}${k.viaLlm ? " ＋" : ""}`, value: k.competitor }))}
                unit="문장"
                labelWidth={200}
              />
            </>
          ),
        },
        {
          title: "AI가 인용한 출처 도메인",
          help: `그 도메인의 일본어 페이지를 출처로 단 답변 수예요. 출처는 엔진 API의 인용 칸에서만 가져와요.${domains.foreign > 0 ? ` 일본 소비자가 보지 않는 해외(일본어 아닌) 사이트 ${domains.foreign}곳은 뺐어요.` : ""}`,
          content: (
            <>
              {domains.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">일본어 페이지 인용이 없어요</p>
              ) : (
                <HorizontalBarChart items={domains.rows.map((d) => ({ id: d.domain, label: d.label, value: d.answers }))} unit="건" labelWidth={200} />
              )}
            </>
          ),
        },
        {
          title: `${OWN_BRAND} Gap 액션 플랜`,
          wide: true,
          content: (
            <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  보강할 키워드 (경쟁사 추천 사유 Top {gap.length})
                  <HelpTip>자사 제품 정보 = 등록된 자사 제품의 이름·특징·全成分. 「〜テスト済み」 같은 표기는 실제 시험 근거가 있을 때만 써요.</HelpTip>
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>키워드</TableHead>
                      <TableHead className="text-right">경쟁 추천</TableHead>
                      <TableHead>자사 제품 정보</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>할 일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gap.map((k) => (
                      <TableRow key={k.keyword}>
                        <TableCell>
                          <span lang="ja">{k.keyword}</span>
                          {k.ko && k.ko !== k.keyword && <span className="block text-xs text-muted-foreground">{k.ko}</span>}
                        </TableCell>
                        <TableCell className="text-right">{k.competitor}문장</TableCell>
                        <TableCell>{k.inProduct ? "있음" : <span className="text-muted-foreground">없음</span>}</TableCell>
                        <TableCell>
                          <Badge variant={GAP_LABEL[k.status].variant}>{GAP_LABEL[k.status].badge}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-normal text-xs">{GAP_LABEL[k.status].action(k.keyword)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* 문구를 바로 쓰기 전에 꼭 봐야 하는 안내라 ? 에 숨기지 않는다 */}
                <p className="mt-2 text-xs text-muted-foreground">문구는 광고 검토(약기법)를 거쳐 주세요</p>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  타겟 매체 (경쟁사만 나온 답변이 인용한 곳)
                  <HelpTip>
                    일본어 페이지만 셌어요.
                    {media.foreign > 0 && ` 해외(일본어 아닌) 사이트 ${media.foreign}곳 제외.`}
                    {media.fashion.length > 0 && ` 화장품 구매와 거리가 먼 패션·라이프 매체 제외: ${media.fashion.join(", ")}.`}
                  </HelpTip>
                </p>
                {media.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">없어요</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {media.items.map((m) => (
                      <li key={m.domain} className="rounded-md border p-2">
                        <p className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {m.label}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">{DOMAIN_KIND_LABEL[m.kind]}</span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            경쟁만 {m.gapAnswers}건 · 자사 {m.ownAnswers}건
                          </span>
                        </p>
                        <p className="mt-1 text-xs">→ {m.action}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ),
        },
      ], gapFirst)}
    />
  );
}
