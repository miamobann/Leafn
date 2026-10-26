import { useState } from "react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AdUsage } from "@/lib/schemas/ad-check";
import { MAX_LINES } from "../_lib/lines";
import type { LabProduct } from "../_lib/products";

const LABEL = "mb-1 block text-sm font-medium";
// shadcn select는 아직 설치되지 않아 기본 select를 같은 모양으로 쓴다 (components/ui는 공용 영역)
const SELECT = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";
const INGREDIENT_PREVIEW = 4;
const CATEGORY_LABEL = { general_cosmetic: "一般化粧品", quasi_drug: "医薬部外品" } as const;

type Usage = z.infer<typeof AdUsage>;
// 용도 고르기 (2026-10-27 TAB 3): 인스타그램 · X(엑스)는 둘 다 DB에 sns 로 저장한다 (마이그레이션 없이 화면에서만 나눔)
const USAGE_CHOICES: { value: string; usage: Usage; label: string }[] = [
  { value: "detail_page", usage: "detail_page", label: "상세페이지(큐텐)" },
  { value: "instagram", usage: "sns", label: "인스타그램" },
  { value: "x", usage: "sns", label: "X(엑스)" },
  { value: "banner", usage: "banner", label: "배너" },
  { value: "survey_result", usage: "survey_result", label: "설문조사" },
  { value: "notify_button", usage: "notify_button", label: "알림받기" },
];

type ReviewFormProps = {
  products: LabProduct[];
  productId: string;
  onProductChange: (id: string) => void;
  usage: Usage;
  onUsageChange: (usage: Usage) => void;
  text: string;
  onTextChange: (text: string) => void;
  lineCount: number;
  busy: boolean;
  onSubmit: () => void;
  onClear: () => void;
};

export function ReviewForm(props: ReviewFormProps) {
  const { products, productId, usage, text, lineCount, busy } = props;
  const product = products.find((p) => p.id === productId) ?? products[0];
  const rest = product.ingredients.length - INGREDIENT_PREVIEW;
  // 저장된 SNS 검토를 다시 열면 인스타인지 X인지 모르므로 「SNS」로 보인다. 인스타그램 · X 를 고르면 그 이름으로
  const [snsPick, setSnsPick] = useState<string | null>(null);
  const choice = usage === "sns" ? (snsPick ?? "sns") : usage;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
    >
      <div>
        <label htmlFor="ad-product" className={LABEL}>
          제품
        </label>
        <select id="ad-product" className={SELECT} value={productId} onChange={(e) => props.onProductChange(e.target.value)}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name_ko} ({p.line}
              {p.launch_status === "developing" ? " · 개발 중" : ""})
            </option>
          ))}
        </select>
        <dl className="mt-2 grid grid-cols-[5rem_1fr] gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <dt>제품 구분</dt>
          <dd>{product.product_category ? CATEGORY_LABEL[product.product_category] : "미정 (一般化粧品 / 医薬部外品 확인 필요)"}</dd>
          <dt>용기</dt>
          <dd>{product.container}</dd>
          <dt>전성분</dt>
          <dd>
            <details>
              <summary className="cursor-pointer">
                {product.ingredients
                  .slice(0, INGREDIENT_PREVIEW)
                  .map((i) => i.ko)
                  .join(", ")}
                {rest > 0 ? ` 외 ${rest}개` : ""}
              </summary>
              <ul className="mt-1">
                {product.ingredients.map((i) => (
                  <li key={i.inci}>
                    {i.ko} · {i.inci} · <span lang="ja">{i.ja}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1">일본어 표시명은 가칭 (확인 전)</p>
            </details>
          </dd>
        </dl>
      </div>

      <div>
        <label htmlFor="ad-usage" className={LABEL}>
          용도
        </label>
        <select
          id="ad-usage"
          className={SELECT}
          value={choice}
          onChange={(e) => {
            const picked = USAGE_CHOICES.find((c) => c.value === e.target.value);
            if (!picked) return;
            if (picked.usage === "sns") setSnsPick(picked.value);
            props.onUsageChange(picked.usage);
          }}
        >
          {choice === "sns" && <option value="sns">SNS (인스타그램 · X)</option>}
          {USAGE_CHOICES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="ad-text" className={LABEL}>
          광고 문구 <span className="font-normal text-muted-foreground">(한 줄 = 한 문구, 한국어·일본어 자동 감지)</span>
        </label>
        <Textarea
          id="ad-text"
          rows={8}
          value={text}
          placeholder={"예) 히알루론산과 글리세린으로 피부를 촉촉하게 가꿔주는 데일리 스킨\n단 3일 만에 손상된 피부 장벽을 완벽하게 복구합니다"}
          onChange={(e) => props.onTextChange(e.target.value)}
        />
        <p className={`mt-1 text-xs ${lineCount > MAX_LINES ? "text-destructive" : "text-muted-foreground"}`}>
          {lineCount}줄 / 최대 {MAX_LINES}줄{lineCount > MAX_LINES ? ` — ${MAX_LINES}줄까지만 검토합니다` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || lineCount === 0}>
          {busy ? "판정 중…" : "검토 요청"}
        </Button>
        <Button type="button" variant="ghost" onClick={props.onClear}>
          지우기
        </Button>
      </div>
    </form>
  );
}
