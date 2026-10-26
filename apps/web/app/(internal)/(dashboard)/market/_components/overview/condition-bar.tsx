"use client";

import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { MARKET_CATEGORIES, MARKET_PLATFORMS, type MarketCategory, type MarketPlatform } from "@/lib/market-config";
import { ToggleGroup } from "@/app/(internal)/(dashboard)/market/_components/toggle-group";

export type TabLink = { id: string; label: string };

/**
 * 상단 고정 조건 바 + 탭. 카테고리·플랫폼을 바꾸면 모든 탭이 함께 바뀐다.
 * 스크롤 영역(main)의 p-8 안쪽에서 붙으므로 -top-8로 맨 위에 맞추고, 좌우 여백은 음수 여백으로 덮어 폭 전체에 깐다.
 */
export function ConditionBar({
  category,
  onCategory,
  platform,
  onPlatform,
  week,
  tabs,
  active,
}: {
  category: MarketCategory;
  onCategory: (c: MarketCategory) => void;
  platform: MarketPlatform;
  onPlatform: (p: MarketPlatform) => void;
  /** 선택한 플랫폼·카테고리의 최신 수집 주 (없으면 null) */
  week: string | null;
  tabs: readonly TabLink[];
  /** 지금 열린 탭 id */
  active: string;
}) {
  return (
    <div className="sticky -top-8 z-20 -mx-8 mb-6 space-y-2 border-b bg-background px-8 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <ToggleGroup label="카테고리" options={MARKET_CATEGORIES} value={category} onChange={onCategory} />
        <div role="group" aria-label="플랫폼" className="flex items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground">플랫폼</span>
          {MARKET_PLATFORMS.map((p) => (
            <Button key={p.source} size="sm" variant={p.source === platform ? "default" : "outline"} aria-pressed={p.source === platform} onClick={() => onPlatform(p.source)}>
              <span lang="ja">{p.label}</span>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs text-muted-foreground">기준 주</span>
          <span className="font-medium">{week ?? "데이터 없음"}</span>
          <Button size="sm" variant="outline" disabled title="다음 단계">
            이전 주 ▼ <span className="text-xs text-muted-foreground">다음 단계</span>
          </Button>
        </div>
      </div>
      {/* 탭은 주소의 #id로 바뀐다 (새로고침·링크 공유해도 같은 탭) */}
      <nav aria-label="시장 분석 탭" className="-mb-3 flex flex-wrap gap-1">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            aria-current={t.id === active ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2 text-sm",
              t.id === active ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
