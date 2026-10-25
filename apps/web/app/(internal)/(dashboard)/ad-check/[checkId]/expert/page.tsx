import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getAdCheck, getProduct, getWorkspace } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { ACTION_TONE } from "../../_components/ad-badges";
import { CopyButton } from "../../_components/copy-button";
import { PrintButton } from "../../_components/print-button";
import { buildExpertSheet, EXPERT_NOTE_JA, EXPERT_REQUEST_JA, EXPERT_REQUEST_KO, expertSheetText } from "../../_lib/expert-sheet";

// 대시보드 레이아웃(공용)은 고치지 않고, 인쇄할 때만 요청서 밖을 숨긴다 (content-guide-report.tsx와 같은 방식)
const PRINT_CSS = `
@page { size: A4; margin: 14mm; }
@media print {
  body *:not(:has(#expert-sheet)):not(#expert-sheet):not(#expert-sheet *) { display: none !important; }
  *:has(#expert-sheet) { display: block !important; position: static !important; overflow: visible !important; height: auto !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; }
}
`;

/** 전문가 확인 자료: 일본 대리점·약사 컨설턴트에게 보낼 확인 요청서 (복사 · PDF). AI를 다시 부르지 않는다 */
export default async function ExpertSheetPage({ params }: { params: Promise<{ checkId: string }> }) {
  const check = await getAdCheck((await params).checkId);
  if (!check) notFound();
  const [product, workspace] = await Promise.all([check.product_id ? getProduct(check.product_id) : null, getWorkspace()]);
  const sheet = buildExpertSheet(check, product?.name ?? "—");
  const date = formatDate(new Date().toISOString());
  const text = expertSheetText(sheet, workspace.name, date);

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageHeader title="전문가 확인 자료" description="일본 대리점·약사 컨설턴트에게 메일로 보낼 확인 요청서입니다" featureId="A" />
        <span className="flex flex-wrap gap-2">
          <Link href={`/ad-check/${check.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            검토 상세로
          </Link>
          {sheet.items.length > 0 && <CopyButton text={text} label="메일 본문 복사" />}
          {sheet.items.length > 0 && <PrintButton />}
        </span>
      </div>

      {sheet.items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">모든 줄이 「문제 없음」이라 전문가에게 확인할 표현이 없어요.</p>
      ) : (
        <article id="expert-sheet" className="mt-4 space-y-4 rounded-lg border p-6 text-sm leading-relaxed">
          <header className="space-y-1 border-b pb-3">
            <h2 className="text-lg font-bold" lang="ja">
              薬機法 広告表現 確認依頼
            </h2>
            <p className="text-muted-foreground">
              依頼元: {workspace.name} · 日付: {date}
            </p>
            <p>
              製品: {sheet.productName}
              {sheet.categoryJa && `（${sheet.categoryJa}）`}
              {sheet.usageJa && ` · 用途: ${sheet.usageJa}`}
            </p>
          </header>
          <p lang="ja">{EXPERT_REQUEST_JA}</p>
          <p className="text-muted-foreground">{EXPERT_REQUEST_KO}</p>

          <ol className="space-y-4">
            {sheet.items.map((it, i) => (
              <li key={it.index} className="space-y-2 rounded-md border p-4 break-inside-avoid">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <span>{i + 1}.</span>
                  {/* 받는 사람이 일본인이라 판정 이름도 일본어 (색은 광고 검토와 같다) */}
                  <span className={`rounded px-1.5 text-xs ${ACTION_TONE[it.action].badge}`} lang="ja">
                    {it.actionJa}
                  </span>
                  <span lang="ja">{it.textJa}</span>
                </p>
                {it.textKo && <p className="text-muted-foreground">한국어: {it.textKo}</p>}
                {it.points.map((p) => (
                  <dl key={p.text} className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 rounded bg-muted p-3">
                    <dt className="text-muted-foreground">指摘表現</dt>
                    <dd lang="ja">「{p.text}」</dd>
                    <dt className="text-muted-foreground">理由 (韓国語)</dt>
                    <dd>{p.reason}</dd>
                    <dt className="text-muted-foreground">根拠</dt>
                    <dd>{p.basis}</dd>
                    {p.alternatives.length > 0 && (
                      <>
                        <dt className="text-muted-foreground">代替案</dt>
                        <dd>
                          <ul className="space-y-1">
                            {p.alternatives.map((a) => (
                              <li key={a.ja}>
                                <span lang="ja">{a.ja}</span>
                                {a.ko && <span className="block text-xs text-muted-foreground">{a.ko}</span>}
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    )}
                  </dl>
                ))}
              </li>
            ))}
          </ol>
          <footer className="border-t pt-3 text-xs text-muted-foreground" lang="ja">
            {EXPERT_NOTE_JA}
          </footer>
        </article>
      )}
    </>
  );
}
