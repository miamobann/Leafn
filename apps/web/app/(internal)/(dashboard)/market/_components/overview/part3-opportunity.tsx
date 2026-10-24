"use client";

import { AiDisclaimer, AiResultMeta } from "@/components/common/ai";
import { LangBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GAP_MAX_ADOPTION } from "@/lib/market-config";
import type { GeoSnap } from "@/lib/schemas/geo";
import type { ClaimJudgment, ClaimVerdict, SnsPattern, SnsVideoNote } from "@/lib/schemas/market";
import type { SearchSnap } from "@/lib/schemas/search";
import { AUTOCOMPLETE_STATUS_LABEL } from "@/app/(internal)/(dashboard)/market/_lib/demand";
import {
  blockedEverywhere,
  DEMAND_SOURCE_LABEL,
  demandSupplyGaps,
  TOP_N,
  VERDICT_LABEL,
  type GapRow,
} from "@/app/(internal)/(dashboard)/market/_lib/opportunity";
import type { OverviewRow } from "@/app/(internal)/(dashboard)/market/_lib/overview";
import type { PanelContent } from "./side-panel";

// 화면 문구
const TEXT = {
  gapRule: `수요 신호(자동완성·SNS·AI 검색)가 있는데 Top ${TOP_N} 상품명·설명·프로모션 문구에서 ${GAP_MAX_ADOPTION}개 이하로만 쓰인 키워드 (참고 기준)`,
  classNote: "시장 분석이라 특정 제품 구분을 전제하지 않고 一般化粧品·医薬部外品 판정을 나란히 보여줘요",
  ngWhy: "一般化粧品·医薬部外品 어느 쪽으로도 광고에 쓸 수 없는 말이에요. 경쟁사가 이 말을 안 쓰는 이유가 규제일 수 있어요.",
};

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

/** PART 3. 기회와 전략: 수요-공급 빈칸 (포지셔닝 맵·카피 후보는 2026-10-24 요청으로 뺐다) */
export function OpportunityPart({
  category,
  top,
  search,
  snsNotes,
  snsPatterns,
  geo,
  judgments,
  onOpen,
}: {
  category: string;
  top: OverviewRow[];
  search: SearchSnap[];
  snsNotes: SnsVideoNote[];
  snsPatterns: SnsPattern[];
  geo: GeoSnap[];
  judgments: ClaimJudgment[];
  onOpen: (c: PanelContent) => void;
}) {
  if (top.length === 0) return <EmptyState message="이 플랫폼·카테고리의 랭킹 데이터가 없어 빈칸을 계산할 수 없어요" />;

  const gaps = demandSupplyGaps({ category, top, search, snsNotes, snsPatterns, geo, judgments });
  const usable = gaps.filter((g) => !blockedEverywhere(g.judgment));
  const blocked = gaps.filter((g) => blockedEverywhere(g.judgment));
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

    </div>
  );
}
