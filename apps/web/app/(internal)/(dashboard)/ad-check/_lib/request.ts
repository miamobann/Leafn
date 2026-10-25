// 화면 → POST /api/ad-check · PATCH /api/ad-check/[checkId]. 응답은 Zod로 검증한다 (CLAUDE.md 0장).
import { z } from "zod";
import { AdCheck, type AdUsage } from "@/lib/schemas/ad-check";
import type { ReviewStatus } from "@/lib/schemas/common";
import type { LabProduct } from "./products";

/** 화면에 보여 줄 호출 정보. 키·요청 내용은 오지 않는다 */
const AiMeta = z.object({
  model: z.string(),
  promptVersion: z.string(),
  usage: z.object({ input: z.number(), cached: z.number(), output: z.number() }),
  attempts: z.number(),
  warnings: z.array(z.string()),
});
export type AiMeta = z.infer<typeof AiMeta>;

const Success = z.object({ check: AdCheck, meta: AiMeta, saved: z.boolean() });
const Failure = z.object({ error: z.string() });

export type AdCheckResult = { ok: true; check: AdCheck; meta: AiMeta; saved: boolean } | { ok: false; error: string };

const STATUS_MESSAGE: Record<number, string> = {
  401: "로그인이 필요합니다. 다시 로그인해 주세요.",
  403: "승인·반려 저장은 워크스페이스 관리자(owner)만 할 수 있습니다.",
  503: "AI가 연결되지 않았습니다. 서버의 AI 설정(AI_PROVIDER, 키)을 확인해 주세요.",
};

type RequestInput = {
  workspaceId: string;
  product: LabProduct;
  usage: z.infer<typeof AdUsage>;
  text: string;
};

export async function requestAdCheck({ workspaceId, product, usage, text }: RequestInput): Promise<AdCheckResult> {
  let res: Response;
  try {
    res = await fetch("/api/ad-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: workspaceId,
        product_id: product.id,
        product: {
          name: product.name_ko,
          product_category: product.product_category,
          // 전성분은 한국어(일본어 가칭) 병기로 넘긴다
          ingredients: product.ingredients.map((i) => `${i.ko} (${i.ja})`),
        },
        usage,
        text,
      }),
    });
  } catch {
    return { ok: false, error: "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  // 로그인이 풀리면 미들웨어가 로그인 화면으로 돌려보낸다 (응답이 JSON이 아니다)
  if (res.redirected) return { ok: false, error: STATUS_MESSAGE[401] };
  const json: unknown = await res.json().catch(() => null);
  if (res.ok) {
    const parsed = Success.safeParse(json);
    return parsed.success ? { ok: true, ...parsed.data } : { ok: false, error: "판정 결과의 모양이 올바르지 않습니다. 다시 시도해 주세요." };
  }
  const failure = Failure.safeParse(json);
  return { ok: false, error: STATUS_MESSAGE[res.status] ?? (failure.success ? failure.data.error : `판정에 실패했습니다 (${res.status})`) };
}

export async function updateAdCheckReview(
  checkId: string,
  payload: { review_status: ReviewStatus; is_expert_review_requested: boolean; reviewer_note: string | null; final_text?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/ad-check/${encodeURIComponent(checkId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.redirected) return { ok: false, error: STATUS_MESSAGE[401] };
    if (res.ok) return { ok: true };
    const json: unknown = await res.json().catch(() => null);
    const failure = Failure.safeParse(json);
    return { ok: false, error: STATUS_MESSAGE[res.status] ?? (failure.success ? failure.data.error : `저장에 실패했습니다 (${res.status})`) };
  } catch {
    return { ok: false, error: "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
