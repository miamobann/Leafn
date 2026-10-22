import { MAX_LINES } from "../_lib/judge";
import { USAGES, type Product, type Usage } from "../_lib/types";

const LABEL = "mb-1 block text-sm font-medium";
const FIELD = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const INGREDIENT_PREVIEW = 4;

type ReviewFormProps = {
  products: Product[];
  productId: string;
  onProductChange: (id: string) => void;
  usage: Usage;
  onUsageChange: (usage: Usage) => void;
  text: string;
  onTextChange: (text: string) => void;
  lineCount: number;
  busy: boolean;
  onLoadSamples: () => void;
  onSubmit: () => void;
  onClear: () => void;
};

export function ReviewForm(props: ReviewFormProps) {
  const { products, productId, usage, text, lineCount, busy } = props;
  const product = products.find((p) => p.id === productId) ?? products[0];
  const rest = product.ingredients.length - INGREDIENT_PREVIEW;

  return (
    <form
      // 결과가 길어도 입력 패널이 보이도록 면책 배너 아래에 고정한다
      className="sticky top-20 flex max-h-[calc(100vh-10rem)] flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-background p-4"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
    >
      <div>
        <label htmlFor="ad-product" className={LABEL}>
          제품
        </label>
        <select
          id="ad-product"
          className={FIELD}
          value={productId}
          onChange={(e) => props.onProductChange(e.target.value)}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nameKo} ({p.line}{p.launchStatus === "개발 중" ? " · 개발 중" : ""})
            </option>
          ))}
        </select>
        <dl className="mt-2 grid grid-cols-[5rem_1fr] gap-x-2 gap-y-1 text-xs text-muted">
          <dt>제품 구분</dt>
          <dd>{product.category === "미정" ? "미정 (一般化粧品 / 医薬部外品 확인 필요)" : product.category}</dd>
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
          사용처
        </label>
        <select
          id="ad-usage"
          className={FIELD}
          value={usage}
          onChange={(e) => props.onUsageChange(e.target.value as Usage)}
        >
          {USAGES.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="ad-text" className={LABEL}>
          광고 문구 <span className="font-normal text-muted">(한 줄 = 한 문구, 한국어·일본어 자동 감지)</span>
        </label>
        <textarea
          id="ad-text"
          className={`${FIELD} min-h-48 leading-relaxed`}
          value={text}
          placeholder={"예) 히알루론산과 글리세린으로 피부를 촉촉하게 가꿔주는 데일리 스킨\n단 3일 만에 손상된 피부 장벽을 완벽하게 복구합니다"}
          onChange={(e) => props.onTextChange(e.target.value)}
        />
        <p className={`mt-1 text-xs ${lineCount > MAX_LINES ? "text-red-800" : "text-muted"}`}>
          {lineCount}줄 / 최대 {MAX_LINES}줄{lineCount > MAX_LINES ? ` — ${MAX_LINES}줄까지만 검토합니다` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || lineCount === 0}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
        >
          검토 요청
        </button>
        <button
          type="button"
          onClick={props.onLoadSamples}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-sidebar"
        >
          이 제품의 샘플 문구 불러오기
        </button>
        <button
          type="button"
          onClick={props.onClear}
          className="rounded-md px-4 py-2 text-sm text-muted hover:bg-sidebar"
        >
          지우기
        </button>
      </div>
    </form>
  );
}
