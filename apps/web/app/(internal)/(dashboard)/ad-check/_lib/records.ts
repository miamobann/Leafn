// 「검토 기록」 탭 재료 (서버 전용, 2026-10-27 TAB 3 흐름 개편): 만든 콘텐츠가 위, 그 콘텐츠에서 나온 문구 검토는 그 아래에 묶는다.
// 콘텐츠 가이드에서 오지 않은 검토는 「문구 검토」 줄로 같은 목록에 둔다. 리뷰 번역 검토는 리뷰 분석 탭(상세페이지용 리뷰)에서 다루므로 빼고 돌려준다.
// 결재는 콘텐츠 가이드 단위로 올린다. 「결재 승인」은 최신 버전이 콘텐츠 가이드 결재로 승인됐을 때만이고, 예전 승인(검토 한 건의 결재 · 내부 검토 완료)은 세지 않는다 (2026-10-27, 결재 연결 2026-10-26 A안).
import { getAdChecks, getContentGuideChecks, getContentGuides, getReviewTranslationCheckIds } from "@/lib/data";
import { getAdProducts } from "@/lib/data/ad-products";
import { getApprovedGuideIds } from "@/lib/data/submissions";
import type { AdAction, AdCheck } from "@/lib/schemas/ad-check";
import type { ContentGuideRow } from "@/lib/schemas/content-guide";
import { makeFill } from "./guide-report";
import { findSourceGuide, flaggedKeys } from "./guide-to-review";

/** 가장 무거운 판정 (고쳐야 함 > 전문가 확인 > 수정 권장 > 문제 없음). 판정이 없으면 null */
const ACTION_WEIGHT: Record<AdAction, number> = { must_fix: 3, expert: 2, should_fix: 1, ok: 0 };
export function worstAction(actions: AdAction[]): AdAction | null {
  return actions.reduce<AdAction | null>((worst, a) => (worst === null || ACTION_WEIGHT[a] > ACTION_WEIGHT[worst] ? a : worst), null);
}

export type ContentStatus = "needs_fix" | "before_approval" | "approved";
export const CONTENT_STATUS: Record<ContentStatus, { label: string; tone: string; hint: string }> = {
  needs_fix: { label: "수정 필요", tone: "border-risk-high/40 text-risk-high", hint: "「고쳐야 함」이나 「전문가 확인」이 남았어요. 걸린 문구를 문구 검토로 고쳐 가이드에 반영해 주세요" },
  before_approval: { label: "결재 전", tone: "text-muted-foreground", hint: "고칠 곳이 없어요. 콘텐츠 가이드 상세 아래에서 결재에 올려요" },
  approved: { label: "결재 승인", tone: "border-risk-low/50 text-risk-low", hint: "팀장이 결재함에서 이 콘텐츠 가이드를 승인했어요 (법적 승인은 아니에요)" },
};

export type PhraseCheck = { check: AdCheck; /** 이 검토로 콘텐츠를 고쳤는지 */ reflected: boolean };
export type ContentRecord = {
  /** 목록에 보이는 최신 버전 */
  latest: ContentGuideRow;
  /** 처음 만든 것부터 최신까지 */
  versions: ContentGuideRow[];
  title: { ko: string; ja: string };
  action: AdAction | null;
  status: ContentStatus;
  /** 이 콘텐츠(어느 버전이든)에서 나온 문구 검토, 최신부터 */
  phrases: PhraseCheck[];
  /** 만들 때 돌린 자동 검사 (버전 번호 → 검사 id) */
  autoChecks: { version: number; checkId: string }[];
  updatedAt: string;
};
export type PhraseRecord = { check: AdCheck };

export async function loadRecords(): Promise<{ contents: ContentRecord[]; phrases: PhraseRecord[] }> {
  const [guides, manual, autoChecks, reviewCheckIds, adProducts, approvedGuideIds] = await Promise.all([
    getContentGuides(),
    getAdChecks(),
    getAdChecks({ source: "content_guide" }),
    getReviewTranslationCheckIds(),
    getAdProducts(),
    getApprovedGuideIds(),
  ]);
  const checksOf = await getContentGuideChecks(guides);
  const fillFor = (productId: string | null) => {
    const p = adProducts.find((x) => x.id === productId);
    return p ? makeFill(p) : undefined;
  };
  const flaggedOf = (g: ContentGuideRow) => flaggedKeys(g.lint_hits, checksOf.get(g.id) ?? []);
  // 버전 묶기: parent_id 를 따라 처음 만든 가이드(뿌리)를 찾는다
  const byId = new Map(guides.map((g) => [g.id, g]));
  const rootOf = (g: ContentGuideRow) => {
    let cur = g;
    for (let i = 0; i < guides.length && cur.parent_id && byId.has(cur.parent_id); i++) cur = byId.get(cur.parent_id)!;
    return cur.id;
  };
  const chains = new Map<string, ContentGuideRow[]>();
  for (const g of guides) chains.set(rootOf(g), [...(chains.get(rootOf(g)) ?? []), g]);

  // 문구 검토 → 어느 콘텐츠에서 왔는지
  const sourceOf = new Map(manual.map((c) => [c.id, findSourceGuide(c, guides, fillFor, flaggedOf)]));
  const reflectedIds = new Set(guides.flatMap((g) => (g.parent_id && g.ad_check_id ? [g.ad_check_id] : [])));

  const contents: ContentRecord[] = [...chains.values()].map((chain) => {
    const ordered = chain.toSorted((a, b) => a.created_at.localeCompare(b.created_at));
    const latest = ordered.at(-1)!;
    const ids = new Set(ordered.map((g) => g.id));
    const phrases = manual
      .filter((c) => {
        const src = sourceOf.get(c.id);
        return src && ids.has(src.id);
      })
      .toSorted((a, b) => b.created_at.localeCompare(a.created_at))
      .map((check) => ({ check, reflected: reflectedIds.has(check.id) }));
    // 판정: 처음 만든 것은 자동 검사 전체, 수정본은 고친 줄을 통과로 본 남은 판정
    const action = latest.parent_id
      ? worstAction((checksOf.get(latest.id) ?? []).map((c) => c.action))
      : (autoChecks.find((c) => c.id === latest.ad_check_id)?.overall_action ?? null);
    // 「결재 승인」(approved)은 최신 버전이 콘텐츠 가이드 결재로 승인됐을 때. 수정본을 새로 만들면 다시 「결재 전」이다
    const status: ContentStatus =
      action === "must_fix" || action === "expert" ? "needs_fix" : approvedGuideIds.has(latest.id) ? "approved" : "before_approval";
    const fill = fillFor(latest.product_id) ?? ((t: string) => t);
    return {
      latest,
      versions: ordered,
      title: { ko: fill(latest.title.title_ko), ja: fill(latest.title.title_ja) },
      action,
      status,
      phrases,
      autoChecks: ordered.flatMap((g, i) => (g.ad_check_id && autoChecks.some((c) => c.id === g.ad_check_id) ? [{ version: i + 1, checkId: g.ad_check_id }] : [])),
      updatedAt: [latest.created_at, ...phrases.map((p) => p.check.created_at)].toSorted().at(-1)!,
    };
  });

  const phrases: PhraseRecord[] = manual.filter((c) => !sourceOf.get(c.id) && !reviewCheckIds.has(c.id)).map((check) => ({ check }));

  return { contents: contents.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt)), phrases: phrases.toSorted((a, b) => b.check.created_at.localeCompare(a.check.created_at)) };
}

/** 콘텐츠 가이드(어느 버전이든) 하나가 속한 묶음 */
export async function loadContentRecord(guideId: string): Promise<ContentRecord | undefined> {
  return (await loadRecords()).contents.find((c) => c.versions.some((v) => v.id === guideId));
}
