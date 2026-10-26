// 만든 가이드 → 새 검토 입력칸 (실무자 비판 5번, 2026-10-25). 블록마다 첫 번째 안(가장 추천)을 한 줄씩.
// 콘텐츠 가이드 자동 검사(lib/ai/content-guide/check.ts)와 같은 기준으로 줄을 만든다.
// 새 검토 → 「가이드에 반영」(2026-10-26)도 같은 줄 순서로 고친 문구를 블록에 되돌린다 (app/api/content-guide/[guideId]/revise).
import { MAX_LINES } from "@/lib/ai/ad-check/action";
import type { AdUsage } from "@/lib/schemas/ad-check";
import type { ContentChannel, ContentGuideRow } from "@/lib/schemas/content-guide";
import { buildWarnings } from "./guide-warnings";
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
export function guideSlots(guide: Pick<ContentGuideRow, "title" | "body">, fill: Fill = asIs, only?: Set<string>): GuideSlot[] {
  return [{ key: TITLE_SLOT, text: fill(guide.title.title_ja) }, ...guide.body.blocks.map((b) => ({ key: b.key, text: fill(b.options[0]?.text_ja ?? "") }))]
    .map((s) => ({ key: s.key, text: s.text.trim().replace(/\n+/g, LINE_JOIN) }))
    .filter((s) => s.text && (!only || only.has(s.key)))
    .slice(0, MAX_LINES);
}

/** 가이드에서 걸린 칸 (금지어 검사 · 자동 약기법 판정이 「문제 없음」이 아닌 제목 · 블록). 새 검토에는 이 칸만 넘긴다 (2026-10-27).
 *  해시태그는 블록이 아니라 「가이드에 반영」으로 되돌릴 수 없어 넣지 않는다 (새 검토 화면에 주의만 보여 준다) */
export function flaggedKeys(lintHits: { key: string; text: string; reason: string }[], checks: { key: string; action: string; findings: { text: string }[] }[]): Set<string> {
  return new Set(Object.keys(buildWarnings(lintHits, checks)).filter((k) => k !== "hashtags"));
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

type GuideLike = Pick<ContentGuideRow, "id" | "product_id" | "title" | "body" | "created_at">;
const joined = (slots: GuideSlot[]) => slots.map((s) => s.text).join("\n");
type CheckLike = { content_guide_id?: string | null; product_id?: string; input_text: string; created_at: string };

const sameText = (a: string, b: string) => a.split("\n").map((l) => l.trim()).join("\n") === b.split("\n").map((l) => l.trim()).join("\n");

/** 이 검토가 어느 만든 가이드에서 왔는지. 연결 칸(content_guide_id)이 있으면 그것, 없으면(연결 기능 전에 만든 검토 · DB 적용 전)
 *  같은 제품 가이드 중 「이 문구로 새 검토」가 채운 입력과 문구가 똑같은 것 (자리표시자를 채운 문구 · 채우기 전 문구 둘 다 비교, 가장 최근 것) */
export function findSourceGuide<G extends GuideLike>(
  check: CheckLike,
  guides: G[],
  fillFor: (productId: string | null) => Fill | undefined,
  /** 가이드의 걸린 칸 (새 검토에 걸린 칸만 넘긴 경우도 찾는다) */
  flaggedOf: (guide: G) => Set<string> | undefined = () => undefined,
): G | undefined {
  if (check.content_guide_id) return guides.find((g) => g.id === check.content_guide_id);
  return guides
    .filter((g) => (!check.product_id || g.product_id === check.product_id) && g.created_at <= check.created_at)
    .filter((g) => {
      const fill = fillFor(g.product_id);
      const flagged = flaggedOf(g);
      const candidates = [guideSlots(g), ...(fill ? [guideSlots(g, fill)] : []), ...(flagged?.size ? [guideSlots(g, asIs, flagged), ...(fill ? [guideSlots(g, fill, flagged)] : [])] : [])];
      return candidates.some((slots) => slots.length > 0 && sameText(joined(slots), check.input_text));
    })
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

/** 새 검토 입력칸. only 를 주면 그 칸(걸린 칸)만 */
export function guideToReviewInput(guide: ContentGuideRow, fill: Fill = asIs, only?: Set<string>) {
  return { productId: guide.product_id ?? undefined, usage: USAGE[guide.channel], text: joined(guideSlots(guide, fill, only)) };
}
