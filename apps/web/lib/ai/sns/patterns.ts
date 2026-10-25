// SNS 영상 메모 → 공통 패턴 (callAi 대량 등급, JSON 스키마 출력).
// 응답은 Zod로 검증하고 실패하면 1회 재시도 (CLAUDE.md 7장). 근거 문구는 그 영상 메모에 그대로 있어야 하고, 없으면 버린다
import { fold } from "@/lib/ai/appeal-normalize";
import { parseTikTokLink } from "@/lib/external/tiktok";
import { SnsPatternAiOutput, type SnsAnalyzeInput, type SnsAnalyzeResult } from "@/lib/schemas/market";
import { callAi } from "../client";
import { loadPrompt } from "../prompts";

function parseOutput(text: string): SnsPatternAiOutput | null {
  try {
    const checked = SnsPatternAiOutput.safeParse(JSON.parse(text));
    return checked.success ? checked.data : null;
  } catch {
    return null;
  }
}

export async function analyzeSnsPatterns(input: SnsAnalyzeInput): Promise<SnsAnalyzeResult> {
  const { text: system, version } = await loadPrompt("sns-patterns", 1);
  const videos = input.videos.map((v, i) => {
    const link = parseTikTokLink(v.url);
    return { index: i + 1, url: link?.url ?? v.url, author: link?.author ?? "", kind: link?.kind ?? ("video" as const), memo: v.memo };
  });
  const request = () =>
    callAi({
      grade: "bulk",
      system,
      user: JSON.stringify({ category: input.category, videos: videos.map((v) => ({ video: v.index, memo: v.memo })) }),
      schema: { name: "sns_patterns", zod: SnsPatternAiOutput },
    });
  let reply = await request();
  let output = parseOutput(reply.text);
  if (!output) {
    reply = await request();
    output = parseOutput(reply.text);
  }
  if (!output) throw new Error("AI 응답이 형식에 맞지 않아요. 다시 시도해 주세요.");

  // 근거 대조: 근거 문구가 그 영상 메모에 그대로 있어야 한다 (전각·반각·공백 차이는 무시)
  let dropped = 0;
  const patterns = output.patterns.flatMap((p) => {
    const evidence = p.evidence.filter((e) => {
      const memo = videos.find((v) => v.index === e.video)?.memo ?? "";
      const ok = e.quote_ja.trim().length > 0 && fold(memo).includes(fold(e.quote_ja));
      if (!ok) dropped += 1;
      return ok;
    });
    // 같은 영상을 두 번 센 근거는 하나로, 공통 패턴이라 영상이 2개 이상이어야 한다
    const unique = evidence.filter((e, i) => evidence.findIndex((x) => x.video === e.video) === i);
    return unique.length >= 2 ? [{ ...p, evidence: unique }] : [];
  });

  return {
    category: input.category,
    videos: videos.map((v) => ({ index: v.index, url: v.url, author: v.author, kind: v.kind })),
    patterns,
    dropped,
    model: reply.model,
    prompt_version: version,
    analyzed_at: new Date().toISOString(),
  };
}
