import Link from "next/link";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getMembers, getProducts } from "@/lib/data";
import { getMyWorkspace } from "@/lib/data/workspace";
import { formatDate } from "@/lib/format";
import { ActionBadge, USAGE_LABEL } from "../_components/ad-badges";
import { DeleteButton } from "../_components/delete-button";
import { HistoryFilters } from "../_components/history-filters";
import { GUIDE_CHANNELS } from "../_lib/content-guide-samples";
import { koLines } from "../_lib/ko-lines";
import { CONTENT_STATUS, loadRecords, type ContentRecord, type PhraseRecord } from "../_lib/records";

// 「검토 기록」 (2026-10-27 TAB 3 흐름 개편): 「만든 가이드」 + 「검토 이력」을 합쳤다.
// 콘텐츠 가이드가 먼저 — 한 줄에 최신 버전 하나. 그 가이드의 문구 검토 · 자동 검사 · 이전 버전은 콘텐츠 가이드 상세 아래 「이 가이드의 검토」에서 본다.
// 콘텐츠 가이드에서 오지 않은 검토는 아래 「문구 검토」. 리뷰 번역 검토는 리뷰 분석 탭에서 다루므로 여기에는 없다.

const CHANNEL_LABEL = Object.fromEntries(GUIDE_CHANNELS.map((c) => [c.id, c.label]));
const KIND = ["content", "phrase"] as const;

type HistoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RecordsPage({ searchParams }: HistoryPageProps) {
  const query = await searchParams;
  const productFilter = typeof query.product === "string" ? query.product : undefined;
  const kind = KIND.find((k) => k === query.type);
  const [{ contents, phrases }, members, products, mine] = await Promise.all([loadRecords(), getMembers(), getProducts(), getMyWorkspace().catch(() => null)]);
  // 삭제는 owner(팀장)만. 콘텐츠 가이드는 모든 버전을 지우고 묶인 문구 검토는 숨긴다 (약기법 기록은 남음)
  const isOwner = mine?.role === "owner";
  const memberName = (id: string | null | undefined) => members.find((m) => m.user_id === id)?.display_name ?? null;
  const productName = (id: string | null | undefined) => products.find((p) => p.id === id)?.name ?? "—";

  const shownContents = kind === "phrase" ? [] : contents.filter((c) => !productFilter || c.latest.product_id === productFilter);
  const shownPhrases = kind === "content" ? [] : phrases.filter((p) => !productFilter || p.check.product_id === productFilter);
  const productIds = new Set([...contents.map((c) => c.latest.product_id), ...phrases.map((p) => p.check.product_id)]);
  const productOptions = products.filter((p) => productIds.has(p.id) || p.id === productFilter).map((p) => ({ value: p.id, label: p.name }));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageHeader title="검토 기록" description="만든 콘텐츠 가이드와 문구 검토를 한곳에서 봐요. 콘텐츠 가이드를 열어 걸린 문구를 고치고 결재에 올려요" featureId="A" />
        <span className="flex flex-wrap gap-2">
          <Link href="/ad-check/guide" className={buttonVariants()}>
            콘텐츠 가이드 만들기 +
          </Link>
          <Link href="/ad-check" className={buttonVariants({ variant: "outline" })}>
            문구 검토 +
          </Link>
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">① 콘텐츠 가이드 만들기 → ② 걸린 문구 검토 → ③ 가이드에 반영 → ④ 콘텐츠 가이드 결재 올리기</p>
      <div className="mb-4">
        <HistoryFilters
          filters={[
            { key: "product", label: "제품", options: productOptions },
            { key: "type", label: "종류", options: [{ value: "content", label: "콘텐츠 가이드" }, { value: "phrase", label: "문구" }] },
          ]}
        />
      </div>
      {shownContents.length === 0 && shownPhrases.length === 0 ? (
        <EmptyState message="조건에 맞는 기록이 없습니다" action="「콘텐츠 가이드 만들기 +」로 시작하거나 필터를 바꿔 보세요" />
      ) : (
        <div className="space-y-2">
          {shownContents.map((c) => (
            <ContentRow key={c.latest.id} record={c} productName={productName(c.latest.product_id)} author={memberName(c.latest.created_by)} isOwner={isOwner} />
          ))}
          {shownPhrases.length > 0 && (
            <>
              {kind !== "phrase" && shownContents.length > 0 && <h2 className="pt-3 text-sm font-semibold text-muted-foreground">문구 검토</h2>}
              {shownPhrases.map((p) => (
                <PhraseRow key={p.check.id} record={p} productName={productName(p.check.product_id)} author={memberName(p.check.created_by)} isOwner={isOwner} />
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}

/** 둘째 줄: 제품 · 채널(용도) · 작성자 · 날짜 */
function Meta({ parts }: { parts: (string | null)[] }) {
  return <p className="truncate text-xs text-muted-foreground">{parts.filter(Boolean).join(" · ")}</p>;
}

function ContentRow({ record, productName, author, isOwner }: { record: ContentRecord; productName: string; author: string | null; isOwner: boolean }) {
  const { latest, versions, status } = record;
  const st = CONTENT_STATUS[status];
  // 고칠 곳은 없지만 「수정 권장」이 남았으면 상태 옆에 점만 찍는다 (마우스를 올리면 설명)
  const advisory = status !== "needs_fix" && record.action === "should_fix";
  return (
    <article className="flex items-center gap-3 rounded-lg border p-3 text-sm">
      <Link href={`/ad-check/guide/history/${latest.id}`} className="min-w-0 flex-1 space-y-0.5" title={record.title.ja}>
        <p className="flex items-center gap-2">
          <span className="truncate font-medium underline-offset-4 hover:underline">{record.title.ko}</span>
          {versions.length > 1 && <span className="shrink-0 text-xs text-muted-foreground">v{versions.length}</span>}
        </p>
        <Meta parts={[productName, CHANNEL_LABEL[latest.channel] ?? latest.channel, author, formatDate(latest.created_at)]} />
      </Link>
      <span className={`shrink-0 whitespace-nowrap rounded border px-1.5 py-0.5 text-xs ${st.tone}`} title={advisory ? `${st.hint} · 「수정 권장」 표현이 남아 있어요` : st.hint}>
        {st.label}
        {advisory && <span className="ml-1 text-risk-medium">•</span>}
      </span>
      {isOwner && (
        <DeleteButton
          endpoint={`/api/content-guide/${latest.id}?all=1`}
          confirmMessage={`이 콘텐츠 가이드${versions.length > 1 ? `(v1~v${versions.length})` : ""}${record.phrases.length ? `와 문구 검토 ${record.phrases.length}건` : ""}을 목록에서 지울까요? 지운 콘텐츠 가이드는 되돌릴 수 없어요. (약기법 검사 기록은 남아요)`}
        />
      )}
    </article>
  );
}

function PhraseRow({ record, productName, author, isOwner }: { record: PhraseRecord; productName: string; author: string | null; isOwner: boolean }) {
  const { check } = record;
  // 목록 문구는 한국어로 통일 (일본어 줄은 번역, 번역이 없으면 원문에 「일본어」 표시). 마우스를 올리면 첫 줄 원문
  const [first, ...rest] = koLines(check);
  return (
    <article className="flex items-center gap-3 rounded-lg border p-3 text-sm">
      <Link href={`/ad-check/${check.id}`} className="min-w-0 flex-1 space-y-0.5" title={first?.original}>
        <p className="flex items-center gap-1">
          {first?.untranslated && <span className="shrink-0 rounded border px-1 text-[0.65rem] text-muted-foreground">일본어</span>}
          <span lang={first?.untranslated ? "ja" : "ko"} className="truncate font-medium underline-offset-4 hover:underline">
            {first?.text ?? ""}
          </span>
          {rest.length > 0 && <span className="shrink-0 text-xs text-muted-foreground">외 {rest.length}줄</span>}
        </p>
        <Meta parts={[productName, check.usage ? USAGE_LABEL[check.usage] : null, author, formatDate(check.created_at)]} />
      </Link>
      {check.overall_action && <ActionBadge action={check.overall_action} />}
      <Link href={`/ad-check?from=${check.id}`} className={`${buttonVariants({ variant: "outline", size: "sm" })} border-foreground/40!`}>
        재검토
      </Link>
      {isOwner && <DeleteButton endpoint={`/api/ad-check/${check.id}`} confirmMessage="이 검토를 목록에서 삭제할까요? 기록은 증거용으로 DB에 남습니다." />}
    </article>
  );
}

