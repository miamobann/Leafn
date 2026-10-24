"use client";

import Link from "next/link";
import { useState } from "react";
import { AiDisclaimer, AiResultMeta } from "@/components/common/ai";
import { LangBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GAP_MAX_ADOPTION } from "@/lib/market-config";
import type { GeoSnap } from "@/lib/schemas/geo";
import type { ClaimJudgment, ClaimVerdict, CopyCandidate, CopyPlacement, SnsPattern, SnsVideoNote } from "@/lib/schemas/market";
import type { Product } from "@/lib/schemas/product";
import type { SearchSnap } from "@/lib/schemas/search";
import { AUTOCOMPLETE_STATUS_LABEL } from "@/app/(internal)/(dashboard)/market/_lib/demand";
import {
  blockedEverywhere,
  DEMAND_SOURCE_LABEL,
  demandSupplyGaps,
  positioning,
  specCheck,
  TOP_N,
  VERDICT_LABEL,
  zonesFor,
  type GapRow,
} from "@/app/(internal)/(dashboard)/market/_lib/opportunity";
import type { OverviewRow } from "@/app/(internal)/(dashboard)/market/_lib/overview";
import { PositioningChart } from "@/app/(internal)/(dashboard)/market/_components/charts";
import type { PanelContent } from "./side-panel";

// 화면 문구
const TEXT = {
  gapRule: `수요 신호(자동완성·SNS·AI 검색)가 있는데 Top ${TOP_N} 상품명·설명·프로모션 문구에서 ${GAP_MAX_ADOPTION}개 이하로만 쓰인 키워드 (참고 기준)`,
  classNote: "시장 분석이라 특정 제품 구분을 전제하지 않고 一般化粧品·医薬部外品 판정을 나란히 보여줘요",
  ngWhy: "一般化粧品·医薬部外品 어느 쪽으로도 광고에 쓸 수 없는 말이에요. 경쟁사가 이 말을 안 쓰는 이유가 규제일 수 있어요.",
  mapRule: "Y값은 상품명·설명(자사는 제품명·특징)의 사용감 표기로 정해요. 표기가 없거나 양쪽 표기가 다 있으면 맵에 찍지 않아요. 후보 영역은 계산값이 아니라 근거 문장과 함께 정한 설정이에요.",
  copyRule: "재료는 사용 가능·근거 자료 필요 빈칸과 AI 검색 결정 키워드 중 자사 전성분·스펙으로 사실인 것만 써요 (자사에 없는 성분·시험·수상은 쓰지 않음).",
  verifyRule: "자사 실적 데이터가 없어 목표 수치와 필요한 표본 수는 정하지 않았어요. 기준값은 담당자가 넣어요 (저장되지 않음).",
};

const PLACEMENT_LABEL: Record<CopyPlacement, string> = { product_name: "상품명", detail_page: "상세페이지", qa: "Q&A", ad: "광고 소재" };
const TREND_TEXT = (g: GapRow) => (g.trend ? AUTOCOMPLETE_STATUS_LABEL[g.trend] : "—");

function Verdict({ verdict }: { verdict: ClaimVerdict }) {
  const tone = verdict === "usable" ? "bg-risk-low/15 text-risk-low" : verdict === "needs_evidence" ? "bg-risk-medium/15 text-risk-medium" : "bg-risk-high/15 text-risk-high";
  return <Badge className={tone}>{VERDICT_LABEL[verdict]}</Badge>;
}

// ── 3-A ─────────────────────────────────────────

function GapTable({ rows, onOpen }: { rows: GapRow[]; onOpen: (g: GapRow) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-40">
            키워드 <LangBadge lang="ja" />
          </TableHead>
          <TableHead>수요 신호</TableHead>
          <TableHead>추세</TableHead>
          <TableHead className="text-right">Top {TOP_N} 채택</TableHead>
          <TableHead>판정 一般化粧品</TableHead>
          <TableHead>판정 医薬部外品</TableHead>
          <TableHead className="min-w-48">판정 근거</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((g) => (
          <TableRow key={g.judgment.id} className="cursor-pointer" onClick={() => onOpen(g)}>
            <TableCell>
              <span lang="ja" className="font-medium">
                {g.judgment.keyword}
              </span>
              <span className="block text-xs text-muted-foreground">{g.judgment.label_ko}</span>
            </TableCell>
            <TableCell>
              <span className="flex flex-wrap gap-1">
                {g.sources.map((s) => (
                  <Badge key={s} variant="outline">
                    {DEMAND_SOURCE_LABEL[s]}
                  </Badge>
                ))}
              </span>
            </TableCell>
            <TableCell className="text-xs">{TREND_TEXT(g)}</TableCell>
            <TableCell className="text-right">
              {g.adopted.length}/{TOP_N}
            </TableCell>
            <TableCell>
              <Verdict verdict={g.judgment.general_cosmetic} />
            </TableCell>
            <TableCell>
              <Verdict verdict={g.judgment.quasi_drug} />
            </TableCell>
            <TableCell className="whitespace-normal text-xs text-muted-foreground">{g.judgment.basis}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** PART 3. 기회와 전략: 수요-공급 빈칸 · 포지셔닝 맵 · 카피 후보와 검증 계획 */
export function OpportunityPart({
  category,
  top,
  products,
  search,
  snsNotes,
  snsPatterns,
  geo,
  judgments,
  copies,
  onOpen,
}: {
  category: string;
  top: OverviewRow[];
  products: Product[];
  search: SearchSnap[];
  snsNotes: SnsVideoNote[];
  snsPatterns: SnsPattern[];
  geo: GeoSnap[];
  judgments: ClaimJudgment[];
  copies: CopyCandidate[];
  onOpen: (c: PanelContent) => void;
}) {
  // 카테고리마다 고른 후보 영역 (로컬 상태, 저장되지 않음)
  const [zoneByCategory, setZoneByCategory] = useState<Record<string, string | null>>({});
  const [baselines, setBaselines] = useState<Record<string, string>>({});

  if (top.length === 0) return <EmptyState message="이 플랫폼·카테고리의 랭킹 데이터가 없어 빈칸을 계산할 수 없어요" />;

  const gaps = demandSupplyGaps({ category, top, search, snsNotes, snsPatterns, geo, judgments });
  const usable = gaps.filter((g) => !blockedEverywhere(g.judgment));
  const blocked = gaps.filter((g) => blockedEverywhere(g.judgment));
  const map = positioning(category, top, products);
  const zones = zonesFor(category);
  const selectedZone = zoneByCategory[category] ?? null;
  const zoneCopies = copies.filter((c) => c.category === category && (!selectedZone || c.zone_id === selectedZone));
  const judgmentMeta = judgments[0];

  const openGap = (g: GapRow) =>
    onOpen({
      kind: "quotes",
      title: `${g.judgment.keyword} · ${g.judgment.label_ko}`,
      description: `一般化粧品 ${VERDICT_LABEL[g.judgment.general_cosmetic]} · 医薬部外品 ${VERDICT_LABEL[g.judgment.quasi_drug]} · ${g.judgment.basis}`,
      quotes: g.evidence.map((e) => ({ ja: e.ja, ko: e.ko, note: e.note })),
      rows: { title: `Top ${TOP_N}에서 이 키워드를 쓴 제품 (${g.adopted.length}개)`, items: g.adopted.map((row) => ({ row })) },
      footnote: `쓰는 방법: ${g.judgment.note_ko}`,
      link: { href: "/ad-check", label: "광고 검토 열기" },
    });

  const openMapPoint = (id: string) => {
    const p = map.points.find((x) => x.id === id);
    if (p?.row) onOpen({ kind: "product", row: p.row });
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-24 z-10">
        <AiDisclaimer />
      </div>

      {/* 3-A */}
      <Card>
        <CardHeader>
          <CardTitle>3-A 수요-공급 빈칸</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {TEXT.gapRule} · {TEXT.classNote} · 행을 누르면 수요 근거 원문과 채택 제품
          </p>
          {usable.length === 0 ? <p className="text-sm text-muted-foreground">사용 가능하거나 근거 자료가 필요한 빈칸이 없어요</p> : <GapTable rows={usable} onOpen={openGap} />}
          <div className="rounded-md border border-dashed p-3">
            <p className="text-sm font-semibold">수요는 있지만 광고에 쓸 수 없는 표현 ({blocked.length})</p>
            <p className="mb-2 text-xs text-muted-foreground">{TEXT.ngWhy}</p>
            {blocked.length === 0 ? <p className="text-sm text-muted-foreground">없음</p> : <GapTable rows={blocked} onOpen={openGap} />}
          </div>
          {judgmentMeta && <AiResultMeta model={judgmentMeta.model} promptVersion={judgmentMeta.prompt_version} createdAt={judgmentMeta.created_at} />}
        </CardContent>
      </Card>

      {/* 3-B */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>3-B 포지셔닝 맵</CardTitle>
          </CardHeader>
          <CardContent>
            {!map.axis ? (
              <EmptyState message="이 카테고리의 포지셔닝 축이 정해지지 않았어요" />
            ) : (
              <>
                <p className="mb-1 text-xs text-muted-foreground">
                  X: ml당 실질 단가 (낮음 ↔ 높음) · Y: {map.axis.label_ko} <span lang="ja">{map.axis.low.ja}</span> ↔ <span lang="ja">{map.axis.high.ja}</span>
                </p>
                <PositioningChart
                  competitors={map.points.filter((p) => !p.own).map((p) => ({ id: p.id, label: p.label, x: p.x, y: p.y }))}
                  own={map.points.filter((p) => p.own).map((p) => ({ id: p.id, label: p.label, x: p.x, y: p.y }))}
                  zones={zones.map((z) => ({ id: z.id, label: z.label, x: z.ppm, side: z.side, selected: z.id === selectedZone }))}
                  lowLabel={map.axis.low.ja}
                  highLabel={map.axis.high.ja}
                  onSelect={openMapPoint}
                />
                <p className="mt-1 text-xs text-muted-foreground" title={TEXT.mapRule}>
                  {TEXT.mapRule} · 경쟁 점을 누르면 제품 요약
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>후보 영역 선택</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {zones.length === 0 ? (
              <p className="text-sm text-muted-foreground">이 카테고리에는 정한 후보 영역이 없어요</p>
            ) : (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-xs text-muted-foreground">자사 목표 위치는 AI가 정하지 않고 담당자가 골라요 (저장되지 않음)</legend>
                {zones.map((z) => (
                  <label key={z.id} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm has-checked:border-foreground">
                    <input type="radio" name={`zone-${category}`} className="mt-1" checked={selectedZone === z.id} onChange={() => setZoneByCategory((s) => ({ ...s, [category]: z.id }))} />
                    <span>
                      <span className="font-medium">{z.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {z.ppm[0]}~{z.ppm[1]}円/ml · 근거: {z.basis_ko}
                      </span>
                    </span>
                  </label>
                ))}
                {selectedZone && (
                  <button type="button" className="text-xs underline underline-offset-4" onClick={() => setZoneByCategory((s) => ({ ...s, [category]: null }))}>
                    선택 해제
                  </button>
                )}
              </fieldset>
            )}
            {map.unplaced.length > 0 && (
              <button
                type="button"
                className="text-xs underline underline-offset-4"
                onClick={() => onOpen({ kind: "list", title: "사용감 표기 없음", description: TEXT.mapRule, rows: map.unplaced.map((row) => ({ row })) })}
              >
                표기 없음 {map.unplaced.length}개 →
              </button>
            )}
            {map.ownUnplaced.length > 0 && <p className="text-xs text-muted-foreground">맵에 없는 자사 제품: {map.ownUnplaced.map((p) => p.name).join(", ")} (사용감 표기 없음)</p>}
          </CardContent>
        </Card>
      </div>

      {/* 3-C */}
      <Card>
        <CardHeader>
          <CardTitle>3-C 카피 후보와 검증 계획</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {selectedZone ? `고른 후보 영역의 카피만 보여줘요` : "후보 영역을 고르면 그 영역의 카피만 보여줘요"} · {TEXT.copyRule}
          </p>
          {zoneCopies.length === 0 ? (
            <EmptyState message={copies.some((c) => c.category === category) ? "이 후보 영역의 카피 후보가 없어요" : "이 카테고리에는 자사 제품이 없어 카피 후보를 만들지 않았어요"} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {zoneCopies.map((c) => {
                const own = products.find((p) => p.id === c.own_product_id);
                const check = specCheck(c, own, judgments);
                return (
                  <div key={c.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p lang="ja" className="font-medium">
                        {c.copy_ja}
                      </p>
                      <Badge className="shrink-0 bg-status-pending/15 text-status-pending">… 약기법 검토 전</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <LangBadge lang="ja" /> {c.copy_ko}
                    </p>
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                      재료
                      {c.materials.map((m) => {
                        const j = judgments.find((x) => x.keyword === m);
                        return (
                          <Badge key={m} variant="outline">
                            <span lang="ja">{m}</span>
                            {j ? ` · 一般 ${VERDICT_LABEL[j.general_cosmetic]} / 部外品 ${VERDICT_LABEL[j.quasi_drug]}` : ""}
                          </Badge>
                        );
                      })}
                    </div>
                    <p className="text-xs">
                      자사 스펙 일치: {check.ok ? "✓ 일치" : `✕ 확인 필요 ${[...check.missing, ...check.blocked].join(", ")}`} <span className="text-muted-foreground">({own?.name ?? "자사 제품 없음"})</span>
                    </p>
                    {c.ingredient_purpose && (
                      <p className="text-xs">
                        배합 목적 표기: <span lang="ja">{c.ingredient_purpose}</span>
                      </p>
                    )}
                    <p className="text-xs">사용 위치: {c.placements.map((p) => PLACEMENT_LABEL[p]).join(" · ")}</p>
                    <div className="rounded-md bg-muted p-2 text-xs">
                      <p className="font-medium">검증 계획</p>
                      <p>지표: {c.verification.metric}</p>
                      <p>측정 방법: {c.verification.method}</p>
                      <label className="mt-1 flex items-center gap-2">
                        기준값
                        <Input
                          value={baselines[c.id] ?? ""}
                          onChange={(e) => setBaselines((b) => ({ ...b, [c.id]: e.target.value }))}
                          placeholder="담당자 입력"
                          className="h-7 max-w-40 bg-background"
                          aria-label={`${c.copy_ko} 검증 기준값`}
                        />
                      </label>
                    </div>
                    <Link href="/ad-check" target="_blank" className={buttonVariants({ variant: "outline", size: "sm" })}>
                      약기법 검토로 보내기 ↗
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{TEXT.verifyRule}</p>
          {copies[0] && <AiResultMeta model={copies[0].model} promptVersion={copies[0].prompt_version} createdAt={copies[0].created_at} />}
        </CardContent>
      </Card>
    </div>
  );
}
