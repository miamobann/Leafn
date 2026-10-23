// GEO 1회 실행: 카테고리 × 피부 고민 질의를 한 엔진에 repeatCount번씩 묻고, 브랜드·키워드·인용을 뽑는다
// 1차 사전 대조 → 2차 LLM 보조 추출(대량 등급) → 원문 대조(verifyInAnswer)를 통과한 것만 남긴다
import {
  brandDictionary,
  buildGeoQueries,
  canonicalBrand,
  canonicalKeyword,
  detectBrands,
  detectKeywords,
  domainOf,
  rankMentions,
  verifyInAnswer,
} from "@/lib/external/geo-terms";
import { GeoExtraction, type GeoEngine, type GeoSnap } from "@/lib/schemas/geo";
import { AiConfigError } from "../openai";
import { loadPrompt } from "../prompts";
import { structuredCall } from "../structured";
import { GEO_ENGINES } from "./engines";

const CONCURRENCY = 3;
const MAX_KEYWORD_LENGTH = 15;
/** 문장처럼 끝나는 말은 키워드가 아니다 (「肌を整えてくれます」 등) */
const SENTENCE_LIKE = /(ます|です|ください|ましょう|ません)$|[、。]/;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

type Analyzed = Pick<GeoSnap, "brand_mentions" | "brands_mentioned" | "keywords" | "prompt_version">;

/** 답변 하나 분석. LLM 보조 추출이 실패해도(키 없음 등) 사전 대조 결과는 남긴다 */
export async function analyzeAnswer(answer: string, category: string, dictionary: Record<string, string[]>): Promise<Analyzed> {
  const dictBrands = detectBrands(answer, dictionary);
  const dictKeywords = detectKeywords(answer, category);
  let llmBrands: { brand: string; matched_text: string; source: "llm" }[] = [];
  let llmKeywords: { keyword: string; matched_text: string; source: "llm" }[] = [];
  let promptVersion: string | null = null;

  try {
    const { text: system, version } = await loadPrompt("geo-extract", 2);
    const result = await structuredCall({
      tier: "bulk",
      system,
      user: JSON.stringify({ answer, known_brands: dictBrands.map((b) => b.brand), known_keywords: dictKeywords.map((k) => k.keyword) }),
      schema: GeoExtraction,
      name: "geo_extraction",
    });
    if (result) {
      promptVersion = version;
      const knownBrands = new Set(dictBrands.map((b) => b.brand));
      const knownKeywords = new Set(dictKeywords.map((k) => k.keyword));
      // 원문에 그대로 있는 것만 (할루시네이션 차단)
      llmBrands = result.data.brands
        .filter((b) => verifyInAnswer(answer, b.matched_text))
        .map((b) => {
          // 이름으로 못 찾으면 원문 표기로 사전을 한 번 더 찾는다 (TonyMoly·トニーモリー → TONYMOLY)
          const byName = canonicalBrand(b.name, dictionary);
          const brand = byName in dictionary ? byName : canonicalBrand(b.matched_text, dictionary);
          return { brand: brand in dictionary ? brand : b.name.trim(), matched_text: b.matched_text, source: "llm" as const };
        })
        .filter((b) => !knownBrands.has(b.brand) && knownBrands.add(b.brand));
      llmKeywords = result.data.keywords
        .filter((k) => k.matched_text.length <= MAX_KEYWORD_LENGTH && !SENTENCE_LIKE.test(k.matched_text.trim()) && verifyInAnswer(answer, k.matched_text))
        .map((k) => ({ keyword: canonicalKeyword(k.matched_text, category), matched_text: k.matched_text, source: "llm" as const }))
        .filter((k) => !knownKeywords.has(k.keyword) && knownKeywords.add(k.keyword));
    }
  } catch (e) {
    if (!(e instanceof AiConfigError)) throw e; // 키가 없으면 사전 대조만
  }

  const brand_mentions = rankMentions(answer, [...dictBrands, ...llmBrands]);
  return {
    brand_mentions,
    brands_mentioned: brand_mentions.map((m) => m.brand),
    keywords: [...dictKeywords, ...llmKeywords],
    prompt_version: promptVersion,
  };
}

export async function runGeo(opts: { engine: GeoEngine; category: string; repeatCount: number; ownBrand: string; competitorBrands: string[] }) {
  const adapter = GEO_ENGINES[opts.engine];
  if (!adapter.available()) throw new AiConfigError(`${opts.engine} 엔진의 API 키가 없어요. apps/web/.env.local을 확인해 주세요.`);

  const dictionary = brandDictionary(opts.ownBrand, opts.competitorBrands);
  const queries = buildGeoQueries(opts.category);
  const tasks = queries.flatMap((q) => Array.from({ length: opts.repeatCount }, (_, i) => ({ ...q, run_index: i + 1 })));
  const capturedAt = new Date().toISOString();
  const failures: { query: string; run_index: number; error: string }[] = [];

  const results = await mapLimit(tasks, CONCURRENCY, async (t): Promise<GeoSnap | null> => {
    try {
      const { answer, citations } = await adapter.ask(t.query);
      const analyzed = await analyzeAnswer(answer, opts.category, dictionary);
      return {
        engine: opts.engine,
        model: adapter.model,
        category: opts.category,
        query: t.query,
        query_concern: t.concern,
        run_index: t.run_index,
        answer,
        citations: citations.map((c) => ({ url: c.url, domain: domainOf(c.url), title: c.title })),
        captured_at: capturedAt,
        ...analyzed,
      };
    } catch (e) {
      if (e instanceof AiConfigError) throw e; // 설정 문제는 전체를 멈춘다
      failures.push({ query: t.query, run_index: t.run_index, error: e instanceof Error ? e.message : "알 수 없는 오류" });
      return null; // 한 질의가 실패해도 나머지는 계속
    }
  });

  return { snapshots: results.filter((r): r is GeoSnap => r !== null), failures };
}
