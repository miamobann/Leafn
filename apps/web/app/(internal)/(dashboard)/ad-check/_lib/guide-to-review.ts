// 만든 가이드 → 새 검토 입력칸 (실무자 비판 5번, 2026-10-25). 블록마다 첫 번째 안(가장 추천)을 한 줄씩.
// 콘텐츠 가이드 자동 검사(lib/ai/content-guide/check.ts)와 같은 기준으로 줄을 만든다.
import { MAX_LINES } from "@/lib/ai/ad-check/action";
import type { AdUsage } from "@/lib/schemas/ad-check";
import type { ContentChannel, ContentGuideRow } from "@/lib/schemas/content-guide";
import type { z } from "zod";

const USAGE: Record<ContentChannel, z.infer<typeof AdUsage>> = { qoo10_detail: "detail_page", instagram: "sns", x: "sns", banner: "banner" };

export function guideToReviewInput(guide: ContentGuideRow) {
  const lines = [guide.title.title_ja, ...guide.body.blocks.map((b) => b.options[0]?.text_ja ?? "")]
    // 판정은 한 줄 = 한 문구라서 여러 줄인 문구는 「 / 」로 잇는다
    .map((t) => t.trim().replace(/\n+/g, " / "))
    .filter(Boolean)
    .slice(0, MAX_LINES);
  return { productId: guide.product_id ?? undefined, usage: USAGE[guide.channel], text: lines.join("\n") };
}
