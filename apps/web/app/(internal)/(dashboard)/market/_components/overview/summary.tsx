"use client";

import { useState, type ReactNode } from "react";
import { SubmissionPanel } from "@/components/common/submission-panel";
import type { SubmissionPanelData } from "@/components/common/submission-section";
import { saveMarketDraft } from "@/lib/data/submission-actions";
import type { MarketPlatform } from "@/lib/market-config";
import { EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GeoSnap } from "@/lib/schemas/geo";
import type { Product } from "@/lib/schemas/product";
import type { SnsTrendResult } from "@/lib/schemas/market";
import type { SearchSnap } from "@/lib/schemas/search";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { glance, keyPoints, priceGapLabel, weekCore, type MarketTab } from "@/app/(internal)/(dashboard)/market/_lib/summary";
import { MiniDonut, NeedPips, PriceCompare, RankBars, Waffle } from "./glance-charts";

/**
 * 요약 탭 (2026-10-26, 소비자 설문 요약과 같은 모양): 이번 주 핵심 3칸 → 이번 분석으로 알 수 있는 것 → 한눈에 보기.
 * 시장 분석 담당자 기준으로 고른 내용이고, 숫자는 모두 저장된 데이터(랭킹·검색·AI 검색·등록 제품·마지막 TikTok 분석)에서 계산한다.
 * 자세한 탭은 「한눈에 보기」 칸 아래 「~ 탭 열기」로 간다 (위쪽 탭 줄에는 요약·경쟁제품만 있다)
 */
export function SummaryPart({
  series,
  products,
  category,
  search,
  geo,
  geoIsSample,
  tabLabel,
  platformLabel,
  week,
  sns,
  platform,
  submissionPanels,
}: {
  series: TrendSnapshot[];
  products: Product[];
  category: string;
  search: SearchSnap[];
  geo: GeoSnap[];
  geoIsSample: boolean;
  tabLabel: Record<MarketTab, string>;
  platformLabel: string;
  week: string | null;
  /** 이 카테고리의 마지막 저장 SNS 분석 (없으면 null) */
  sns: SnsTrendResult | null;
  /** 시안을 저장할 때 서버에 넘기는 고른 플랫폼 */
  platform: MarketPlatform;
  /** 판매 중인 자사 제품별 시안 패널 데이터 */
  submissionPanels: Record<string, SubmissionPanelData>;
}) {
  // 시안을 올릴 제품: 판매 중인 자사 제품 (같은 카테고리를 먼저). 시안은 제품 × 시장 분석 칸에 쌓인다
  const saleProducts = products
    .filter((p) => p.kind === "own" && p.sale_status === "on_sale" && submissionPanels[p.id])
    .toSorted((a, b) => Number(b.category === category) - Number(a.category === category));
  const [ownPick, setOwnPick] = useState<string | null>(null);
  const ownProductId = ownPick && saleProducts.some((p) => p.id === ownPick) ? ownPick : (saleProducts[0]?.id ?? null);
  const panel = ownProductId ? submissionPanels[ownProductId] : undefined;
  const core = weekCore({ series, products, category, search, sns });
  const points = keyPoints({ series, products, category, search, geo, geoIsSample, sns });
  const g = glance({ series, products, category, search, geo });
  if (core.length === 0 && points.length === 0 && g.rankingCount === 0) return <EmptyState message="이 플랫폼·카테고리의 데이터가 없어요" />;
  const link = (tab: MarketTab) => (
    <a href={`#${tab}`} className="text-xs whitespace-nowrap text-muted-foreground underline underline-offset-4 hover:text-foreground">
      {tabLabel[tab]} 탭 열기 →
    </a>
  );

  return (
    <div className="space-y-6">
      {/* 이번 주 핵심 3칸: 우리 가격 위치 · 행사 경쟁 · 소비자가 찾는 것 */}
      {core.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {core.map((b) => (
            <Card key={b.id}>
              <CardContent className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{b.label}</p>
                <p className="text-xl leading-snug font-semibold break-keep">{b.value}</p>
                <p className="text-sm leading-relaxed break-keep">{b.meaning}</p>
                {b.sub && <p className="text-xs leading-relaxed break-keep text-muted-foreground">{b.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {points.length > 0 && (
        <section className="space-y-3 rounded-xl bg-muted px-6 py-5">
          <h2 className="font-semibold">이번 분석으로 알 수 있는 것</h2>
          <ul className="space-y-4">
            {points.map((p) => (
              <li key={p.id} className="grid gap-x-3 gap-y-1 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
                <span className="self-start">
                  {/* 주제 알약 */}
                  <span className="inline-flex rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">{p.label}</span>
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="leading-relaxed font-semibold break-keep">
                    {p.headline}
                    {p.sample && (
                      <Badge variant="outline" className="ml-1.5 align-middle">
                        샘플
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm leading-relaxed break-keep text-muted-foreground">할 일: {p.action}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            한눈에 보기{" "}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {platformLabel} {category} · {week ?? "랭킹 데이터 없음"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Tile title="ml당 가격" note="정가 기준" footer={link("supply")}>
            {g.price ? (
              <>
                <Hero value={g.price.own ? `${g.price.own.ppm}円` : `${g.price.median}円`} label={priceGapLabel(g.price)} />
                <PriceCompare {...g.price} />
              </>
            ) : (
              <Empty>용량을 아는 순위권 제품이 없어요</Empty>
            )}
          </Tile>

          <Tile title="AI 검색 키워드" note={g.geoKeywords ? `AI 답변 ${g.geoKeywords.answers}개 중 언급` : undefined} footer={link("action")}>
            {g.geoKeywords && g.geoKeywords.rows.length > 0 ? (
              <>
                <Hero value={`${g.geoKeywords.rows[0].count}회`} label={g.geoKeywords.rows[0].keyword} lang="ja" />
                <RankBars rows={g.geoKeywords.rows.map((r) => ({ label: r.keyword, sub: r.ko, count: r.count }))} unit="회" />
              </>
            ) : g.geoKeywords ? (
              <Empty>AI 답변 {g.geoKeywords.answers}개에서 2회 이상 언급된 키워드가 아직 없어요</Empty>
            ) : (
              <Empty>아직 측정 전이에요 · 위 [데이터 업데이트]</Empty>
            )}
          </Tile>

          <Tile title="상위권 브랜드" note="Top 10 순위" footer={link("supply")}>
            {g.brands ? (
              <>
                <Hero value={`${g.brands.leaderCount}/${g.brands.cells.length}`} label={g.brands.leader} lang="ja" />
                <Waffle {...g.brands} />
              </>
            ) : (
              <Empty>랭킹 데이터가 없어요</Empty>
            )}
          </Tile>

          <Tile title="성분 검색 관심도" note="합 100%" footer={link("demand")}>
            {g.interest ? (
              <>
                <Hero value={`${g.interest.slices[0].share}%`} label={g.interest.slices[0].label} />
                <MiniDonut slices={g.interest.slices} />
              </>
            ) : (
              <Empty>아직 수집 전이에요 · 위 [데이터 업데이트]</Empty>
            )}
          </Tile>

          <Tile title="고민별 검색 추천어" note="Google 자동완성 1위" footer={link("demand")}>
            {g.language.length > 0 ? (
              <ul className="space-y-2.5 text-[13px]">
                {g.language.map((l) => (
                  <li key={l.seed} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium whitespace-nowrap">{l.ko}</span>
                    <span className="min-w-0">
                      <span lang="ja" className="block font-medium break-keep">
                        {l.seed} {l.term}
                      </span>
                      {l.termKo && <span className="block text-xs text-muted-foreground">{l.termKo}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>아직 수집 전이에요 · 위 [데이터 업데이트]</Empty>
            )}
          </Tile>

          <Tile title="SNS 핵심 니즈" note={sns ? `TikTok ${sns.videos.length}개 · ${sns.analyzed_at.slice(5, 10).replace("-", "/")}` : "TikTok"} footer={link("demand")}>
            {sns && sns.needs.length > 0 ? (
              <>
                <Hero value={`${sns.needs[0].videos.length}/${sns.videos.length}`} label={sns.needs[0].need_ko} />
                <NeedPips needs={sns.needs.slice(0, 4).map((n) => ({ label: n.need_ko, count: n.videos.length }))} total={sns.videos.length} />
              </>
            ) : (
              <Empty>아직 분석 전이에요 · 소비자 트렌드 탭에서 영상 링크를 넣고 [분석 시작] (결과는 팀 DB에 저장돼요)</Empty>
            )}
          </Tile>

        </CardContent>
      </Card>

      {/* 시안 · 결재: 위 요약(이번 주 핵심 · 알 수 있는 것 · 한눈에 보기)을 그대로 고정해 올린다 */}
      {panel && ownProductId ? (
        <div>
          {saleProducts.length > 1 && (
            <label className="-mb-3 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
              시안 제품
              <select className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground" value={ownProductId} onChange={(e) => setOwnPick(e.target.value)}>
                {saleProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <SubmissionPanel
            {...panel}
            saveDraft={(input) => saveMarketDraft(ownProductId, { category, platform }, { summary: input.summary, note: input.note })}
            snapshotNote={`위 요약 탭 내용(${platformLabel} ${category} · ${week ?? "기준 주 없음"})을 그대로 저장해요. 제출하면 고칠 수 없어요.`}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">판매 중인 자사 제품이 있어야 시안을 올릴 수 있어요.</p>
      )}
    </div>
  );
}

function Tile({ title, note, footer, children }: { title: string; note?: string; footer: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border px-[18px] py-4">
      <h3 className="flex justify-between gap-2 text-[13px] font-medium text-muted-foreground">
        <span>{title}</span>
        {note && <span className="text-right font-normal">{note}</span>}
      </h3>
      {children}
      <div className="mt-auto pt-1">{footer}</div>
    </section>
  );
}

/** 칸의 대표 숫자 + 이름 */
function Hero({ value, label, lang }: { value: string; label: string; lang?: string }) {
  return (
    <p className="flex min-w-0 items-baseline gap-2">
      <b className="shrink-0 text-[26px] font-bold tabular-nums">{value}</b>
      <span lang={lang} className="min-w-0 truncate text-sm font-semibold" title={label}>
        {label}
      </span>
    </p>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed break-keep text-muted-foreground">{children}</p>;
}
