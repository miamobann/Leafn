"use client";

import { Button } from "@/components/ui/button";
import { MARKET_CATEGORIES, MARKET_PLATFORMS, type MarketCategory, type MarketPlatform } from "@/lib/market-config";
import { ToggleGroup } from "@/app/(internal)/(dashboard)/market/_components/toggle-group";

export type SectionLink = { id: string; label: string };

/**
 * 상단 고정 조건 바. 카테고리·플랫폼을 바꾸면 아래 모든 섹션이 함께 바뀐다.
 * 스크롤 영역(main)의 p-8 안쪽에서 붙으므로 -top-8로 맨 위에 맞추고, 좌우 여백은 음수 여백으로 덮어 폭 전체에 깐다.
 */
export function ConditionBar({
  category,
  onCategory,
  platform,
  onPlatform,
  week,
  sections,
}: {
  category: MarketCategory;
  onCategory: (c: MarketCategory) => void;
  platform: MarketPlatform;
  onPlatform: (p: MarketPlatform) => void;
  /** 선택한 플랫폼·카테고리의 최신 수집 주 (없으면 null) */
  week: string | null;
  sections: readonly SectionLink[];
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
      <nav aria-label="섹션 바로가기" className="flex flex-wrap items-center gap-1 text-sm">
        <span className="mr-1 text-xs text-muted-foreground">바로가기</span>
        {sections.map((s, i) => (
          <span key={s.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground">·</span>}
            <a href={`#${s.id}`} className="rounded px-1 underline-offset-4 hover:underline">
              {s.label}
            </a>
          </span>
        ))}
      </nav>
    </div>
  );
}
