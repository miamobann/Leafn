"use client";

// 콘텐츠 제작 가이드: 제품·사용처(상세페이지면 플랫폼)를 고르면 제목 3개(좌)·미리보기(우)·본문(아래)을 보여준다.
// 화면 뼈대라 샘플 데이터만 쓴다. AI 호출·저장·PDF 출력은 아직 없다.
import { useState } from "react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { AdUsage } from "@/lib/schemas/ad-check";
import { fillProduct, type GuideDraft } from "../_lib/content-guide-samples";
import type { LabProduct } from "../_lib/products";
import { USAGE_LABEL } from "./ad-badges";

type Usage = z.infer<typeof AdUsage>;

const LABEL = "mb-1 block text-sm font-medium";
// shadcn select는 아직 설치되지 않아 기본 select를 같은 모양으로 쓴다 (components/ui는 공용 영역)
const SELECT = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";
// 좌(제목)·우(미리보기) 칸의 세로 길이를 같게 둔다. 내용이 길면 칸 안에서 스크롤한다
const PANEL_HEIGHT = "h-96";

type ContentGuideProps = {
  products: LabProduct[];
  drafts: GuideDraft[];
};

export function ContentGuide({ products, drafts }: ContentGuideProps) {
  const [productId, setProductId] = useState(products[0].id);
  const [usage, setUsage] = useState<Usage>("detail_page");
  const [platform, setPlatform] = useState<PlatformId>(PLATFORMS[0].id);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const product = products.find((p) => p.id === productId) ?? products[0];
  const list = drafts.filter((d) => d.usage === usage);
  const current = list.find((d) => d.id === selectedId) ?? list[0];
  const fill = (text: string) => fillProduct(text, product.name_ko);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div>
            <label htmlFor="guide-product" className={LABEL}>
              제품
            </label>
            <select id="guide-product" className={SELECT} value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_ko} ({p.line}
                  {p.launch_status === "developing" ? " · 개발 중" : ""})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="guide-usage" className={LABEL}>
              사용처
            </label>
            <select
              id="guide-usage"
              className={SELECT}
              value={usage}
              onChange={(e) => {
                setUsage(AdUsage.parse(e.target.value));
                setSelectedId(null);
              }}
            >
              {AdUsage.options.map((u) => (
                <option key={u} value={u}>
                  {USAGE_LABEL[u]}
                </option>
              ))}
            </select>
          </div>
          {usage === "detail_page" && (
            <div>
              <label htmlFor="guide-platform" className={LABEL}>
                플랫폼
              </label>
              <select
                id="guide-platform"
                className={SELECT}
                value={platform}
                onChange={(e) => setPlatform(PLATFORMS.find((p) => p.id === e.target.value)?.id ?? PLATFORMS[0].id)}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>제목</CardTitle>
          </CardHeader>
          <CardContent className={`${PANEL_HEIGHT} overflow-y-auto`}>
            <ol className="space-y-2">
              {list.map((d, i) => {
                const selected = d.id === current?.id;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedId(d.id)}
                      className={`w-full rounded-md border p-3 text-left text-sm hover:bg-muted ${selected ? "border-foreground bg-muted" : ""}`}
                    >
                      <span className="block font-medium" lang="ja">
                        {i + 1}. {d.title_ja}
                      </span>
                      <span className="mt-1 block text-muted-foreground">{d.title_ko}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>미리보기</CardTitle>
          </CardHeader>
          <CardContent className={`${PANEL_HEIGHT} overflow-y-auto`} role="region" aria-label="결과물 미리보기" tabIndex={0}>
            {current && (
              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  {USAGE_LABEL[usage]}
                  {usage === "detail_page" ? ` · ${PLATFORMS.find((p) => p.id === platform)?.label}` : ""}
                </p>
                <p className="whitespace-pre-line text-base leading-relaxed" lang="ja">
                  {fill(current.preview_ja)}
                </p>
                <p className="whitespace-pre-line text-muted-foreground">한국어: {fill(current.preview_ko)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {current && (
        <Card>
          <CardHeader>
            <CardTitle>본문</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ol className="space-y-3">
              {current.sections.map((s, i) => (
                <li key={s.heading} className="rounded-md border p-3">
                  <p className="font-semibold">
                    {current.sections.length > 1 ? `${i + 1}. ` : ""}
                    {s.heading}
                  </p>
                  <p className="mt-1" lang="ja">
                    {fill(s.text_ja)}
                  </p>
                  <p className="mt-1 text-muted-foreground">한국어: {fill(s.text_ko)}</p>
                </li>
              ))}
            </ol>
            <section className="rounded-md bg-muted p-3">
              <h3 className="mb-1 font-semibold">AI에 넣을 프롬프트 가이드</h3>
              <p className="whitespace-pre-line">{current.prompt_guide}</p>
            </section>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">준비 중</span>
        <Button type="button" disabled>
          PDF 출력
        </Button>
      </div>
    </div>
  );
}
