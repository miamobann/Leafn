"use client";

import { useState } from "react";
import { ViewStateGate } from "@/components/common/view-state";
import { IMPORTED_SNAPSHOT_PREFIX, MARKET_PLATFORMS, type MarketCategory, type MarketPlatform } from "@/lib/market-config";
import type { GeoSnap } from "@/lib/schemas/geo";
import type { SnsPattern, SnsVideoNote } from "@/lib/schemas/market";
import type { Product } from "@/lib/schemas/product";
import type { PromoEvent } from "@/lib/schemas/promo";
import type { SearchSnap } from "@/lib/schemas/search";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { weekLabel } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { ownBaseline, seriesOf } from "@/app/(internal)/(dashboard)/market/_lib/overview";
import { ConditionBar } from "./condition-bar";
import { MarketPart } from "./part0-market";
import { SupplyPart } from "./part1-supply";
import { DemandPart } from "./part2-demand";
import { SummaryPart } from "./summary";
import { GeoInsights } from "@/app/(internal)/(dashboard)/market/_components/geo-insights";
import { SectionHeader } from "./section-header";
import { MAX_COMPARE, OverviewPanel, type PanelContent } from "./side-panel";

// 섹션 순서 = 팀장이 읽는 순서 (요약 → 우리 제품 대응 → 시장 개관 → 플랫폼 분석 → 소비자 트렌드). 기회와 전략은 2026-10-24에 뺐다
const SECTIONS = [
  { id: "summary", label: "요약", title: "이번 주 핵심", question: "가격·할인 전략에 바로 쓸 결론 4가지" },
  { id: "action", label: "우리 제품 대응", title: "우리 제품 대응", question: "AI 검색이 경쟁 제품을 추천할 때 드는 이유 중 우리가 채울 것은?" },
  { id: "market", label: "시장 개관", title: "PART 0. 시장 개관", question: "순위권 제품은 얼마에, ml당 얼마에 팔리나?" },
  { id: "supply", label: "플랫폼 분석", title: "PART 1. 플랫폼 분석", question: "이 플랫폼 상위권에 들려면 무엇이 필요한가?" },
  { id: "demand", label: "소비자 트렌드", title: "PART 2. 소비자 트렌드", question: "소비자는 지금 무엇을 기준으로 고르나?" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function MarketOverview({
  snapshots,
  products,
  promoEvents,
  search,
  snsNotes,
  snsPatterns,
  geo,
  snsImported,
}: {
  snapshots: TrendSnapshot[];
  products: Product[];
  promoEvents: PromoEvent[];
  search: SearchSnap[];
  snsNotes: SnsVideoNote[];
  snsPatterns: SnsPattern[];
  geo: GeoSnap[];
  snsImported: { category: string; url: string; memo: string }[];
}) {
  const [category, setCategory] = useState<MarketCategory>("化粧水");
  // 실데이터는 Qoo10으로 수집한다 (2026-10-24 결정). 楽天은 비교용 샘플
  const [platform, setPlatform] = useState<MarketPlatform>("qoo10_ranking");
  const [panel, setPanel] = useState<PanelContent | null>(null);
  // 검색 데이터 한 벌 (지금 수집 결과를 붙이면 2-A 자동완성·요약이 같이 바뀐다)
  const [searchSnaps, setSearchSnaps] = useState(search);
  // 표 체크박스와 패널의 [비교에 추가]가 같은 목록을 쓴다 (저장되지 않음)
  const [selected, setSelected] = useState<string[]>([]);

  const platformInfo = MARKET_PLATFORMS.find((p) => p.source === platform) ?? MARKET_PLATFORMS[0];
  const series = seriesOf(snapshots, platform, category);
  const sameSource = snapshots.filter((s) => s.source === platform);
  const latest = series.at(-1);
  const week = latest ? `${weekLabel(latest.captured_at)} 주` : null;
  // 랭킹을 쓰는 섹션(요약·시장 개관·플랫폼 분석)은 실데이터면 실데이터로 표시한다. 소비자 트렌드는 아직 샘플 데이터라 샘플 그대로
  const realRanking = Boolean(latest?.id.startsWith(IMPORTED_SNAPSHOT_PREFIX));
  const baseBasis = week ? `${week} · ${platformInfo.label}` : `${platformInfo.label} · 이 카테고리 데이터 없음`;
  const basis = week && realRanking ? `${baseBasis} 수집 데이터` : baseBasis;

  const toggleCompare = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_COMPARE ? cur : [...cur, id]));

  const body: Record<SectionId, React.ReactNode> = {
    market: <MarketPart series={series} platformLabel={platformInfo.label} products={products} onOpen={setPanel} />,
    summary: (
      <SummaryPart series={series} products={products} category={category} search={searchSnaps} />
    ),
    // 예전 AI 검색 핵심 포인트: 가장 실무적인 Gap 액션 플랜을 요약 바로 아래로 (2026-10-25 실무자 리뷰)
    action: <GeoInsights initial={geo.map((g, i) => ({ ...g, id: `geo-row-${i}` }))} ownProducts={products.filter((p) => p.kind === "own")} category={category} gapFirst />,
    supply: (
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
    ),
    demand: <DemandPart search={searchSnaps} onSearchCollected={(added) => setSearchSnaps((s) => [...s, ...added])} snsNotes={snsNotes} snsPatterns={snsPatterns} snsImported={snsImported} category={category} onOpen={setPanel} />,
  };

  return (
    <>
      <ConditionBar category={category} onCategory={setCategory} platform={platform} onPlatform={setPlatform} week={week} sections={SECTIONS} />
      <ViewStateGate>
        <div className="space-y-10">
          {SECTIONS.map((s) => (
            // 바로가기로 이동했을 때 머리말이 고정 바에 가려지지 않게 scroll-margin을 준다
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-40">
              <SectionHeader titleId={`${s.id}-title`} title={s.title} question={s.question} basis={s.id === "demand" || s.id === "action" ? baseBasis : basis} real={realRanking && s.id !== "demand" && s.id !== "action"} />
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
