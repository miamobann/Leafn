// 만든 가이드 → 새 검토 입력칸 (실무자 비판 5번, 2026-10-25). 블록마다 첫 번째 안(가장 추천)을 한 줄씩.
// 콘텐츠 가이드 자동 검사(lib/ai/content-guide/check.ts)와 같은 기준으로 줄을 만든다.
// 새 검토 → 「가이드에 반영」(2026-10-26)도 같은 줄 순서로 고친 문구를 블록에 되돌린다 (app/api/content-guide/[guideId]/revise).
import { MAX_LINES } from "@/lib/ai/ad-check/action";
import type { AdUsage } from "@/lib/schemas/ad-check";
import type { ContentChannel, ContentGuideRow } from "@/lib/schemas/content-guide";
import type { z } from "zod";

const USAGE: Record<ContentChannel, z.infer<typeof AdUsage>> = { qoo10_detail: "detail_page", instagram: "sns", x: "sns", banner: "banner" };

/** 제목 줄의 key (블록 key 와 겹치지 않는다) */
export const TITLE_SLOT = "title";
/** 판정은 한 줄 = 한 문구라서 여러 줄인 문구는 「 / 」로 잇는다. 반영할 때는 다시 줄바꿈으로 */
const LINE_JOIN = " / ";

export type GuideSlot = { key: string; text: string };
type Fill = (text: string) => string;
const asIs: Fill = (t) => t;

/** 새 검토의 n번째 줄이 가이드의 어느 칸(제목 · 블록)인지. 빈 칸은 건너뛴다.
 *  fill: {product_ja} 같은 자리표시자를 실제 값으로 (화면 · PDF 와 같은 makeFill). 실제로 게시될 문장으로 검토한다 */
export function guideSlots(guide: Pick<ContentGuideRow, "title" | "body">, fill: Fill = asIs): GuideSlot[] {
  return [{ key: TITLE_SLOT, text: fill(guide.title.title_ja) }, ...guide.body.blocks.map((b) => ({ key: b.key, text: fill(b.options[0]?.text_ja ?? "") }))]
    .map((s) => ({ key: s.key, text: s.text.trim().replace(/\n+/g, LINE_JOIN) }))
    .filter((s) => s.text)
    .slice(0, MAX_LINES);
}

/** 판정한 한 줄을 가이드 칸의 문구로 되돌린다 */
export function slotText(line: string): string {
  return line.split(LINE_JOIN).join("\n");
}

/** 검토 → 「가이드에 반영」을 지금 할 수 있는지.
 *  reflected: 이 검토로 이미 수정본을 만들었다 (두 번 만들지 않는다) · stale: 그 사이 가이드에 더 새 수정본이 생겼다 (버전이 갈라지지 않게 최신에서 다시 검토) */
export type GuideReflectState = { kind: "ready" } | { kind: "reflected"; revisionId: string } | { kind: "stale"; latestId: string };

type GuideLink = Pick<ContentGuideRow, "id" | "parent_id" | "ad_check_id" | "created_at">;

export function guideReflectState(guides: GuideLink[], guideId: string, checkId: string): GuideReflectState {
  const reflected = guides.find((g) => g.parent_id && g.ad_check_id === checkId);
  if (reflected) return { kind: "reflected", revisionId: reflected.id };
  // 이 가이드의 다음 버전을 따라가 가장 새 수정본을 찾는다
  let latest = guideId;
  for (let i = 0; i < guides.length; i++) {
    const next = guides.filter((g) => g.parent_id === latest).toSorted((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!next) break;
    latest = next.id;
  }
  return latest === guideId ? { kind: "ready" } : { kind: "stale", latestId: latest };
}

export function guideToReviewInput(guide: ContentGuideRow, fill: Fill = asIs) {
  return { productId: guide.product_id ?? undefined, usage: USAGE[guide.channel], text: guideSlots(guide, fill).map((s) => s.text).join("\n") };
}
