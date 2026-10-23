"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportTemplate } from "@/components/templates";
import { GEO_CATEGORIES } from "@/lib/external/geo-terms";
import { GEO_ENGINE_LABEL, GeoRunResult, type GeoEngine, type GeoSnap } from "@/lib/schemas/geo";
import type { Product } from "@/lib/schemas/product";
import { OWN_BRAND } from "@/app/(internal)/(dashboard)/market/_lib/market";
import {
  cellMentionRate,
  citationShare,
  engineShare,
  geoCells,
  keywordGap,
  keywordStats,
  repeatStability,
  shareOfModel,
  targetMedia,
  type GapStatus,
  type GeoCell,
} from "@/app/(internal)/(dashboard)/market/_lib/geo";
import { HorizontalBarChart } from "@/app/(internal)/(dashboard)/market/_components/charts";
import { ToggleGroup } from "@/app/(internal)/(dashboard)/market/_components/toggle-group";

/** 화면에서 다루는 행: DB 행이면 id가 있고, 방금 실행한 결과는 id를 만들어 붙인다 */
type GeoRow = GeoSnap & { id: string };
type RunState = { status: "idle" } | { status: "running" } | { status: "done"; result: GeoRunResult } | { status: "error"; message: string };

const CATEGORY_OPTIONS = GEO_CATEGORIES.map((c) => c.category);
/** 지금 실행할 수 있는 엔진 (Gemini·Perplexity는 키 준비 후) */
const RUNNABLE: { engine: GeoEngine; ready: boolean }[] = [
  { engine: "chatgpt", ready: true },
  { engine: "claude", ready: true },
  { engine: "gemini", ready: false },
  { engine: "perplexity", ready: false },
];

type Mark = { text: string; kind: "own" | "competitor" | "keyword" };

const MARK_CLASS: Record<Mark["kind"], string> = {
  own: "rounded bg-primary px-0.5 text-primary-foreground",
  competitor: "rounded bg-muted px-0.5 font-medium text-foreground",
  keyword: "underline decoration-2 underline-offset-4",
};

/** 답변 원문에서 브랜드(배경)와 결정 키워드(밑줄)를 표시한다. 긴 표기부터 찾는다 */
function Highlighted({ text, marks }: { text: string; marks: Mark[] }) {
  if (marks.length === 0) return <>{text}</>;
  const sorted = marks.toSorted((a, b) => b.text.length - a.text.length);
  const pattern = new RegExp(`(${sorted.map((m) => m.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return (
    <>
      {text.split(pattern).map((part, i) => {
        const m = sorted.find((x) => x.text === part);
        return m ? (
          <mark key={i} className={MARK_CLASS[m.kind]}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

// 색만으로 구분하지 않고 기호·글자를 같이 쓴다
function cellLabel(cell: GeoCell<GeoRow>): { label: string; variant: "default" | "secondary" | "outline" } {
  const own = cellMentionRate(cell, OWN_BRAND);
  const runs = cell.runs.length;
  if (own > 0) return { label: `● 자사${runs > 1 ? ` ${Math.round(own * runs)}/${runs}` : " 언급"}`, variant: "default" };
  if (cell.runs.some((r) => r.brands_mentioned.length > 0)) return { label: "○ 경쟁만", variant: "secondary" };
  return { label: "– 언급 없음", variant: "outline" };
}

const GAP_LABEL: Record<GapStatus, { badge: string; variant: "default" | "secondary" | "outline"; action: (k: string) => string }> = {
  missing: { badge: "누락", variant: "default", action: (k) => `근거가 있다면 상세페이지·보도자료에 「${k}」를 명시` },
  ingredient: { badge: "미배합 성분", variant: "outline", action: (k) => `자사 제품에 「${k}」가 없음 → 문구로 넣지 말고, 대체 성분·사용감 비교로 대응` },
  weak: { badge: "노출 부족", variant: "secondary", action: (k) => `제품엔 있으나 AI가 자사와 연결하지 못함 → 일본어 상세페이지·FAQ에 「${k}」 문구 추가` },
  linked: { badge: "연결됨", variant: "outline", action: () => "유지 (AI가 이미 자사와 함께 언급)" },
};

export function GeoReport({ initial, ownProducts }: { initial: GeoRow[]; ownProducts: Product[] }) {
  const [all, setAll] = useState(initial);
  const [category, setCategory] = useState<string>(CATEGORY_OPTIONS[0]);
  const [precise, setPrecise] = useState(false);
  const [runs, setRuns] = useState<Partial<Record<GeoEngine, RunState>>>({});
  const snapshots = all.filter((g) => g.category === category);
  const cells = geoCells(snapshots);
  const queries = [...new Set(snapshots.map((g) => g.query))];
  const engines = [...new Set(snapshots.map((g) => g.engine))];
  const maxRuns = Math.max(0, ...cells.map((c) => c.runs.length));
  const [selectedId, setSelectedId] = useState("");
  const selected = snapshots.find((g) => g.id === selectedId) ?? snapshots[0] ?? null;
  const selectedCell = selected ? cells.find((c) => c.engine === selected.engine && c.query === selected.query) : undefined;

  const som = shareOfModel(snapshots);
  const own = som.find((s) => s.brand === OWN_BRAND);
  const domains = citationShare(snapshots);
  const keywords = keywordStats(snapshots, OWN_BRAND).filter((k) => k.competitor > 0).slice(0, 8);
  const gap = keywordGap(snapshots, ownProducts, OWN_BRAND);
  const media = targetMedia(snapshots, OWN_BRAND);
  const stability = repeatStability(snapshots, OWN_BRAND);

  async function run(engine: GeoEngine) {
    setRuns((r) => ({ ...r, [engine]: { status: "running" } }));
    try {
      const res = await fetch("/api/geo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, engine, precise }),
      });
      const body: unknown = await res.json();
      if (!res.ok) {
        const message = typeof body === "object" && body && "error" in body && typeof body.error === "string" ? body.error : `오류 (${res.status})`;
        setRuns((r) => ({ ...r, [engine]: { status: "error", message } }));
        return;
      }
      const result = GeoRunResult.parse(body);
      // 같은 엔진·카테고리의 이전 결과는 화면에서 새 결과로 바꾼다 (DB에는 측정 시각별로 쌓인다)
      const fresh = result.snapshots.map((s) => ({ ...s, id: `run-${s.engine}-${s.captured_at}-${s.query}-${s.run_index}` }));
      setAll((prev) => [...prev.filter((g) => !(g.engine === engine && g.category === category)), ...fresh]);
      setRuns((r) => ({ ...r, [engine]: { status: "done", result } }));
    } catch (e) {
      setRuns((r) => ({ ...r, [engine]: { status: "error", message: e instanceof Error ? e.message : "요청 실패" } }));
    }
  }

  return (
    <ReportTemplate
      state={snapshots.length === 0 ? "empty" : undefined}
      filters={
        <div className="flex flex-wrap items-start gap-4">
          <ToggleGroup label="카테고리" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
          <div className="space-y-1 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {RUNNABLE.map(({ engine, ready }) => (
                <Button key={engine} size="sm" variant="outline" disabled={!ready || runs[engine]?.status === "running"} onClick={() => run(engine)}>
                  {!ready ? `${GEO_ENGINE_LABEL[engine]} (키 준비 후)` : runs[engine]?.status === "running" ? `${GEO_ENGINE_LABEL[engine]} 질의 중…` : `${GEO_ENGINE_LABEL[engine]}에 질의`}
                </Button>
              ))}
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={precise} onChange={(e) => setPrecise(e.target.checked)} />
                정밀 모드 (질의마다 3회)
              </label>
            </div>
            {RUNNABLE.map(({ engine }) => {
              const st = runs[engine];
              if (!st || st.status === "idle" || st.status === "running") return null;
              return (
                <p key={engine} className={st.status === "error" ? "text-risk-high" : "text-muted-foreground"}>
                  {GEO_ENGINE_LABEL[engine]}:{" "}
                  {st.status === "error"
                    ? st.message
                    : `답변 ${st.result.snapshots.length}건 (${st.result.repeatCount}회 반복) · ${st.result.saved ? "저장됨" : `저장 안 됨: ${st.result.saveError}`}${st.result.failures.length ? ` · 실패 ${st.result.failures.length}건` : ""}`}
                </p>
              );
            })}
          </div>
        </div>
      }
      cards={[
        {
          title: `${OWN_BRAND} Share of Model`,
          content: (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-3xl font-semibold">{own?.share ?? 0}%</span>
                <span className="ml-2 text-muted-foreground">언급됐을 때 평균 {own?.avgRank ?? "—"}번째</span>
              </p>
              <ul className="space-y-1">
                {engineShare(snapshots, OWN_BRAND).map((e) => (
                  <li key={e.engine} className="flex justify-between">
                    <span>{GEO_ENGINE_LABEL[e.engine]}</span>
                    <span className="text-muted-foreground">
                      질의 {e.cells}개 평균 <span className="font-medium text-foreground">{e.share}%</span>
                    </span>
                  </li>
                ))}
              </ul>
              {stability.cells > 0 && (
                <p className="text-xs">
                  반복 안정성: 여러 번 돌린 칸 {stability.cells}개 중 자사 언급이 매번 같았던 칸 {stability.sameOwn}개 · 상위 3개 브랜드가 매번 같았던 칸 {stability.sameTop3}개
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Share of Model = 엔진×질의 칸마다 자사가 나온 비율의 평균 · 질의 {queries.length}개 × 엔진 {engines.length}개 · 칸당 최대 {maxRuns}회 반복 · 측정{" "}
                {snapshots[0]?.captured_at.slice(0, 10) ?? "—"} (샘플)
              </p>
            </div>
          ),
        },
        {
          title: "브랜드별 Share of Model",
          content: (
            <>
              <HorizontalBarChart
                items={som.map((s) => ({
                  id: s.brand,
                  label: `${s.brand === OWN_BRAND ? "★ " : ""}${s.brand}${s.viaLlm ? " ＋" : ""} · ${s.minRank !== null && s.minRank !== s.maxRank ? `${s.minRank}~${s.maxRank}위` : `${s.avgRank ?? "—"}위`}`,
                  value: s.share,
                  highlight: s.brand === OWN_BRAND,
                }))}
                unit="%"
                labelWidth={170}
              />
              <p className="mt-2 text-xs text-muted-foreground">★ 진한 막대 = 자사 · ＋ = 사전에 없어 LLM이 찾은 브랜드 (원문 대조 통과) · 「1~3위」 = 답변마다 순위가 흔들린 범위</p>
            </>
          ),
        },
        {
          title: "AI가 인용한 출처 도메인",
          content: (
            <>
              <HorizontalBarChart items={domains.map((d) => ({ id: d.domain, label: d.label, value: d.answers }))} unit="건" labelWidth={200} />
              <p className="mt-2 text-xs text-muted-foreground">그 도메인을 출처로 단 답변 수 · 출처는 엔진 API의 인용 칸에서만 가져와요</p>
            </>
          ),
        },
        {
          title: "결정 키워드 · 경쟁사 추천 문장",
          content: (
            <>
              <HorizontalBarChart
                items={keywords.map((k) => ({ id: k.keyword, label: `${k.keyword}${k.viaLlm ? " ＋" : ""}`, value: k.competitor }))}
                unit="문장"
                labelWidth={200}
              />
              <p className="mt-2 text-xs text-muted-foreground">경쟁 브랜드와 같은 문장에 나온 횟수 · ＋ = 사전에 없어 LLM이 찾은 말 (원문 대조 통과)</p>
            </>
          ),
        },
        {
          title: `${OWN_BRAND} Gap 액션 플랜`,
          wide: true,
          content: (
            <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
              <div>
                <p className="mb-2 text-sm font-medium">보강할 키워드 (경쟁사 추천 사유 Top {gap.length})</p>
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
                <p className="mt-2 text-xs text-muted-foreground">
                  자사 제품 정보 = 등록된 자사 제품의 이름·특징·全成分 · 「〜テスト済み」 같은 표기는 실제 시험 근거가 있을 때만 쓰고, 광고 검토(약기법)를 거쳐 주세요
                </p>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">타겟 매체 (경쟁사만 나온 답변이 인용한 곳)</p>
                {media.length === 0 ? (
                  <p className="text-sm text-muted-foreground">없어요</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {media.map((m) => (
                      <li key={m.domain} className="rounded-md border p-2">
                        <p className="flex items-center justify-between gap-2">
                          <span className="font-medium">{m.label}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">경쟁만 {m.gapAnswers}건 · 자사 {m.ownAnswers}건</span>
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
        {
          title: "질의별 노출",
          wide: true,
          content: (
            <>
              <p className="mb-2 text-xs text-muted-foreground">칸을 누르면 아래에 답변 원문이 열려요 · 여러 번 돌린 칸은 자사가 나온 횟수/반복 수</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>질의 (일본어)</TableHead>
                    {engines.map((e) => (
                      <TableHead key={e} className="text-center">
                        {GEO_ENGINE_LABEL[e]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queries.map((q) => (
                    <TableRow key={q}>
                      <TableCell lang="ja">{q}</TableCell>
                      {engines.map((e) => {
                        const cell = cells.find((c) => c.query === q && c.engine === e);
                        if (!cell) return <TableCell key={e} className="text-center text-muted-foreground">미측정</TableCell>;
                        const { label, variant } = cellLabel(cell);
                        const active = cell === selectedCell;
                        return (
                          <TableCell key={e} className="text-center">
                            <Button size="sm" variant={variant} aria-pressed={active} className={active ? "ring-2 ring-ring" : undefined} onClick={() => setSelectedId(cell.runs[0].id)}>
                              {label}
                            </Button>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ),
        },
        {
          title: "답변 원문",
          wide: true,
          content: selected ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">{GEO_ENGINE_LABEL[selected.engine]}</Badge>
                <span lang="ja" className="font-medium">
                  {selected.query}
                </span>
                <span className="text-xs text-muted-foreground">
                  {selected.model} · 측정 {selected.captured_at.slice(0, 16).replace("T", " ")} JST
                </span>
                {selectedCell && selectedCell.runs.length > 1 && (
                  <span role="group" aria-label="반복 회차" className="flex gap-1">
                    {selectedCell.runs.map((r) => (
                      <Button key={r.id} size="xs" variant={r.id === selected.id ? "default" : "outline"} aria-pressed={r.id === selected.id} onClick={() => setSelectedId(r.id)}>
                        {r.run_index}회
                      </Button>
                    ))}
                  </span>
                )}
              </div>
              <p lang="ja" className="rounded-md border p-4 leading-relaxed">
                <Highlighted
                  text={selected.answer}
                  marks={[
                    ...selected.brand_mentions.map((m) => ({ text: m.matched_text, kind: m.brand === OWN_BRAND ? ("own" as const) : ("competitor" as const) })),
                    ...selected.keywords.map((k) => ({ text: k.matched_text, kind: "keyword" as const })),
                  ]}
                />
              </p>
              <div className="grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="mb-1 font-medium">언급 순서</p>
                  {selected.brand_mentions.length === 0 ? (
                    <p className="text-muted-foreground">없음</p>
                  ) : (
                    <ol className="space-y-1">
                      {selected.brand_mentions.map((m) => (
                        <li key={m.brand}>
                          {m.rank}. {m.brand} {m.source === "llm" && <Badge variant="outline">LLM</Badge>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div>
                  <p className="mb-1 font-medium">결정 키워드</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.keywords.length === 0 && <span className="text-muted-foreground">없음</span>}
                    {selected.keywords.map((k) => (
                      <Badge key={k.keyword} variant={k.source === "llm" ? "outline" : "secondary"}>
                        <span lang="ja">{k.keyword}</span>
                        {k.source === "llm" && " · LLM"}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 font-medium">인용 출처</p>
                  {selected.citations.length === 0 ? (
                    <p className="text-muted-foreground">없음</p>
                  ) : (
                    <ul className="space-y-1">
                      {selected.citations.map((c) => (
                        <li key={c.url}>
                          <a href={c.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                            {c.title ?? c.domain}
                          </a>{" "}
                          <span className="text-xs text-muted-foreground">{c.domain}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                배경 = 브랜드 (진한 색 = 자사) · 밑줄 = 결정 키워드 · {selected.id.startsWith("run-") ? "방금 API로 받은 실제 답변이에요" : "샘플 답변이며 실제 AI 엔진 응답이 아니에요 (인용 URL도 가짜 주소)"}. GEO 해석은 팀 확인이 필요해요 (CLAUDE.md 11장)
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">위 표에서 칸을 골라 주세요</p>
          ),
        },
      ]}
    />
  );
}
