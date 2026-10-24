"use client";

import { useState } from "react";
import { ViewStateGate } from "@/components/common/view-state";
import { MARKET_PLATFORMS, type MarketCategory, type MarketPlatform } from "@/lib/market-config";
import type { GeoSnap } from "@/lib/schemas/geo";
import type { ClaimJudgment, SnsPattern, SnsVideoNote } from "@/lib/schemas/market";
import type { Product } from "@/lib/schemas/product";
import type { PromoEvent } from "@/lib/schemas/promo";
import type { SearchSnap } from "@/lib/schemas/search";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { weekLabel } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { ownBaseline, rowsAt, seriesOf, top10 } from "@/app/(internal)/(dashboard)/market/_lib/overview";
import { ConditionBar } from "./condition-bar";
import { MarketPart } from "./part0-market";
import { SupplyPart } from "./part1-supply";
import { DemandPart } from "./part2-demand";
import { OpportunityPart } from "./part3-opportunity";
import { SummaryPart } from "./summary";
import { AppealReport } from "@/app/(internal)/(dashboard)/market/_components/appeal-report";
import { SectionHeader } from "./section-header";
import { MAX_COMPARE, OverviewPanel, type PanelContent } from "./side-panel";

// 섹션 순서 = 팀장이 읽는 순서 (요약 → 시장 개관 → 공급 → 수요 → 기회와 전략)
const SECTIONS = [
  { id: "summary", label: "요약", title: "이번 주 핵심", question: "공급·수요·기회를 한 줄씩", featureIds: [] },
  { id: "market", label: "시장 개관", title: "PART 0. 시장 개관", question: "순위권 제품은 얼마에, ml당 얼마에 팔리나?", featureIds: ["B"] },
  { id: "supply", label: "공급", title: "PART 1. 공급", question: "상위권에 들려면 무엇이 필요한가?", featureIds: ["B", "C"] },
  { id: "demand", label: "수요", title: "PART 2. 수요", question: "소비자와 AI 검색은 지금 무엇을 기준으로 고르나?", featureIds: ["B", "GEO"] },
  { id: "opportunity", label: "기회와 전략", title: "PART 3. 기회와 전략", question: "자사는 어디에 서서 무엇을 말할까?", featureIds: ["A", "C"] },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/** 상세 이미지 분석(楽天·Qoo10 비교)을 하는 카테고리 */
const APPEAL_CATEGORY = "化粧水";

export function MarketOverview({
  snapshots,
  products,
  promoEvents,
  search,
  snsNotes,
  snsPatterns,
  geo,
  judgments,
}: {
  snapshots: TrendSnapshot[];
  products: Product[];
  promoEvents: PromoEvent[];
  search: SearchSnap[];
  snsNotes: SnsVideoNote[];
  snsPatterns: SnsPattern[];
  geo: GeoSnap[];
  judgments: ClaimJudgment[];
}) {
  const [category, setCategory] = useState<MarketCategory>("化粧水");
  // 실데이터는 Qoo10으로 수집한다 (2026-10-24 결정). 楽天은 비교용 샘플
  const [platform, setPlatform] = useState<MarketPlatform>("qoo10_ranking");
  const [panel, setPanel] = useState<PanelContent | null>(null);
  // 표 체크박스와 패널의 [비교에 추가]가 같은 목록을 쓴다 (저장되지 않음)
  const [selected, setSelected] = useState<string[]>([]);

  const platformInfo = MARKET_PLATFORMS.find((p) => p.source === platform) ?? MARKET_PLATFORMS[0];
  const series = seriesOf(snapshots, platform, category);
  const sameSource = snapshots.filter((s) => s.source === platform);
  const latest = series.at(-1);
  const week = latest ? `${weekLabel(latest.captured_at)} 주` : null;
  const basis = week ? `${week} · ${platformInfo.label}` : `${platformInfo.label} · 이 카테고리 데이터 없음`;

  const toggleCompare = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_COMPARE ? cur : [...cur, id]));

  const body: Record<SectionId, React.ReactNode> = {
    market: <MarketPart series={series} platformLabel={platformInfo.label} products={products} onOpen={setPanel} />,
    summary: (
      <SummaryPart
        series={series}
        sameSource={sameSource}
        category={category}
        search={search}
        snsNotes={snsNotes}
        snsPatterns={snsPatterns}
        geo={geo}
        judgments={judgments}
      />
    ),
    supply: (
      <div className="space-y-6">
        <SupplyPart
          series={series}
          sameSource={sameSource}
          platformLabel={platformInfo.label}
          platformName={platformInfo.eventPlatform}
          promoEvents={promoEvents}
          products={products}
          selected={selected}
          onToggleCompare={toggleCompare}
          onOpen={setPanel}
        />
        {/* 예전 성분 관심도 화면에서 옮김: 상위 상품 상세 이미지의 소구 성분 (楽天 vs Qoo10, 化粧水만) */}
        <div>
          <h3 className="mb-2 text-sm font-semibold">1-C 상세 이미지 소구 성분 · 楽天 vs Qoo10</h3>
          {category === APPEAL_CATEGORY ? (
            <AppealReport
              initial={{ rakuten_ranking: seriesOf(snapshots, "rakuten_ranking", APPEAL_CATEGORY).at(-1), qoo10_ranking: seriesOf(snapshots, "qoo10_ranking", APPEAL_CATEGORY).at(-1) }}
              products={products}
            />
          ) : (
            <p className="text-sm text-muted-foreground">상세 이미지 분석은 {APPEAL_CATEGORY}만 하고 있어요</p>
          )}
        </div>
      </div>
    ),
    demand: <DemandPart search={search} snsNotes={snsNotes} snsPatterns={snsPatterns} geo={geo} products={products} category={category} onOpen={setPanel} />,
    opportunity: (
      <OpportunityPart
        category={category}
        top={top10(rowsAt(series, series.length - 1))}
        search={search}
        snsNotes={snsNotes}
        snsPatterns={snsPatterns}
        geo={geo}
        judgments={judgments}
        onOpen={setPanel}
      />
    ),
  };

  return (
    <>
      <ConditionBar category={category} onCategory={setCategory} platform={platform} onPlatform={setPlatform} week={week} sections={SECTIONS} />
      <ViewStateGate>
        <div className="space-y-10">
          {SECTIONS.map((s) => (
            // 바로가기로 이동했을 때 머리말이 고정 바에 가려지지 않게 scroll-margin을 준다
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-40">
              <SectionHeader titleId={`${s.id}-title`} title={s.title} question={s.question} basis={basis} featureIds={[...s.featureIds]} />
              {body[s.id]}
            </section>
          ))}
        </div>
      </ViewStateGate>
      <OverviewPanel
        content={panel}
        onClose={() => setPanel(null)}
        onOpenRow={(row) => setPanel({ kind: "product", row })}
        own={ownBaseline(products, category)}
        selected={selected}
        onToggleCompare={toggleCompare}
      />
    </>
  );
}
