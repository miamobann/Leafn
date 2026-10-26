// 리뷰 분석 요약 탭의 제품 카드 (서버 컴포넌트). 시안에 담은 소구점 · 일본어 후기와 리포트 숫자를 한 장으로 보인다.
// 결재 올리기 패널은 이 카드 오른쪽 열에 SubmissionSection으로 붙는다 (page.tsx).
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { APPEAL_TOPICS } from "@/lib/schemas/review";
import type { ReviewBody, VersionStatus } from "@/lib/schemas/submission";

const STATUS_LABEL: Record<VersionStatus, string> = {
  draft: "임시 저장",
  submitted: "결재 대기",
  approved: "승인됨",
  rejected: "반려됨",
  withdrawn: "제출 취소",
};

type Draft = {
  versionNo: number;
  status: VersionStatus;
  appeals: NonNullable<ReviewBody["appeals"]>;
  translations: NonNullable<ReviewBody["translations"]>;
};

export function SummaryCard({
  productId,
  name,
  skinLine,
  onSale,
  body,
  draft,
  verdictLabel,
}: {
  productId: string;
  name: string;
  skinLine: string | null;
  onSale: boolean;
  body: ReviewBody;
  draft: Draft | null;
  verdictLabel: Record<"strength" | "weakness" | "unclear", string>;
}) {
  const total = body.sentiment.positive + body.sentiment.negative + body.sentiment.neutral;
  const praiseShare = total ? Math.round((body.sentiment.positive / total) * 100) : 0;
  const repurchase = body.repurchase_factors.reduce((sum, f) => sum + f.count, 0);
  const appealed = new Set(draft?.appeals.map((a) => a.topic));
  const analyzed = body.analyzed_count > 0;
  const quotes = draft?.translations ?? [];

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-label={`${name} 요약`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{name}</h2>
        {skinLine && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{skinLine}</span>}
        <span className={`rounded-full px-2.5 py-0.5 text-xs ${onSale ? "bg-emerald-50 text-emerald-900" : "bg-muted"}`}>{onSale ? "판매 중" : "개발 중"}</span>
        {draft ? (
          <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-900">
            시안 v{draft.versionNo} · {STATUS_LABEL[draft.status]} · 소구점 {draft.appeals.length} · 후기 {quotes.length}
          </span>
        ) : (
          onSale && <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs">시안 없음</span>
        )}
      </div>

      {!analyzed ? (
        <p className="text-sm text-muted-foreground">
          {body.review_count === 0 ? "국내 리뷰가 아직 없어요." : `리뷰 ${body.review_count}건이 있지만 AI 분석 전이에요.`}{" "}
          <Link href={`/reviews/${productId}`} className="underline-offset-4 hover:underline">
            리포트에서 분석하기 →
          </Link>
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              ["리뷰", `${body.review_count}건`],
              ["AI 분석", `${body.analyzed_count}건`],
              ["칭찬 비중", `${praiseShare}%`],
              ["재구매 요인", `${repurchase}건`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border px-3 py-2">
                <span className="block text-xs text-muted-foreground">{label}</span>
                <b className="text-lg">{value}</b>
              </div>
            ))}
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold">주제별 성적표</h3>
            <ul className="divide-y text-sm">
              {body.topics.map((t) => (
                <li key={t.topic} className="flex flex-wrap items-center gap-2 py-1.5">
                  <b className="w-20">{APPEAL_TOPICS[t.topic].name}</b>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${t.verdict === "strength" ? "bg-sky-50 text-sky-900" : t.verdict === "weakness" ? "bg-orange-50 text-orange-900" : "bg-muted"}`}
                  >
                    {verdictLabel[t.verdict]}
                  </span>
                  <span className="text-muted-foreground">
                    칭찬 {t.positive} · 불만 {t.negative}
                  </span>
                  {appealed.has(t.topic) && <span className="ml-auto rounded bg-muted px-2 py-0.5 text-xs">소구점으로 담음</span>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {onSale && (
        <>
          <div>
            <h3 className="mb-1 text-sm font-semibold">담은 소구점 {draft?.appeals.length ?? 0}개</h3>
            {draft && draft.appeals.length > 0 ? (
              <ul className="divide-y text-sm">
                {draft.appeals.map((a) => (
                  <li key={a.topic} className="flex flex-wrap items-center gap-2 py-1.5">
                    <b className="w-20">{APPEAL_TOPICS[a.topic].name}</b>
                    <span className="text-muted-foreground">
                      경쟁 불만 {a.competitor_complaints}건 → 우리 칭찬 {a.own_praises}건
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">근거 리뷰 {a.evidence_review_ids.length}건</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">아직 담은 소구점이 없어요.</p>
            )}
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold">
              담은 일본어 후기 {quotes.length}건{" "}
              <span className="font-normal text-muted-foreground">약기법 검토를 통과한 문구만 담겨요 · 승인되면 콘텐츠 제작 가이드가 가져가요</span>
            </h3>
            {quotes.length > 0 ? (
              <ul className="space-y-2">
                {quotes.map((q) => (
                  <li key={q.review_translation_id} className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                    <p lang="ja">{q.text_ja}</p>
                    <p className="text-muted-foreground">
                      {q.text_ko}
                      {q.edited && <span className="ml-1.5 rounded bg-stone-100 px-1.5 py-0.5 text-xs">고침</span>}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">아직 담은 후기가 없어요.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/reviews/compare?own=${productId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              소구점 찾기 →
            </Link>
            <Link href={`/reviews/${productId}/translate`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              상세페이지용 리뷰 →
            </Link>
            <Link href={`/reviews/${productId}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              리포트 보기
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
