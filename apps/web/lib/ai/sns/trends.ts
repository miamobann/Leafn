// SNS 영상 링크 → Apify로 영상 정보(캡션·해시태그·발화 자막) → AI가 소비자 핵심 니즈와 키워드 (callAi 대량 등급, JSON 스키마 출력).
// 순위는 AI가 아니라 서버가 원문에서 다시 센 영상 수 → 조회수 합으로 정한다
// 응답은 Zod로 검증하고 실패하면 1회 재시도 (CLAUDE.md 7장). 키워드·근거 문구는 영상 정보에 그대로 있어야 하고, 없으면 버린다
import { fold } from "@/lib/ai/appeal-normalize";
import { fetchTikTokPosts } from "@/lib/external/apify-tiktok";
import { parseTikTokLink } from "@/lib/external/tiktok";
import { SnsTrendAiOutput, type SnsTrendInput, type SnsTrendResult, type SnsVideoFacts } from "@/lib/schemas/market";
import { callAi } from "../client";
import { loadPrompt } from "../prompts";

const MAX_NEEDS = 5;
const MAX_KEYWORDS = 10;

function parseOutput(text: string): SnsTrendAiOutput | null {
  try {
    const checked = SnsTrendAiOutput.safeParse(JSON.parse(text));
    return checked.success ? checked.data : null;
  } catch {
    return null;
  }
}

const KANA = /[\u3040-\u30ff]/;
function mixesKana(o: SnsTrendAiOutput): boolean {
  return o.needs.some((n) => KANA.test(n.need_ko) || KANA.test(n.summary_ko) || n.keywords.some((k) => KANA.test(k.keyword_ko)));
}

/** 영상 하나에서 대조할 글 (캡션 + 해시태그 + 발화 자막 + 메모) */
function sourceText(v: SnsVideoFacts, memo: string): string {
  return fold([v.caption, v.hashtags.join(" "), v.transcript ?? "", memo].join("\n"));
}

export async function analyzeSnsTrends(input: SnsTrendInput): Promise<SnsTrendResult> {
  const urls = input.videos.map((v) => parseTikTokLink(v.url)?.url ?? v.url.trim());
  const posts = await fetchTikTokPosts(urls);
  const videos: SnsVideoFacts[] = posts.map((p, i) => ({
    index: i + 1,
    url: p.url,
    author: p.author,
    caption: p.caption,
    hashtags: p.hashtags,
    transcript: p.transcript,
    play_count: p.playCount,
    like_count: p.likeCount,
    save_count: p.saveCount,
    is_ad: p.isAd,
    posted_at: p.postedAt,
    error: p.error,
  }));
  const usable = videos.filter((v) => !v.error);
  if (usable.length < 2) throw new Error(`영상 정보를 ${usable.length}개만 가져왔어요. 공개된 TikTok 영상 링크를 2개 이상 넣어 주세요.`);

  const memoOf = (index: number) => input.videos[index - 1]?.memo ?? "";
  const texts = new Map(usable.map((v) => [v.index, sourceText(v, memoOf(v.index))]));

  const { text: system, version } = await loadPrompt("sns-trends", 1);
  const request = () =>
    callAi({
      grade: "bulk",
      system,
      user: JSON.stringify({
        category: input.category,
        videos: usable.map((v) => ({ video: v.index, caption: v.caption, hashtags: v.hashtags, transcript: v.transcript, memo: memoOf(v.index), views: v.play_count })),
      }),
      schema: { name: "sns_trends", zod: SnsTrendAiOutput },
    });
  // 형식이 틀리거나 한국어 칸에 일본어(가나)가 섞이면 1회 다시 묻는다 (「플チプ라」처럼 섞여 나온 적이 있다)
  let reply = await request();
  let output = parseOutput(reply.text);
  if (!output || mixesKana(output)) {
    const retry = await request();
    const second = parseOutput(retry.text);
    if (second && (!output || !mixesKana(second))) {
      reply = retry;
      output = second;
    }
  }
  if (!output) throw new Error("AI 응답이 형식에 맞지 않아요. 다시 시도해 주세요.");

  let dropped = 0;
  const views = (ids: number[]) => ids.reduce((sum, id) => sum + (videos[id - 1]?.play_count ?? 0), 0);
  const needs = output.needs.flatMap((n) => {
    // 키워드: 실제로 나온 영상을 원문에서 다시 센다. 어느 영상에도 없으면 버린다
    const seen = new Set<string>();
    const keywords = n.keywords.flatMap((k) => {
      const word = k.keyword_ja.replace(/^#/, "").trim();
      const key = fold(word);
      if (!word || seen.has(key)) return [];
      seen.add(key);
      const found = usable.filter((v) => texts.get(v.index)?.includes(key)).map((v) => v.index);
      if (found.length === 0) {
        dropped += 1;
        return [];
      }
      return [{ keyword_ja: word, keyword_ko: k.keyword_ko, videos: found }];
    });
    // 근거: 그 영상 원문에 그대로 있어야 한다 (영상마다 하나)
    const evidence = n.evidence.filter((e, i, all) => {
      const ok = e.quote_ja.trim().length > 0 && (texts.get(e.video)?.includes(fold(e.quote_ja)) ?? false);
      if (!ok) dropped += 1;
      return ok && all.findIndex((x) => x.video === e.video) === i;
    });
    const ids = [...new Set([...keywords.flatMap((k) => k.videos), ...evidence.map((e) => e.video)])].toSorted((a, b) => a - b);
    // 공통 니즈만: 영상 2개 이상에서 확인된 것
    if (keywords.length === 0 || ids.length < 2) return [];
    keywords.sort((a, b) => b.videos.length - a.videos.length);
    return [{ need_ko: n.need_ko, summary_ko: n.summary_ko, keywords, videos: ids, views: views(ids), evidence }];
  });
  needs.sort((a, b) => b.videos.length - a.videos.length || b.views - a.views);
  const top = needs.slice(0, MAX_NEEDS);
  const keywords = top
    .flatMap((n) => n.keywords.map((k) => ({ ...k, need_ko: n.need_ko })))
    .toSorted((a, b) => b.videos.length - a.videos.length || views(b.videos) - views(a.videos))
    .slice(0, MAX_KEYWORDS);

  return {
    category: input.category,
    videos,
    needs: top,
    keywords,
    dropped,
    model: reply.model,
    prompt_version: version,
    analyzed_at: new Date().toISOString(),
  };
}
