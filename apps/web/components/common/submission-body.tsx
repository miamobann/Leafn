// 시안 버전 내용(body)을 탭별로 보여 준다 (결재함 버전 미리보기, docs/team-approval-ai-analysis.md 3장 3).
// previous를 주면 바로 앞 버전과 달라진 숫자 · 판정 · 항목을 함께 표시한다
import Link from "next/link";
import { ActionBadge } from "@/app/(internal)/(dashboard)/ad-check/_components/ad-badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { APPEAL_TOPICS } from "@/lib/schemas/review";
import { AdBody, MarketBody, ReviewBody, type SubmissionTab } from "@/lib/schemas/submission";
import { RiskBadge } from "./badges";

const VERDICT = { strength: "강점", weakness: "약점", unclear: "근거 부족" } as const;

const TEXT = {
  badShape: "이 버전의 내용 모양이 지금 스키마와 맞지 않아 표시하지 못했어요.",
  reviews: (n: number) => `리뷰 ${n}건`,
  analyzed: (n: number) => `분석 ${n}건`,
  sentiment: "감성",
  topics: "주제별 성적표",
  topic: "주제",
  praise: "칭찬",
  complaint: "불만",
  verdict: "판정",
  painPoints: "불만",
  factors: "재구매 요인",
  evidence: (n: number) => `근거 리뷰 ${n}건`,
  adItems: "담은 광고 문구",
  expert: "전문가 확인 요청",
  finalText: "최종 문구",
  added: "새로 담음",
  removed: (n: number) => `앞 버전에서 뺀 문구 ${n}건`,
  scope: { product: "제품 단위", project: "프로젝트(라인) 전체" },
  empty: "없음",
};

/** 앞 버전 대비 숫자 변화. 같으면 아무것도 쓰지 않는다 */
function Delta({ now, before }: { now: number; before: number | undefined }) {
  if (before === undefined || before === now) return null;
  const diff = now - before;
  return <span className="ml-1 text-xs text-muted-foreground">({diff > 0 ? `+${diff}` : diff})</span>;
}

export function SubmissionBody({
  tab,
  body,
  previous,
}: {
  tab: SubmissionTab;
  body: Record<string, unknown>;
  previous?: Record<string, unknown> | null;
}) {
  if (tab === "review") {
    const now = ReviewBody.safeParse(body);
    const before = previous ? ReviewBody.safeParse(previous) : null;
    return now.success ? <ReviewBodyView body={now.data} before={before?.success ? before.data : null} /> : <BadShape />;
  }
  if (tab === "ad") {
    const now = AdBody.safeParse(body);
    const before = previous ? AdBody.safeParse(previous) : null;
    return now.success ? <AdBodyView body={now.data} before={before?.success ? before.data : null} /> : <BadShape />;
  }
  const now = MarketBody.safeParse(body);
  return now.success ? <MarketBodyView body={now.data} /> : <BadShape />;
}

function BadShape() {
  return <p className="text-sm text-muted-foreground">{TEXT.badShape}</p>;
}

function ReviewBodyView({ body, before }: { body: ReviewBody; before: ReviewBody | null }) {
  const topicBefore = new Map(before?.topics.map((t) => [t.topic, t]) ?? []);
  return (
    <div className="space-y-4 text-sm">
      <p>
        {TEXT.reviews(body.review_count)}
        <Delta now={body.review_count} before={before?.review_count} />
        {` · ${TEXT.analyzed(body.analyzed_count)}`}
        <Delta now={body.analyzed_count} before={before?.analyzed_count} />
        {" · "}
        {TEXT.sentiment} +{body.sentiment.positive}
        <Delta now={body.sentiment.positive} before={before?.sentiment.positive} /> / −{body.sentiment.negative}
        <Delta now={body.sentiment.negative} before={before?.sentiment.negative} /> / ○{body.sentiment.neutral}
      </p>
      <div>
        <h4 className="mb-2 font-medium">{TEXT.topics}</h4>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{TEXT.topic}</TableHead>
                <TableHead className="text-right">{TEXT.praise}</TableHead>
                <TableHead className="text-right">{TEXT.complaint}</TableHead>
                <TableHead>{TEXT.verdict}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {body.topics.map((t) => {
                const prev = topicBefore.get(t.topic);
                return (
                  <TableRow key={t.topic}>
                    <TableCell>{APPEAL_TOPICS[t.topic].name}</TableCell>
                    <TableCell className="text-right">
                      {t.positive}
                      <Delta now={t.positive} before={prev?.positive} />
                    </TableCell>
                    <TableCell className="text-right">
                      {t.negative}
                      <Delta now={t.negative} before={prev?.negative} />
                    </TableCell>
                    <TableCell>
                      {prev && prev.verdict !== t.verdict ? `${VERDICT[prev.verdict]} → ` : ""}
                      {VERDICT[t.verdict]}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ItemList title={TEXT.painPoints} items={body.pain_points} />
        <ItemList title={TEXT.factors} items={body.repurchase_factors} />
      </div>
      <p>
        <Link href={`/reviews/${body.product_id}`} className="underline-offset-4 hover:underline">
          리뷰 리포트 열기 →
        </Link>
      </p>
    </div>
  );
}

function ItemList({ title, items }: { title: string; items: ReviewBody["pain_points"] }) {
  return (
    <div>
      <h4 className="mb-1 font-medium">{title}</h4>
      {items.length === 0 ? (
        <p className="text-muted-foreground">{TEXT.empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.label}>
              {i.label} <span className="text-muted-foreground">· {i.count}건 · {TEXT.evidence(i.evidence_review_ids.length)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AdBodyView({ body, before }: { body: AdBody; before: AdBody | null }) {
  const beforeIds = new Set(before?.items.map((i) => i.ad_check_id) ?? []);
  const removed = before ? before.items.filter((i) => !body.items.some((n) => n.ad_check_id === i.ad_check_id)).length : 0;
  return (
    <div className="space-y-3 text-sm">
      <h4 className="font-medium">{TEXT.adItems}</h4>
      <ul className="space-y-2">
        {body.items.map((item) => (
          <li key={item.ad_check_id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/ad-check/${item.ad_check_id}`} className="font-medium underline-offset-4 hover:underline">
                {item.input_excerpt || "—"}
              </Link>
              {item.overall_risk && <RiskBadge risk={item.overall_risk} />}
              {item.overall_action && <ActionBadge action={item.overall_action} />}
              {item.is_expert_review_requested && <span className="text-xs text-status-pending">{TEXT.expert}</span>}
              {before && !beforeIds.has(item.ad_check_id) && <span className="text-xs text-muted-foreground">{TEXT.added}</span>}
            </div>
            {item.final_text && (
              <p className="mt-1 whitespace-pre-line text-muted-foreground" lang="ja">
                {TEXT.finalText}: {item.final_text}
              </p>
            )}
          </li>
        ))}
      </ul>
      {removed > 0 && <p className="text-muted-foreground">{TEXT.removed(removed)}</p>}
    </div>
  );
}

function MarketBodyView({ body }: { body: MarketBody }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">{TEXT.scope[body.scope]}</p>
      <ul className="list-disc space-y-1 pl-5">
        {body.points.map((p) => (
          <li key={p.text}>{p.text}</li>
        ))}
      </ul>
    </div>
  );
}
