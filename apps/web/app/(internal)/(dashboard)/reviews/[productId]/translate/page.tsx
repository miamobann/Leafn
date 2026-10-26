import { notFound } from "next/navigation";
import { getAdChecks, getReviewTranslations } from "@/lib/data";
import { getReviewProductById, getReviewsOf } from "@/lib/data/reviews";
import { getMyWorkspace } from "@/lib/data/workspace";
import { TranslateView, type TranslatedRow } from "./translate-view";

export default async function ReviewTranslatePage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ pick?: string }>;
}) {
  const { productId } = await params;
  const { pick } = await searchParams;
  const product = await getReviewProductById(productId);
  if (!product) notFound();
  const [reviews, translations, checks, mine] = await Promise.all([getReviewsOf(productId, { lang: "ko" }), getReviewTranslations(productId), getAdChecks(), getMyWorkspace()]);
  const checkById = new Map(checks.map((c) => [c.id, c]));

  // 상태: 광고 검토에서 담당자가 승인(내부 검토 완료)하면 승인 · 약기법 검토에서 고칠 표현이 나옴(높은 위험 또는 반려) → 고쳐야 함 · 그 밖 → 검토 대기
  const rows: TranslatedRow[] = translations.map((t) => {
    const check = t.ad_check_id ? (checkById.get(t.ad_check_id) ?? null) : null;
    const risky = check?.findings.find((f) => f.risk === "high" || f.action === "must_fix");
    const approved = t.status === "approved" || check?.review_status === "approved";
    const status = approved ? "approved" : check?.review_status === "rejected" || risky ? "fix" : "pending";
    const original = reviews.find((r) => r.id === t.review_id)?.body ?? "";
    // 고칠 표현과 대체 표현: 약기법 검토가 짚은 것 중 대체 표현이 있는 것만. 통과(pass)한 안을 먼저 보여 준다
    const fixes = (check?.findings ?? [])
      .filter((f) => f.action !== "ok" && f.risk !== "low")
      .map((f) => ({
        text: f.text,
        reason: f.reason,
        serious: f.risk === "high" || f.action === "must_fix",
        suggestions: (f.suggestion_rechecks ?? [])
          .filter((r) => r.text_ko)
          .toSorted((a, b) => Number(b.recheck === "pass") - Number(a.recheck === "pass"))
          .map((r) => ({ ja: r.text, ko: r.text_ko ?? "", pass: r.recheck === "pass" })),
      }));
    return {
      id: t.id,
      reviewId: t.review_id,
      textJa: t.text_ja,
      // 대체 표현을 적용했으면 검토한 문장(check.input_text)이 고친 한국어 문장이다
      textKo: check?.input_text ?? original,
      edited: check ? check.input_text.replace(/\s+/g, " ").trim() !== original.replace(/\s+/g, " ").trim().slice(0, 500) : false,
      status,
      note: risky ? `「${risky.text}」 ${risky.reason}` : status === "pending" ? "약기법 검토: 위험 표현 없음 · 팀장 승인 전" : "",
      checkId: check?.id ?? null,
      fixes,
    };
  });
  const ids = new Set(reviews.map((r) => r.id));
  const initialPicked = (pick ?? "").split(",").filter((id) => ids.has(id));

  return <TranslateView product={product} reviews={reviews} translated={rows} initialPicked={initialPicked} isOwner={mine?.role === "owner"} />;
}
