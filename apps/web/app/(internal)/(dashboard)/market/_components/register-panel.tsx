"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PLATFORMS } from "@/lib/platforms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Product } from "@/lib/schemas/product";
import { MARKET_CATEGORIES } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { ToggleGroup } from "@/app/(internal)/(dashboard)/market/_components/toggle-group";

// 경쟁제품 등록: URL 또는 이미지 → 추출 결과(샘플) → 사람이 고치는 폼 (TECH_STACK 13장 4번, prototype-plan P3)
// 실제 추출(POST /api/products/extract)은 아직 없어서 고정된 샘플 값을 보여준다. 추가한 제품은 저장되지 않는다.
const MODES = ["상품 URL", "상품 이미지"] as const;

const SAMPLE_EXTRACT = {
  brand: "SampleNew",
  name: "セラミドクリーム",
  category: "クリーム",
  platform: "qoo10",
  price: "2580",
  volume: "50",
  ingredients: "水、グリセリン、BG、セラミドNP、スクワラン、パンテノール、ヒアルロン酸Na、フェノキシエタノール",
  features: "세라마이드 배합\n50ml 튜브형",
};

const FIELD = "grid gap-1 text-xs font-medium text-muted-foreground";
const SELECT = "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground";

export function RegisterPanel({ onAdd, onClose, nextIndex }: { onAdd: (p: Product) => void; onClose: () => void; nextIndex: number }) {
  const [mode, setMode] = useState<(typeof MODES)[number]>("상품 URL");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [form, setForm] = useState<typeof SAMPLE_EXTRACT | null>(null);
  const [error, setError] = useState("");

  function extract() {
    if (mode === "상품 URL" && !/^https?:\/\/\S+\.\S+/.test(url.trim())) {
      setError("http:// 또는 https://로 시작하는 상품 페이지 주소를 넣어 주세요");
      return;
    }
    if (mode === "상품 이미지" && !fileName) {
      setError("상품 이미지를 골라 주세요");
      return;
    }
    setError("");
    setForm({ ...SAMPLE_EXTRACT });
  }

  function add() {
    if (!form) return;
    const parsed = Product.safeParse({
      id: `local-${nextIndex}`,
      workspace_id: "local",
      created_at: "2026-10-21T10:00:00+09:00",
      kind: "competitor",
      brand: form.brand.trim(),
      name: form.name.trim(),
      platform: form.platform,
      url: mode === "상품 URL" ? url.trim() : null,
      price_jpy: Number(form.price),
      volume_ml: Number(form.volume),
      ingredients: form.ingredients.split(/[、,]/).map((x) => x.trim()).filter(Boolean),
      features: form.features.split("\n").map((x) => x.trim()).filter(Boolean),
      image_path: mode === "상품 이미지" ? fileName : null,
      source_raw: { extracted_from: mode === "상품 URL" ? url.trim() : fileName, model: "샘플 (실제 추출 아님)" },
      price_kind: "regular",
      category: form.category,
    });
    if (!parsed.success || !form.brand.trim() || !form.name.trim() || !(Number(form.price) > 0) || !(Number(form.volume) > 0)) {
      setError("브랜드·제품명을 넣고, 가격과 용량은 0보다 큰 숫자로 넣어 주세요");
      return;
    }
    onAdd(parsed.data);
  }

  const set = (key: keyof typeof SAMPLE_EXTRACT) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => (f ? { ...f, [key]: e.target.value } : f));

  return (
    <Card>
      <CardHeader>
        <CardTitle>경쟁제품 등록</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ToggleGroup label="등록 방법" options={MODES} value={mode} onChange={setMode} />
        {mode === "상품 URL" ? (
          <label className={FIELD}>
            상품 페이지 URL
            <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.qoo10.jp/g/..." />
          </label>
        ) : (
          <label className={FIELD}>
            상품 이미지 (브라우저에서만 읽고 올리지 않아요)
            <Input type="file" accept="image/*" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} />
          </label>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <Button onClick={extract}>추출 실행</Button>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>

        {form && (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">
              추출 결과(샘플) <span className="text-xs font-normal text-muted-foreground">· AI 추출을 흉내 낸 고정 값이에요. 틀린 값은 고쳐서 추가하세요</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className={FIELD}>
                브랜드
                <Input value={form.brand} onChange={set("brand")} />
              </label>
              <label className={FIELD}>
                제품명
                <Input lang="ja" value={form.name} onChange={set("name")} />
              </label>
              <label className={FIELD}>
                카테고리
                <select className={SELECT} value={form.category} onChange={set("category")}>
                  {MARKET_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className={FIELD}>
                판매 플랫폼
                <select className={SELECT} value={form.platform} onChange={set("platform")}>
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={FIELD}>
                税込 정가 (円)
                <Input type="number" min={1} inputMode="numeric" value={form.price} onChange={set("price")} />
              </label>
              <label className={FIELD}>
                용량 (ml)
                <Input type="number" min={1} inputMode="numeric" value={form.volume} onChange={set("volume")} />
              </label>
              <label className={`${FIELD} col-span-2`}>
                全成分 (、로 구분) · 확인 필요
                <Textarea lang="ja" value={form.ingredients} onChange={set("ingredients")} />
              </label>
              <label className={`${FIELD} col-span-2`}>
                특징 (줄마다 하나)
                <Textarea value={form.features} onChange={set("features")} />
              </label>
            </div>
            <Button onClick={add}>비교 목록에 추가</Button>
            <p className="text-xs text-muted-foreground">추가한 제품은 이 화면에서만 보이고 저장되지 않아요</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
