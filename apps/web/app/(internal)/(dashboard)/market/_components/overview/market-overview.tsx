"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ViewStateGate } from "@/components/common/view-state";
import { IMPORTED_SNAPSHOT_PREFIX, MARKET_PLATFORMS, type MarketCategory, type MarketPlatform } from "@/lib/market-config";
import type { GeoSnapshot } from "@/lib/schemas/geo";
import type { SnsPattern, SnsVideoNote } from "@/lib/schemas/market";
import type { Product } from "@/lib/schemas/product";
import type { PromoEvent } from "@/lib/schemas/promo";
import type { SearchSnap } from "@/lib/schemas/search";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { weekLabel } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { ownBaseline, seriesOf } from "@/app/(internal)/(dashboard)/market/_lib/overview";
import { ConditionBar } from "./condition-bar";
import { SupplyPart } from "./part1-supply";
import { DemandPart } from "./part2-demand";
import { SummaryPart } from "./summary";
import type { MarketTab } from "@/app/(internal)/(dashboard)/market/_lib/summary";
import { CompetitorsView } from "@/app/(internal)/(dashboard)/market/_components/competitors-view";
import { GeoInsights } from "@/app/(internal)/(dashboard)/market/_components/geo-insights";
import { SectionHeader } from "./section-header";
import { MAX_COMPARE, OverviewPanel, type PanelContent } from "./side-panel";

// 탭 순서 = 팀장이 읽는 순서 (요약 → 우리 제품 대응 → 플랫폼 분석 → 소비자 트렌드 → 경쟁제품). 2026-10-25 한 페이지 스크롤을 탭으로 나눴다
const TABS = [
  { id: "summary", label: "요약", title: "이번 주 핵심", question: "각 탭에서 바로 써먹을 결론과 할 일", help: "각 탭의 계산 결과로 만든 결론과 할 일이에요 (AI 없이 정해진 규칙). 할 일은 제안이고 최종 판단은 담당자가 해요. 카드의 ? 에 근거 숫자가 있어요." },
  { id: "action", label: "우리 제품 대응", title: "우리 제품 대응", question: "AI 검색이 경쟁 제품을 추천할 때 드는 이유 중 우리가 채울 것은?" },
  { id: "supply", label: "플랫폼 분석", title: "플랫폼 분석", question: "이 플랫폼 상위권에 들려면 무엇이 필요하고, 얼마에 팔리나?" },
  { id: "demand", label: "소비자 트렌드", title: "소비자 트렌드", question: "소비자는 지금 무엇을 기준으로 고르나?" },
  { id: "competitors", label: "경쟁제품", title: "경쟁제품 비교", question: "등록된 제품의 가격·용량·성분·특징을 나란히 보면?" },
] as const satisfies readonly { id: MarketTab; label: string; title: string; question: string; help?: string }[];

const TAB_LABEL = Object.fromEntries(TABS.map((t) => [t.id, t.label])) as Record<MarketTab, string>;

// 열린 탭은 주소의 #id에서 읽는다 (예전 바로가기 주소 #demand 등도 그대로 그 탭으로 열린다). 서버 렌더에서는 요약
// 시장 개관 탭은 2026-10-25에 없앴다: 가격 포지셔닝 맵은 플랫폼 분석으로 옮겼으니 예전 주소 #market은 플랫폼 분석으로 연다
const TAB_ALIAS: Record<string, MarketTab> = { market: "supply" };
function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
function readTab(): MarketTab {
  const hash = window.location.hash.slice(1);
  const id = TAB_ALIAS[hash] ?? hash;
  return TABS.find((t) => t.id === id)?.id ?? "summary";
}
function useMarketTab(): MarketTab {
  return useSyncExternalStore(subscribeHash, readTab, () => "summary");
}

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
  geo: GeoSnapshot[];
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
  const tab = useMarketTab();

  const platformInfo = MARKET_PLATFORMS.find((p) => p.source === platform) ?? MARKET_PLATFORMS[0];
  const series = seriesOf(snapshots, platform, category);
  const sameSource = snapshots.filter((s) => s.source === platform);
  const latest = series.at(-1);
  const week = latest ? `${weekLabel(latest.captured_at)} 주` : null;
  // 랭킹을 쓰는 탭(요약·플랫폼 분석)은 실데이터면 실데이터로 표시한다. 소비자 트렌드·우리 제품 대응·경쟁제품은 랭킹 데이터가 아니라 그대로
  const realRanking = Boolean(latest?.id.startsWith(IMPORTED_SNAPSHOT_PREFIX));
  const baseBasis = week ? `${week} · ${platformInfo.label}` : `${platformInfo.label} · 이 카테고리 데이터 없음`;
  const basis = week && realRanking ? `${baseBasis} 수집 데이터` : baseBasis;

  const toggleCompare = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_COMPARE ? cur : [...cur, id]));

  // 샘플 GEO 답변은 id가 「geo-」로 시작한다 (DB 행은 uuid)
  const geoCategory = geo.filter((g) => g.category === category);
  const geoIsSample = geoCategory.length > 0 && geoCategory.every((g) => g.id.startsWith("geo-"));
  const productIds = new Set(products.map((p) => p.id));

  const body: Record<MarketTab, React.ReactNode> = {
    summary: (
      <SummaryPart series={series} products={products} category={category} search={searchSnaps} geo={geo} geoIsSample={geoIsSample} tabLabel={TAB_LABEL} />
    ),
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
    // 플랫폼 분석 Top 10 표에서 고른 제품을 처음부터 골라 둔다 (등록된 제품만)
    competitors: <CompetitorsView products={products} initialSelected={selected.filter((id) => productIds.has(id))} />,
  };
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  const rankingTab = tab === "summary" || tab === "supply";
  const tabBasis = tab === "competitors" ? `등록 제품 ${products.length}개` : rankingTab ? basis : baseBasis;

  // 탭을 바꾸면 맨 위부터 보이게 (요약 카드의 [탭 열기]를 아래에서 눌러도)
  useEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <>
      <ConditionBar category={category} onCategory={setCategory} platform={platform} onPlatform={setPlatform} week={week} tabs={TABS} active={tab} />
      <ViewStateGate>
        <section aria-labelledby={`${current.id}-title`}>
          <SectionHeader titleId={`${current.id}-title`} title={current.title} question={current.question} basis={tabBasis} real={realRanking && rankingTab} help={"help" in current ? current.help : undefined} />
          {body[current.id]}
        </section>
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
