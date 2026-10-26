// 경쟁제품 등록 CSV 읽기 (브라우저에서 실행). 팀 Qoo10 수집 CSV의 열 이름을 그대로 받고, 간단한 한국어 양식 열 이름도 받는다.
// 읽기만 하고 저장은 lib/data/competitor-import-actions.ts가 한다
import Papa from "papaparse";
import { CompetitorImportRow } from "@/lib/schemas/product";
import { volumeFromName } from "./qoo10-ranking-csv";

/** 열 이름 후보 (앞에 있는 것부터 찾는다). 수집 CSV 열 이름이 바뀌면 여기에 더한다 */
const COLUMNS = {
  market: ["마켓", "플랫폼"],
  code: ["상품코드", "商品コード"],
  brand: ["브랜드", "ブランド"],
  name: ["상품명", "商品名", "제품명"],
  listPrice: ["정상가(정가)", "정가", "정상가"],
  salePrice: ["판매가(현재할인가)", "할인가", "판매가"],
  couponPrice: ["메가와리_쿠폰할인가", "쿠폰가"],
  volume: ["용량(ml)", "용량"],
  ingredients: ["전성분(全成分_일문)", "全成分", "전성분"],
  keyIngredients: ["핵심유효성분", "핵심 성분"],
  url: ["상품URL", "URL", "상품 URL"],
} as const;

/** 꼭 있어야 하는 열 (상품코드는 상품URL에서 찾을 수 있으면 없어도 된다) */
const REQUIRED: (keyof typeof COLUMNS)[] = ["brand", "name"];

export type CompetitorCsvResult = {
  rows: CompetitorImportRow[];
  /** 건너뛴 줄 (CSV의 줄 번호 = 머리글 다음이 2) */
  skipped: { line: number; reason: string }[];
  /** 파일 자체를 읽을 수 없을 때 */
  error: string | null;
};

/** "2,715 円 メガ割時" → 2715 */
function yen(text: string | undefined): number | null {
  const n = Number((text ?? "").split(/円|엔/)[0].replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Qoo10 상품 주소의 상품코드 (https://www.qoo10.jp/g/1234567890 · .../item/.../1234567890) */
function codeFromUrl(url: string): string | null {
  return url.match(/qoo10\.jp\/(?:g|gmkt\.inc\/goods\/goods\.aspx\?goodscode=)\/?(\d+)/i)?.[1] ?? url.match(/qoo10\.jp\/item\/[^/]+\/(\d+)/i)?.[1] ?? null;
}

function splitIngredients(text: string): string[] {
  return text
    .split(/[、,，]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function parseCompetitorCsv(text: string): CompetitorCsvResult {
  const { data, meta } = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: true });
  const headers = (meta.fields ?? []).map((h) => h.trim());
  const col = (key: keyof typeof COLUMNS) => COLUMNS[key].find((c) => headers.includes(c)) ?? null;

  const missing = REQUIRED.filter((k) => !col(k));
  if (missing.length > 0 || (!col("listPrice") && !col("salePrice")) || (!col("code") && !col("url"))) {
    const need = [...missing.map((k) => COLUMNS[k][0]), ...(!col("listPrice") && !col("salePrice") ? ["정상가(정가)"] : []), ...(!col("code") && !col("url") ? ["상품코드 또는 상품URL"] : [])];
    return { rows: [], skipped: [], error: `필요한 열이 없어요: ${need.join(", ")}` };
  }

  const rows: CompetitorImportRow[] = [];
  const skipped: CompetitorCsvResult["skipped"] = [];
  const seen = new Set<string>();
  data.forEach((r, i) => {
    const line = i + 2;
    const get = (key: keyof typeof COLUMNS) => {
      const c = col(key);
      return c ? (r[c] ?? "").trim() : "";
    };
    const market = get("market");
    if (market && !/qoo10/i.test(market)) return skipped.push({ line, reason: `Qoo10 상품만 등록해요 (${market})` });
    const url = get("url");
    const code = get("code").replace(/[^\d]/g, "") || codeFromUrl(url);
    if (!code) return skipped.push({ line, reason: "상품코드가 없어요" });
    if (seen.has(code)) return skipped.push({ line, reason: "같은 상품코드가 위에 있어요" });
    const name = get("name");
    const listPrice = yen(get("listPrice")) ?? yen(get("salePrice"));
    const salePrice = yen(get("salePrice"));
    const volumeText = Number(get("volume").replace(/[^\d.]/g, ""));
    const parsed = CompetitorImportRow.safeParse({
      external_id: code,
      brand: get("brand"),
      name,
      url: /^https?:\/\//.test(url) ? url : null,
      price_jpy: listPrice,
      // 할인가는 정가보다 쌀 때만 (같거나 비싸면 할인 아님)
      sale_price_jpy: salePrice !== null && listPrice !== null && salePrice < listPrice ? salePrice : null,
      coupon_price_jpy: yen(get("couponPrice")),
      volume_ml: volumeText > 0 ? volumeText : volumeFromName(name),
      ingredients: splitIngredients(get("ingredients")),
      key_ingredients_ko: get("keyIngredients") || null,
      raw: Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), String(v ?? "")])),
    });
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      const reason = field === "price_jpy" ? "가격이 없어요" : field === "brand" ? "브랜드가 없어요" : field === "name" ? "상품명이 없어요" : "형식이 맞지 않아요";
      return skipped.push({ line, reason });
    }
    seen.add(code);
    rows.push(parsed.data);
  });
  return { rows, skipped, error: rows.length === 0 && skipped.length === 0 ? "읽을 줄이 없어요" : null };
}

/** 팀 Qoo10 수집 CSV와 같은 열 (마켓 ~ 상품URL). 양식 내려받기에 쓴다 */
export const COMPETITOR_CSV_HEADERS = [
  "마켓", "순수_랭킹", "공식인증_여부", "브랜드", "판매자_샵명", "상품명", "상품코드", "판매가(현재할인가)", "정상가(정가)", "할인정보(인하폭)",
  "메가와리_쿠폰할인가", "메가와리_비고", "배송비", "핵심유효성분", "전성분(全成分_일문)", "전성분(국문번역)", "상품URL",
] as const;

/** 양식의 예시 한 줄 (가상 제품. 이 줄은 지우고 실제 값을 넣는다) */
const COMPETITOR_CSV_EXAMPLE: Record<(typeof COMPETITOR_CSV_HEADERS)[number], string> = {
  마켓: "Qoo10",
  순수_랭킹: "1위",
  공식인증_여부: "공식몰 [公式]",
  브랜드: "サンプルブランド",
  판매자_샵명: "サンプルブランド公式",
  상품명: "【公式】セラミド保湿トナー 200ml 化粧水 (예시 · 이 줄은 지우고 넣어 주세요)",
  상품코드: "1234567890",
  "판매가(현재할인가)": "2,590円",
  "정상가(정가)": "3,500円",
  "할인정보(인하폭)": "(910円 ↓)",
  메가와리_쿠폰할인가: "2,000 円 メガ割時",
  메가와리_비고: "메가와리/쿠폰 적용",
  배송비: "무료배송",
  핵심유효성분: "세라마이드NP, 판테놀, 히알루론산",
  "전성분(全成分_일문)": "水、BG、グリセリン、パンテノール、セラミドNP、ヒアルロン酸Na、EDTA-2Na",
  "전성분(국문번역)": "정제수, 부틸렌글라이콜, 글리세린, 판테놀, 세라마이드엔피, 소듐하이알루로네이트, 다이소듐이디티에이",
  상품URL: "https://www.qoo10.jp/item/-/1234567890",
};

/** 양식 CSV (머리글 + 예시 한 줄). 엑셀에서 한글이 깨지지 않게 앞에 BOM을 붙인다 */
export function competitorCsvTemplate(): string {
  return "\uFEFF" + Papa.unparse({ fields: [...COMPETITOR_CSV_HEADERS], data: [COMPETITOR_CSV_HEADERS.map((h) => COMPETITOR_CSV_EXAMPLE[h])] });
}
