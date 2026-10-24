"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/common/states";
import { ViewStateGate } from "@/components/common/view-state";
import { MARKET_PLATFORMS, type MarketCategory, type MarketPlatform } from "@/lib/market-config";
import type { Product } from "@/lib/schemas/product";
import type { PromoEvent } from "@/lib/schemas/promo";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { weekLabel } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { ownBaseline, seriesOf } from "@/app/(internal)/(dashboard)/market/_lib/overview";
import { ConditionBar } from "./condition-bar";
import { MarketPart } from "./part0-market";
import { SupplyPart } from "./part1-supply";
import { SectionHeader } from "./section-header";
import { MAX_COMPARE, OverviewPanel, type PanelContent } from "./side-panel";

// 섹션 순서 = 팀장이 읽는 순서 (요약 → 시장 개관 → 공급 → 수요 → 기회와 전략)
const SECTIONS = [
  { id: "summary", label: "요약", title: "이번 주 핵심", question: "공급·수요·기회를 한 줄씩", featureIds: [] },
  { id: "market", label: "시장 개관", title: "PART 0. 시장 개관", question: "이 카테고리에서 K-뷰티가 커지고 있나?", featureIds: ["B"] },
  { id: "supply", label: "공급", title: "PART 1. 공급", question: "상위권에 들려면 무엇이 필요한가?", featureIds: ["B", "C"] },
  { id: "demand", label: "수요", title: "PART 2. 수요", question: "소비자와 AI 검색은 지금 무엇을 기준으로 고르나?", featureIds: ["B", "GEO"] },
  { id: "opportunity", label: "기회와 전략", title: "PART 3. 기회와 전략", question: "자사는 어디에 서서 무엇을 말할까?", featureIds: ["A", "C"] },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// 아직 만들지 않은 파트의 자리 표시. 기존 상세 화면 링크는 새 탭으로 연다
const PLACEHOLDER: Partial<Record<SectionId, { message: string; links: { href: string; label: string }[] }>> = {
  summary: { message: "다른 섹션 완성 후 표시", links: [] },
  demand: { message: "다음 단계에서 표시", links: [{ href: "/market/ingredients", label: "성분 관심도" }] },
  opportunity: { message: "다음 단계에서 표시", links: [] },
};

export function MarketOverview({ snapshots, products, promoEvents }: { snapshots: TrendSnapshot[]; products: Product[]; promoEvents: PromoEvent[] }) {
  const [category, setCategory] = useState<MarketCategory>("化粧水");
  const [platform, setPlatform] = useState<MarketPlatform>("rakuten_ranking");
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

  const body: Partial<Record<SectionId, React.ReactNode>> = {
    market: <MarketPart series={series} platformLabel={platformInfo.label} onOpen={setPanel} />,
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
  };

  return (
    <>
      <ConditionBar category={category} onCategory={setCategory} platform={platform} onPlatform={setPlatform} week={week} sections={SECTIONS} />
      <ViewStateGate>
        <div className="space-y-10">
          {SECTIONS.map((s) => {
            const placeholder = PLACEHOLDER[s.id];
            return (
              // 바로가기로 이동했을 때 머리말이 고정 바에 가려지지 않게 scroll-margin을 준다
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-40">
                <SectionHeader titleId={`${s.id}-title`} title={s.title} question={s.question} basis={basis} featureIds={[...s.featureIds]} />
                {body[s.id] ?? (
                  <>
                    <EmptyState message={placeholder?.message} />
                    {placeholder && placeholder.links.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        지금은 기존 화면에서 볼 수 있어요:{" "}
                        {placeholder.links.map((l, i) => (
                          <span key={l.href}>
                            {i > 0 && " · "}
                            <Link href={l.href} target="_blank" className="underline underline-offset-4">
                              {l.label} ↗
                            </Link>
                          </span>
                        ))}
                      </p>
                    )}
                  </>
                )}
              </section>
            );
          })}
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
