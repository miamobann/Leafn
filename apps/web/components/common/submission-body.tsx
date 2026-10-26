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
  guideItems: "이 가이드의 약기법 검사 · 문구 검토",
  guideOpen: "콘텐츠 가이드 열기 →",
  appeals: (n: number) => `담은 소구점 ${n}개`,
  quotes: (n: number) => `담은 일본어 후기 ${n}건`,
  quotesHint: "약기법 검토를 통과한 문구 · 승인되면 콘텐츠 제작 가이드가 가져가요",
  edited: "고침",
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
  const before = previous ? MarketBody.safeParse(previous) : null;
  return now.success ? <MarketBodyView body={now.data} before={before?.success ? before.data : null} /> : <BadShape />;
}

function BadShape() {
  return <p className="text-sm text-muted-foreground">{TEXT.badShape}</p>;
}

function ReviewBodyView({ body, before }: { body: ReviewBody; before: ReviewBody | null }) {
  const topicBefore = new Map(before?.topics.map((t) => [t.topic, t]) ?? []);
  // 앞 버전이 있으면 이번에 새로 담은 소구점 · 후기를 초록으로 표시한다
  const beforeTopics = before ? new Set((before.appeals ?? []).map((a) => a.topic)) : null;
  const beforeQuotes = before ? new Set((before.translations ?? []).map((t) => t.review_translation_id)) : null;
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
      <div>
        <h4 className="mb-1 font-medium">{TEXT.appeals(body.appeals?.length ?? 0)}</h4>
        {(body.appeals ?? []).length === 0 ? (
          <p className="text-muted-foreground">{TEXT.empty}</p>
        ) : (
          <ul className="space-y-1">
            {(body.appeals ?? []).map((a) => (
              <li key={a.topic} className={beforeTopics && !beforeTopics.has(a.topic) ? "rounded bg-emerald-50 px-2 py-1" : undefined}>
                <b>{APPEAL_TOPICS[a.topic].name}</b>{" "}
                <span className="text-muted-foreground">
                  · 경쟁 불만 {a.competitor_complaints}건 → 우리 칭찬 {a.own_praises}건 · {TEXT.evidence(a.evidence_review_ids.length)}
                </span>
                {beforeTopics && !beforeTopics.has(a.topic) && <span className="ml-2 text-xs text-emerald-900">{TEXT.added}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4 className="mb-1 font-medium">
          {TEXT.quotes(body.translations?.length ?? 0)} <span className="font-normal text-muted-foreground">{TEXT.quotesHint}</span>
        </h4>
        {(body.translations ?? []).length === 0 ? (
          <p className="text-muted-foreground">{TEXT.empty}</p>
        ) : (
          <ul className="space-y-2">
            {(body.translations ?? []).map((t) => {
              const isNew = beforeQuotes && !beforeQuotes.has(t.review_translation_id);
              return (
                <li key={t.review_translation_id} className={`rounded-md border px-3 py-2 ${isNew ? "bg-emerald-50" : ""}`}>
                  <p lang="ja">
                    {t.text_ja} {isNew && <span className="ml-1 text-xs text-emerald-900">{TEXT.added}</span>}
                  </p>
                  <p className="text-muted-foreground">
                    {t.text_ko}
                    {t.edited && <span className="ml-1.5 rounded bg-stone-100 px-1.5 py-0.5 text-xs">{TEXT.edited}</span>}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
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
  const guide = body.content_guide;
  return (
    <div className="space-y-3 text-sm">
      {guide && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
          <span>
            <b className="font-semibold">콘텐츠 가이드 v{guide.version_no}</b>
            {guide.title && <span className="ml-2">{guide.title}</span>}
            {before?.content_guide && before.content_guide.root_id !== guide.root_id && <span className="ml-2 text-xs text-muted-foreground">앞 버전과 다른 가이드</span>}
          </span>
          <Link href={`/ad-check/guide/history/${guide.id}`} className="underline-offset-4 hover:underline">
            {TEXT.guideOpen}
          </Link>
        </div>
      )}
      <h4 className="font-medium">{guide ? TEXT.guideItems : TEXT.adItems}</h4>
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

/** 시장 분석 시안: 올린 순간의 요약 탭(이번 주 핵심 · 알 수 있는 것 · 한눈에 보기)을 다시 계산하지 않고 그대로 보여 준다. 앞 버전과 달라진 칸은 초록 */
function MarketBodyView({ body, before }: { body: MarketBody; before: MarketBody | null }) {
  const sum = body.summary;
  if (!sum) {
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
  const prev = before?.summary ?? null;
  // 앞 버전이 있을 때만 비교한다. 같은 id/key 칸의 내용이 다르거나 새로 생긴 칸이면 초록
  const changed = <T extends object>(list: T[] | undefined, key: (t: T) => string, item: T) => {
    if (!prev || !list) return null;
    const old = list.find((o) => key(o) === key(item));
    return !old ? TEXT.added : JSON.stringify(old) !== JSON.stringify(item) ? "바뀜" : null;
  };
  const mark = (tag: string | null) => (tag ? <span className="ml-2 text-xs font-normal text-emerald-900">{tag}</span> : null);
  const { basis } = sum;
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        <span lang="ja">{basis.category}</span> · {basis.platform_label} · {basis.week ?? "기준 주 없음"}
        {basis.captured_at && ` (${basis.captured_at.slice(0, 10)} 랭킹 수집)`}
      </p>

      {sum.core.length > 0 && (
        <div>
          <h4 className="mb-1 font-medium">이번 주 핵심</h4>
          <div className="grid gap-2 md:grid-cols-3">
            {sum.core.map((c) => {
              const tag = changed(prev?.core, (x) => x.id, c);
              return (
                <div key={c.id} className={`rounded-md border p-3 ${tag ? "bg-emerald-50" : ""}`}>
                  <p className="text-xs text-muted-foreground">
                    {c.label}
                    {mark(tag)}
                  </p>
                  <p className="font-semibold">{c.value}</p>
                  <p>{c.meaning}</p>
                  {c.sub && <p className="text-xs text-muted-foreground">{c.sub}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sum.points.length > 0 && (
        <div>
          <h4 className="mb-1 font-medium">이번 분석으로 알 수 있는 것</h4>
          <ul className="divide-y rounded-md border">
            {sum.points.map((pt) => {
              const tag = changed(prev?.points, (x) => x.id, pt);
              return (
                <li key={pt.id} className={`grid gap-x-3 px-3 py-2 sm:grid-cols-[7rem_minmax(0,1fr)] ${tag ? "bg-emerald-50" : ""}`}>
                  <span className="text-muted-foreground">{pt.label}</span>
                  <span>
                    <b className="font-semibold">{pt.headline}</b>
                    {pt.sample && <span className="ml-1 text-xs text-muted-foreground">(샘플)</span>}
                    {mark(tag)}
                    <span className="block text-muted-foreground">할 일: {pt.action}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div>
        <h4 className="mb-1 font-medium">한눈에 보기</h4>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {sum.tiles.map((t) => {
            const tag = changed(prev?.tiles, (x) => x.key, t);
            return (
              <div key={t.key} className={`rounded-md border p-3 ${tag ? "bg-emerald-50" : ""}`}>
                <p className="text-xs text-muted-foreground">
                  {t.title}
                  {mark(tag)}
                </p>
                <p>
                  <b className="text-base font-semibold">{t.value}</b> {t.label && <span className="font-medium">{t.label}</span>}
                </p>
                {t.lines.map((l) => (
                  <p key={l} className="text-xs text-muted-foreground">
                    {l}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <p>
        <Link href="/market#summary" className="underline-offset-4 hover:underline">
          시장 분석 요약 열기 →
        </Link>
      </p>
    </div>
  );
}
