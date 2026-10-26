"use client";

import { useEffect, useState, type ReactNode } from "react";
import { HelpTip } from "@/components/common/help-tip";
import { EmptyState } from "@/components/common/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatJpy } from "@/lib/format";
import { platformLabel } from "@/lib/platforms";
import type { Product } from "@/lib/schemas/product";
import { translateCompareTexts } from "@/lib/data/compare-actions";
import {
  featureLines,
  fullIngredientsKo,
  ingredientGroups,
  ingredientKo,
  isJapanese,
  isSetProduct,
  knownKo,
  percentDiff,
  perMl,
  saleOf,
  shippingOf,
  volumeDiff,
  type ComparePair,
  type Diff,
} from "@/app/(internal)/(dashboard)/market/_lib/compare";

// 경쟁제품 1:1 비교 패널 (2026-10-26). 정보 비교만 한다: 해석·추천·약기법 안내·AI 요약은 넣지 않는다.
// 일본어 원문 아래에는 한국어 해석을 회색으로 (AI 번역, 화면을 열 때 한 번, 저장하지 않음)
const SELECT = "h-8 w-full max-w-xs rounded-lg border border-input bg-background px-2 text-sm text-foreground";

/** 번역 결과는 탭을 오가도 다시 부르지 않게 브라우저 메모리에 둔다 */
const translationCache = new Map<string, string>();
const inFlight = new Set<string>();

/** 화면에 보이는 일본어 문구의 한국어 해석. 번역하지 못한 문구는 ""(해석 없음)로 남겨 다시 부르지 않는다 */
function useKoreanCaptions(texts: string[]): { ko: Record<string, string>; error: string | null } {
  const key = texts.join("\u0000");
  const [, rerender] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // 이미 해석했거나 지금 해석 중인 문구는 다시 부르지 않는다 (개발 모드에서 effect가 두 번 돌아도 한 번만)
    const missing = texts.filter((t) => !translationCache.has(t) && !inFlight.has(t));
    if (missing.length === 0) return;
    missing.forEach((t) => inFlight.add(t));
    translateCompareTexts(missing.slice(0, 40)).then((r) => {
      if (r.ok) Object.entries(r.items).forEach(([ja, ko]) => translationCache.set(ja, ko));
      missing.forEach((t) => {
        inFlight.delete(t);
        if (!translationCache.has(t)) translationCache.set(t, "");
      });
      setError(r.ok ? null : r.message);
      rerender((n) => n + 1);
    });
    // texts는 key로 비교한다 (배열은 렌더마다 새로 만들어진다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { ko: Object.fromEntries(texts.filter((t) => translationCache.has(t)).map((t) => [t, translationCache.get(t) as string])), error };
}

/** 원문 + 회색 한국어 해석 */
function Ja({ text, ko }: { text: string; ko: Record<string, string> }) {
  if (!isJapanese(text)) return <span>{text}</span>;
  return (
    <span className="block">
      <span lang="ja">{text}</span>
      <span className="block text-xs text-muted-foreground">{ko[text] === undefined ? "해석 중…" : ko[text] || "해석 없음"}</span>
    </span>
  );
}

function DiffMark({ diff }: { diff: Diff | null }) {
  if (!diff) return null;
  return <span className="ml-1 text-xs font-medium text-muted-foreground">{diff.text}</span>;
}

function Value({ main, sub }: { main: ReactNode; sub?: ReactNode }) {
  return (
    <span className="block">
      {main}
      {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
    </span>
  );
}

export function ComparePanel({
  pair,
  ownProducts,
  competitorProducts,
  onChange,
  onClose,
}: {
  pair: ComparePair;
  ownProducts: Product[];
  competitorProducts: Product[];
  onChange: (ownId: string | null, competitorId: string | null) => void;
  onClose: () => void;
}) {
  const { own, competitor } = pair;
  const texts =
    own && competitor
      ? [...new Set([own.name, competitor.name, ...featureLines(own), ...featureLines(competitor)].filter(isJapanese))].filter((t) => !(t in knownKo(own)) && !(t in knownKo(competitor)))
      : [];
  const { ko: translated, error } = useKoreanCaptions(texts);
  const ko = own && competitor ? { ...knownKo(own), ...knownKo(competitor), ...translated } : translated;

  const pickers = (
    <div className="grid gap-2 md:grid-cols-2">
      <label className="grid gap-1 text-xs text-muted-foreground">
        자사 제품 바꾸기
        <select className={SELECT} value={own?.id ?? ""} onChange={(e) => onChange(e.target.value || null, competitor?.id ?? null)}>
          {ownProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        경쟁 제품 바꾸기
        <select className={SELECT} value={competitor?.id ?? ""} onChange={(e) => onChange(own?.id ?? null, e.target.value || null)}>
          <option value="">경쟁 제품을 골라 주세요</option>
          {competitorProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.brand} {p.title_ai?.name_ko ?? p.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  if (!own || !competitor) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>1:1 비교</CardTitle>
          <Button size="sm" variant="outline" onClick={onClose}>
            비교 닫기
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <EmptyState message="비교할 경쟁 제품을 골라주세요" action="아래 표에서 [이 제품과 비교]를 누르거나 위에서 골라요" />
          {pickers}
        </CardContent>
      </Card>
    );
  }

  const ownPpm = perMl(own);
  const compPpm = perMl(competitor);
  const ownSale = saleOf(own);
  const compSale = saleOf(competitor);
  const groups = ingredientGroups(own, competitor);
  const sameUnit = own.volume_ml != null && competitor.volume_ml != null;
  const list = (items: string[]) => (items.length > 0 ? items.map(ingredientKo).join(", ") : "—");

  const rows: { label: ReactNode; own: ReactNode; competitor: ReactNode }[] = [
    {
      label: "가격",
      own: (
        <Value
          main={
            <>
              {formatJpy(own.price_jpy)}
              <DiffMark diff={percentDiff(own.price_jpy, competitor.price_jpy)} />
            </>
          }
          sub={ownSale ? `${ownSale.label} ${formatJpy(ownSale.price)}${ownSale.rate ? ` (${ownSale.rate}% 할인)` : ""}` : undefined}
        />
      ),
      competitor: (
        <Value
          main={formatJpy(competitor.price_jpy)}
          sub={[compSale ? `${compSale.label} ${formatJpy(compSale.price)}${compSale.rate ? ` (${compSale.rate}% 할인)` : ""}` : null, shippingOf(competitor) ?? "배송 조건 정보 없음"].filter(Boolean).join(" · ")}
        />
      ),
    },
    {
      label: "용량",
      own: (
        <Value
          main={
            <>
              {own.volume_ml ? `${own.volume_ml}ml` : "정보 없음"}
              <DiffMark diff={volumeDiff(own.volume_ml, competitor.volume_ml)} />
            </>
          }
        />
      ),
      competitor: <Value main={competitor.volume_ml ? `${competitor.volume_ml}ml` : "정보 없음"} sub={isSetProduct(competitor) ? "세트 상품 (구성은 상품명 참고)" : undefined} />,
    },
    {
      label: (
        <span className="inline-flex items-center gap-1">
          ml당 가격
          <HelpTip>평시가 ÷ 총 용량 (같은 제품 추가분만 더하고, 다른 제품 증정품은 넣지 않아요). 아래 작은 숫자는 행사가 기준이에요. 저장하지 않고 화면에서 계산해요.</HelpTip>
        </span>
      ),
      own: sameUnit ? (
        <Value
          main={
            <span className="text-base font-semibold">
              {ownPpm.regular != null ? `¥${ownPpm.regular}` : "—"}
              <DiffMark diff={percentDiff(ownPpm.regular, compPpm.regular)} />
            </span>
          }
          sub={ownPpm.sale != null ? `행사가 기준 ¥${ownPpm.sale}` : undefined}
        />
      ) : (
        <span className="text-muted-foreground">단위가 달라 비교 불가</span>
      ),
      competitor: sameUnit ? (
        <Value main={<span className="text-base font-semibold">{compPpm.regular != null ? `¥${compPpm.regular}` : "—"}</span>} sub={compPpm.sale != null ? `행사가 기준 ¥${compPpm.sale}` : undefined} />
      ) : (
        <span className="text-muted-foreground">단위가 달라 비교 불가</span>
      ),
    },
    {
      label: "주요 성분",
      own: (
        <Value
          main={
            <span className="block space-y-1">
              <span className="block">공통: {list(groups.common)}</span>
              <span className="block">자사에만: {list(groups.ownOnly)}</span>
            </span>
          }
          sub={`사전에 없는 성분(미분류) ${groups.unclassified.own}개`}
        />
      ),
      competitor: (
        <Value
          main={
            <span className="block space-y-1">
              <span className="block">공통: {list(groups.common)}</span>
              <span className="block">경쟁에만: {list(groups.competitorOnly)}</span>
            </span>
          }
          sub={`사전에 없는 성분(미분류) ${groups.unclassified.competitor}개`}
        />
      ),
    },
    {
      label: "전성분",
      own: <FullIngredients p={own} />,
      competitor: <FullIngredients p={competitor} />,
    },
    {
      label: "특징",
      own: <Lines lines={featureLines(own)} ko={ko} />,
      competitor: <Lines lines={featureLines(competitor)} ko={ko} />,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-1.5">
          1:1 비교
          <HelpTip>자사 값 옆의 ▲ 높음 / ▼ 낮음 / = 같음은 경쟁 제품 대비 값의 크고 작음만 뜻해요. 계산: (자사 − 경쟁) ÷ 경쟁.</HelpTip>
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onChange(own.id, null)}>
            다른 경쟁 제품과 비교
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            비교 닫기
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {pair.autoOwn && (
          <Alert>
            <AlertDescription>자사 제품을 자동으로 골랐습니다 · 아래 「자사 제품 바꾸기」에서 바꿀 수 있어요</AlertDescription>
          </Alert>
        )}
        {pair.tooMany && (
          <Alert>
            <AlertDescription>1:1 비교만 지원합니다 · 자사 1개와 첫 경쟁 제품 1개만 보여 줘요</AlertDescription>
          </Alert>
        )}
        {own.category && competitor.category && own.category !== competitor.category && (
          <Alert>
            <AlertDescription>
              카테고리가 다른 제품입니다 ({own.category} vs {competitor.category})
            </AlertDescription>
          </Alert>
        )}
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
        {pickers}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">항목</TableHead>
              <TableHead className="w-[42%] align-top whitespace-normal">
                <Badge>자사</Badge>
                <span className="mt-1 block font-medium text-foreground">
                  <Ja text={own.name} ko={ko} />
                </span>
                <span className="block text-xs font-normal">
                  {own.brand} · {own.category ?? "미분류"} · 가격은 일본 판매 예정가 (税込) · 특징은 자사 문구 초안
                </span>
              </TableHead>
              <TableHead className="align-top whitespace-normal">
                <Badge variant="outline">경쟁</Badge>
                <span className="mt-1 block font-medium text-foreground">
                  <Ja text={competitor.name} ko={ko} />
                </span>
                <span className="block text-xs font-normal">
                  <span lang="ja">{competitor.brand}</span> · {competitor.category ?? "미분류"} · {platformLabel(competitor.platform)}
                  {competitor.url && (
                    <>
                      {" · "}
                      <a href={competitor.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                        판매 페이지 ↗
                      </a>
                    </>
                  )}
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="align-top text-xs font-medium text-muted-foreground">{r.label}</TableCell>
                <TableCell className="align-top whitespace-normal">{r.own}</TableCell>
                <TableCell className="align-top whitespace-normal">{r.competitor}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Lines({ lines, ko }: { lines: string[]; ko: Record<string, string> }) {
  if (lines.length === 0) return <span className="text-muted-foreground">정보 없음</span>;
  return (
    <ul className="space-y-1">
      {lines.map((l) => (
        <li key={l}>
          <Ja text={l} ko={ko} />
        </li>
      ))}
    </ul>
  );
}

function FullIngredients({ p }: { p: Product }) {
  if (p.ingredients.length === 0) return <span className="text-muted-foreground">정보 없음</span>;
  const koText = fullIngredientsKo(p);
  return (
    <details>
      <summary className="cursor-pointer text-xs">전성분 {p.ingredients.length}개 펼치기</summary>
      <p lang="ja" className="mt-1 text-xs">
        {p.ingredients.join("、")}
      </p>
      {koText && <p className="mt-1 text-xs text-muted-foreground">{koText}</p>}
    </details>
  );
}
