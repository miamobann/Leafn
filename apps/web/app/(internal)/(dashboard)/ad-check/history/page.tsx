import Link from "next/link";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getMembers, getProducts } from "@/lib/data";
import { getMyWorkspace } from "@/lib/data/workspace";
import { formatDate } from "@/lib/format";
import type { AdCheck } from "@/lib/schemas/ad-check";
import { ActionBadge, USAGE_LABEL } from "../_components/ad-badges";
import { DeleteButton } from "../_components/delete-button";
import { HistoryFilters } from "../_components/history-filters";
import { GUIDE_CHANNELS } from "../_lib/content-guide-samples";
import { koLines } from "../_lib/ko-lines";
import { CONTENT_STATUS, loadRecords, type ContentRecord, type PhraseRecord } from "../_lib/records";

// 「기록」 (2026-10-27 TAB 3 흐름 개편): 「만든 가이드」 + 「검토 이력」을 합쳤다.
// 콘텐츠가 먼저 — 콘텐츠 한 줄 아래에 그 콘텐츠에서 나온 문구 검토 · 자동 검사 · 이전 버전을 묶는다. 콘텐츠에서 오지 않은 검토는 「문구만」 줄.
// 흐름: 콘텐츠 만들기 → 걸린 문구 새 검토 → 가이드에 반영 → 콘텐츠 결재 올리기

const CHANNEL_LABEL = Object.fromEntries(GUIDE_CHANNELS.map((c) => [c.id, c.label]));
const KIND = ["content", "phrase", "review"] as const;

type HistoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RecordsPage({ searchParams }: HistoryPageProps) {
  const query = await searchParams;
  const productFilter = typeof query.product === "string" ? query.product : undefined;
  const kind = KIND.find((k) => k === query.type);
  const [{ contents, phrases }, members, products, mine] = await Promise.all([loadRecords(), getMembers(), getProducts(), getMyWorkspace().catch(() => null)]);
  // 문구 검토 삭제(숨김)는 owner(팀장)만. 콘텐츠 삭제는 콘텐츠 상세에서
  const isOwner = mine?.role === "owner";
  const memberName = (id: string | null | undefined) => members.find((m) => m.user_id === id)?.display_name ?? "—";
  const productName = (id: string | null | undefined) => products.find((p) => p.id === id)?.name ?? "—";

  const shownContents = !kind || kind === "content" ? contents.filter((c) => !productFilter || c.latest.product_id === productFilter) : [];
  const shownPhrases = phrases.filter((p) => (!kind ? true : kind === "phrase" ? p.kind === "manual" : kind === "review" ? p.kind === "review" : false) && (!productFilter || p.check.product_id === productFilter));
  const productIds = new Set([...contents.map((c) => c.latest.product_id), ...phrases.map((p) => p.check.product_id)]);
  const productOptions = products.filter((p) => productIds.has(p.id) || p.id === productFilter).map((p) => ({ value: p.id, label: p.name }));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageHeader title="기록" description="만든 콘텐츠와 문구 검토를 한곳에서 봐요. 콘텐츠를 열어 걸린 문구를 고치고 결재에 올려요" featureId="A" />
        <span className="flex flex-wrap gap-2">
          <Link href="/ad-check/guide" className={buttonVariants()}>
            콘텐츠 만들기 +
          </Link>
          <Link href="/ad-check" className={buttonVariants({ variant: "outline" })}>
            문구만 검토 +
          </Link>
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">① 콘텐츠 만들기 → ② 걸린 문구 새 검토 → ③ 가이드에 반영 → ④ 콘텐츠 결재 올리기</p>
      <div className="mb-4">
        <HistoryFilters
          filters={[
            { key: "type", label: "종류", options: [{ value: "content", label: "콘텐츠" }, { value: "phrase", label: "문구만" }, { value: "review", label: "리뷰 번역" }] },
            { key: "product", label: "제품", options: productOptions },
          ]}
        />
      </div>
      {shownContents.length === 0 && shownPhrases.length === 0 ? (
        <EmptyState message="조건에 맞는 기록이 없습니다" action="「콘텐츠 만들기 +」로 시작하거나 필터를 바꿔 보세요" />
      ) : (
        <div className="space-y-3">
          {shownContents.length > 0 && (
            <section className="space-y-2" aria-label="콘텐츠">
              {shownContents.map((c) => (
                <ContentRow key={c.latest.id} record={c} productName={productName(c.latest.product_id)} author={memberName(c.latest.created_by)} />
              ))}
            </section>
          )}
          {shownPhrases.length > 0 && (
            <section className="space-y-2" aria-label="문구만">
              {kind !== "phrase" && kind !== "review" && <h2 className="pt-2 text-sm font-semibold text-muted-foreground">문구만 검토 · 리뷰 번역</h2>}
              {shownPhrases.map((p) => (
                <PhraseRow key={p.check.id} record={p} productName={productName(p.check.product_id)} author={memberName(p.check.created_by)} isOwner={isOwner} />
              ))}
            </section>
          )}
        </div>
      )}
    </>
  );
}

/** 검토 문구의 첫 줄 (한국어로 통일, 번역이 없으면 원문에 「일본어」 표시) */
function FirstLine({ check }: { check: AdCheck }) {
  const [first, ...rest] = koLines(check);
  return (
    <span title={first?.original} className="flex min-w-0 items-center gap-1">
      {first?.untranslated && <span className="shrink-0 rounded border px-1 text-[0.65rem] text-muted-foreground">일본어</span>}
      <span lang={first?.untranslated ? "ja" : "ko"} className="truncate">
        {first?.text ?? ""}
      </span>
      {rest.length > 0 && <span className="shrink-0 text-muted-foreground">외 {rest.length}줄</span>}
    </span>
  );
}

function ContentRow({ record, productName, author }: { record: ContentRecord; productName: string; author: string }) {
  const { latest, versions, phrases, autoChecks, status } = record;
  const st = CONTENT_STATUS[status];
  const version = versions.length;
  const extra = phrases.length + autoChecks.length + (versions.length - 1);
  return (
    <article className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
        <Link href={`/ad-check/guide/history/${latest.id}`} className="flex min-w-0 flex-1 items-center gap-2 font-medium underline-offset-4 hover:underline" title={record.title.ja}>
          <span className="shrink-0 rounded border px-1 text-xs font-normal">{version > 1 ? `v${version} · 약기법 수정` : "v1"}</span>
          <span className="truncate">{record.title.ko}</span>
        </Link>
        <span className="text-muted-foreground">{productName}</span>
        <span className="whitespace-nowrap text-muted-foreground">{CHANNEL_LABEL[latest.channel] ?? latest.channel}</span>
        {record.action ? <ActionBadge action={record.action} /> : <span className="text-muted-foreground">—</span>}
        <span className={`whitespace-nowrap rounded border px-1.5 py-0.5 text-xs ${st.tone}`} title={st.hint}>
          {st.label}
        </span>
        <span className="text-muted-foreground">
          {author !== "—" ? `${author} · ` : ""}
          {formatDate(latest.created_at)}
        </span>
      </div>
      {extra > 0 && (
        <details className="border-t px-3 py-2 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            문구 검토 {phrases.length}건{versions.length > 1 ? ` · 이전 버전 ${versions.length - 1}개` : ""} · 자동 검사 {autoChecks.length}건
          </summary>
          <ul className="mt-2 space-y-1.5">
            {phrases.map(({ check, reflected }) => (
              <li key={check.id}>
                <Link href={`/ad-check/${check.id}`} className="flex flex-wrap items-center gap-2 underline-offset-4 hover:underline">
                  <span className="shrink-0 text-xs text-muted-foreground">새 검토</span>
                  <FirstLine check={check} />
                  {check.overall_action && <ActionBadge action={check.overall_action} />}
                  <span className={`shrink-0 rounded border px-1 text-[0.65rem] ${reflected ? "text-muted-foreground" : "border-primary/50 text-primary"}`}>{reflected ? "반영됨" : "반영 전"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(check.created_at)}</span>
                </Link>
              </li>
            ))}
            {autoChecks.map((a) => (
              <li key={a.checkId}>
                <Link href={`/ad-check/${a.checkId}`} className="text-muted-foreground underline-offset-4 hover:underline">
                  자동 검사 · v{a.version} (만들 때)
                </Link>
              </li>
            ))}
            {versions.slice(0, -1).map((v, i) => (
              <li key={v.id}>
                <Link href={`/ad-check/guide/history/${v.id}`} className="text-muted-foreground underline-offset-4 hover:underline">
                  이전 버전 · v{i + 1} ({formatDate(v.created_at)})
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function PhraseRow({ record, productName, author, isOwner }: { record: PhraseRecord; productName: string; author: string; isOwner: boolean }) {
  const { check, kind } = record;
  return (
    <article className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-3 text-sm">
      <Link href={`/ad-check/${check.id}`} className="flex min-w-0 flex-1 items-center gap-2 font-medium underline-offset-4 hover:underline">
        <span className="shrink-0 rounded border px-1 text-xs font-normal" title={kind === "review" ? "리뷰 분석 탭의 상세페이지용 리뷰 번역 검토" : "콘텐츠 없이 문구만 검토"}>
          {kind === "review" ? "리뷰 번역" : "문구만"}
        </span>
        <FirstLine check={check} />
      </Link>
      <span className="text-muted-foreground">{productName}</span>
      <span className="whitespace-nowrap text-muted-foreground">{check.usage ? USAGE_LABEL[check.usage] : "—"}</span>
      {check.overall_action ? <ActionBadge action={check.overall_action} /> : <span className="text-muted-foreground">—</span>}
      <span className="text-muted-foreground">
        {author !== "—" ? `${author} · ` : ""}
        {formatDate(check.created_at)}
      </span>
      <Link href={`/ad-check?from=${check.id}`} className={`${buttonVariants({ variant: "outline", size: "sm" })} border-foreground/40!`}>
        재검토
      </Link>
      {isOwner && <DeleteButton endpoint={`/api/ad-check/${check.id}`} confirmMessage="이 검토를 목록에서 삭제할까요? 기록은 증거용으로 DB에 남습니다." />}
    </article>
  );
}
