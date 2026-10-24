// Qoo10 랭킹 수집 CSV(팀원 크롤러 결과) → 랭킹 항목. 순수 함수라 브라우저·서버 어디서나 쓴다.
// CSV 열: 마켓, 순수_랭킹, 공식인증_여부, 브랜드, 판매자_샵명, 상품명, 상품코드, 판매가(현재할인가), 정상가(정가), 할인정보(인하폭),
//        메가와리_쿠폰할인가, 메가와리_비고, 배송비, 핵심유효성분, 전성분(全成分_일문), 전성분(국문번역), 상품URL
import Papa from "papaparse";
import type { RankingItem } from "@/lib/schemas/trend";

/** 브랜드 국적은 CSV에 없어 사전으로 정한다. 여기 있는 브랜드만 K-뷰티가 아니다 (일본 브랜드) */
const NON_KBEAUTY_BRANDS = new Set(["トゥヴェール"]);

/** "2,590円" · "2,715 円" → 2590 */
function yen(text: string | undefined): number | null {
  const digits = (text ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

/**
 * 상품명에서 용량(ml)을 찾는다. 서로 다른 제품을 묶은 세트(「3点セット」, 용량이 여러 개)는 ml당 가격이 의미가 없어 null
 */
export function volumeFromName(name: string): number | null {
  const values = [...name.matchAll(/(\d+(?:\.\d+)?)\s*m[lL]/g)].map((m) => Number(m[1]));
  const isSet = /セット|点|個|種/.test(name);
  if (values.length === 0 || isSet) return null;
  return new Set(values).size === 1 ? values[0] : null;
}

export type Qoo10CsvRow = Record<string, string>;

/** "2,715 円 メガ+ショップ割時" → "メガ割クーポン適用 2,715円 (メガ+ショップ割時)" */
function couponText(coupon: string): string {
  const price = yen(coupon.split("円")[0]);
  const note = coupon.split("円").slice(1).join("円").trim();
  return `メガ割クーポン適用 ${price?.toLocaleString("ja-JP") ?? "?"}円${note ? ` (${note})` : ""}`;
}

export function parseQoo10RankingCsv(text: string): RankingItem[] {
  const { data } = Papa.parse<Qoo10CsvRow>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: true });
  return data.flatMap((r) => {
    const rank = Number((r["순수_랭킹"] ?? "").replace(/[^\d]/g, ""));
    const list = yen(r["정상가(정가)"]);
    const sale = yen(r["판매가(현재할인가)"]);
    if (!rank || list === null) return [];
    const discounted = sale !== null && sale < list;
    const name = (r["상품명"] ?? "").trim();
    const coupon = (r["메가와리_쿠폰할인가"] ?? "").trim();
    const isSet = /セット/.test(name);
    const url = (r["상품URL"] ?? "").trim();
    // 프로모션: 메가와리 쿠폰가가 있으면 그 문구, 없으면 세트 판매, 둘 다 아니면 할인만 (할인율로 따로 본다)
    const promo: Pick<RankingItem, "promo_type" | "promo_text"> = coupon
      ? { promo_type: "discount", promo_text: couponText(coupon) }
      : isSet
        ? { promo_type: "bundle", promo_text: "セット販売" }
        : { promo_type: null, promo_text: null };
    return [
      {
        rank,
        name,
        brand: (r["브랜드"] ?? "").trim(),
        price_jpy: list,
        review_count: null,
        is_kbeauty: !NON_KBEAUTY_BRANDS.has((r["브랜드"] ?? "").trim()),
        product_id: null,
        description_ja: "",
        volume_ml: volumeFromName(name),
        rating: null,
        ...promo,
        badges: (r["공식인증_여부"] ?? "").includes("公式") ? ["公式ショップ"] : [],
        discount_rate: discounted ? Math.round((1 - (sale as number) / list) * 100) : null,
        sale_price_jpy: discounted ? sale : null,
        url: url.startsWith("http") ? url : null,
        key_ingredients_ko: (r["핵심유효성분"] ?? "").trim() || null,
      },
    ];
  });
}
