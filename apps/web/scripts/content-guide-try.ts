// 콘텐츠 제작 가이드 AI 시험 (로컬 전용, PR에 넣지 않는다). 실제 OpenAI 키로 1건 돌려 토큰·비용·결과를 본다.
// 실행 (apps/web 에서): npx tsx --env-file=.env.local scripts/content-guide-try.ts [채널] [--check]
//   채널: qoo10_detail(기본) | instagram | x | banner   mega_sale: 메가와리 게시물(캘린더 일정 연결)   --check: 만든 문구를 약기법 판정에도 통과 (비용 늘어남)
import { checkBody } from "@/lib/ai/content-guide/check";
import { generateBody, generateTitles } from "@/lib/ai/content-guide/generate";
import type { AiUsage } from "@/lib/ai/client";
import { pickMegaSale, pickReviewQuotes } from "@/lib/ai/content-guide/materials";
import { getAppealComparison, getPromoEvents } from "@/lib/data";
import { ContentChannel, type ContentGuideInput } from "@/lib/schemas/content-guide";

// gpt-4.1-mini 기준 가격 (100만 토큰당 달러). 바뀔 수 있으니 실제 청구서로 확인
const PRICE = { input: 0.4, cached: 0.1, output: 1.6 };
const cost = (u: AiUsage) => ((u.input - u.cached) * PRICE.input + u.cached * PRICE.cached + u.output * PRICE.output) / 1_000_000;
const show = (label: string, u: AiUsage) => console.log(`${label}: 입력 ${u.input} (캐시 ${u.cached}) · 출력 ${u.output} · 약 $${cost(u).toFixed(4)}`);

const channel = ContentChannel.parse(process.argv.find((a) => ContentChannel.options.includes(a as never)) ?? "qoo10_detail");
const withCheck = process.argv.includes("--check");

const input: ContentGuideInput = {
  product: {
    name: "Leaf& Dew Deep Skin",
    name_ja: "リーフ＆デュー ディープスキン",
    kind: "스킨(化粧水)",
    category: "general_cosmetic",
    launch_status: "live",
    volume: "200ml",
    price_jpy: 2480,
    ingredients_ja: ["ヒアルロン酸Na", "グリセリン", "パンテノール", "水", "BG", "ベタイン"],
    line_products: ["リーフ＆デュー コアエッセンス"],
  },
  appeals: { praised: ["오래가는 보습", "산뜻한 흡수", "순함"], competitor_complaints: ["끈적임", "향이 강함"], candidates: ["산뜻한 흡수"] },
  keywords: { search: ["韓国 化粧水 おすすめ", "韓国 化粧水 ドラッグストア"], ingredients: ["ヒアルロン酸"] },
  review_quotes: [], // main()에서 리뷰 분석 데이터(가짜)로 채운다
  evidence: [],
  promo: null,
  channel,
  post_type: "general",
  season: null,
  slide_count: 5,
  sponsored: false,
  direction: "",
};

async function main() {
  input.review_quotes = pickReviewQuotes((await getAppealComparison("p-own-1"))?.topics ?? []);
  if (process.argv.includes("mega_sale")) {
    input.post_type = "mega_sale";
    input.promo = pickMegaSale(await getPromoEvents(), "2026-10-24");
  }
  console.log(`리뷰 원문: ${input.review_quotes.join(" | ") || "없음"}`);
  console.log(`행사: ${input.promo ?? "없음"}`);
  const titles = await generateTitles(input);
  show("① 제목", titles.usage);
  titles.result.titles.forEach((t, i) => console.log(`  ${i + 1}. ${t.recommended ? "[추천] " : ""}${t.title_ja}  (${t.title_ko})`));

  const picked = titles.result.titles[0]!;
  const body = await generateBody(input, picked);
  show("② 본문", body.usage);
  body.result.blocks.forEach((b) => console.log(`  - ${b.key} · ${b.heading}: ${b.options[0]?.text_ja.replace(/\n/g, " / ").slice(0, b.key === "review" ? 200 : 60)}`));
  console.log(`  금지어: ${body.lintHits.length ? body.lintHits.map((h) => `${h.key} 「${h.text}」 ${h.reason}`).join(" · ") : "없음"}`);
  console.log(`  해시태그: ${[...body.result.hashtags.brand, ...body.result.hashtags.ingredient, ...body.result.hashtags.trend].join(" ")}`);

  let total = [titles.usage, body.usage];
  if (withCheck) {
    const checked = await checkBody(channel, { name: input.product.name, product_category: "general_cosmetic", ingredients: input.product.ingredients_ja }, body.result);
    show("③ 판정", checked.usage);
    checked.blocks.forEach((c) => console.log(`  - ${c.key}: ${c.line.action}${c.line.findings.length ? ` (${c.line.findings.map((f) => f.text).join(", ")})` : ""}`));
    total = [...total, checked.usage];
  }
  const sum = total.reduce((a, u) => ({ input: a.input + u.input, cached: a.cached + u.cached, output: a.output + u.output }), { input: 0, cached: 0, output: 0 });
  show("합계", sum);
  console.log(`모델 ${body.model} · 프롬프트 ${body.promptVersion}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "실패");
  process.exit(1);
});
