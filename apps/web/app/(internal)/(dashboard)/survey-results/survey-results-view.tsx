"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SurveyProductLine, SurveyQuestion, SurveySource, SurveySummary } from "@/lib/schemas/survey";
import {
  AGE_KO,
  AGE_ORDER,
  CONCERN_KO,
  SKIN,
  SOURCE_KO,
  ageRank,
  concernTotals as totalsOf,
  lineName,
  lineReactions,
  pct,
  surveyInsights,
  topConcernByAge,
} from "./survey-insights";

// 공유 링크: 채널별 꼬리표(?src=). 마지막 줄은 꼬리표 없는 기본 링크
const SOURCE_LINKS: { key: SurveySource | null; label: string }[] = [
  ...(["qoo10", "rakuten", "instagram", "x", "line"] as const).map((key) => ({ key, label: SOURCE_KO[key] })),
  { key: null, label: "기본 (경로를 묻는 링크)" },
];

const TABS = [
  { key: "summary", label: "요약" },
  { key: "channel", label: "채널" },
  { key: "skin", label: "피부타입 · 고민" },
  { key: "product", label: "제품 · 알림" },
  { key: "all", label: "전체 응답" },
] as const;
type Tab = (typeof TABS)[number]["key"];

// 연령대 세로 막대 아래 짧은 이름
const AGE_SHORT: Record<string, string> = { ...AGE_KO, "50plus": "50대+" };

export function SurveyResultsView({
  summary,
  questions,
  lines,
}: {
  summary: SurveySummary;
  questions: SurveyQuestion[];
  lines: SurveyProductLine[];
}) {
  const [tab, setTab] = useState<Tab>("summary");
  const [copied, setCopied] = useState<string | null>(null);
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  // 서버에서 집계를 다시 읽는다 (새로 들어온 응답 반영). 탭 · 복사 상태는 그대로 둔다
  function refresh() {
    startRefresh(() => {
      router.refresh();
      setRefreshedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    });
  }

  const concernKeys = questions.find((q) => q.id === "concerns")?.options.map((o) => o.value) ?? Object.keys(CONCERN_KO);
  const concernTotals = totalsOf(summary, concernKeys);
  const bySkin = summary.by_skin_type.toSorted((a, b) => b.count - a.count);
  const bySource = summary.by_source.toSorted((a, b) => b.count - a.count);
  const byAge = (summary.by_age ?? []).toSorted((a, b) => ageRank(a.age_group) - ageRank(b.age_group));
  const ageRows = summary.age_by_concern.toSorted((a, b) => ageRank(a.age_group) - ageRank(b.age_group));
  const reactions = lineReactions(summary, lines);
  const insights = surveyInsights(summary, lines, concernKeys);
  const topType = bySkin[0];
  const topConcern = concernTotals[0];
  const cellMax = Math.max(1, ...summary.age_by_concern.flatMap((row) => Object.values(row.counts)));
  const normalCount = summary.by_skin_type.find((s) => s.skin_type === "normal")?.count ?? 0;
  const normalLines = lines.filter((l) => l.for_types.includes("normal")).map((l) => lineName(l, l.id));
  const concernTop3 = concernTotals.filter((c) => c.key !== "other").slice(0, 3);
  const topAge = byAge.toSorted((a, b) => b.count - a.count)[0];
  // 판매 중 → 개발 중, 그 안에서는 추천 본 사람이 많은 순
  const sortedReactions = reactions.toSorted((a, b) => Number(b.onSale) - Number(a.onSale) || b.shown - a.shown);
  const rate = (r: (typeof reactions)[number]) => (r.reacted === null || !r.shown ? -1 : r.reacted / r.shown);
  const topReaction = reactions.filter((r) => r.reacted !== null && r.shown > 0).toSorted((a, b) => rate(b) - rate(a))[0];
  const share = (n: number) => pct(n, summary.total);
  // 클릭 · 알림 숫자가 없으면(DB 모드) "—"
  const countOr = (n: number | undefined, unit: string) => (n === undefined ? "—" : `${n}${unit}`);

  const stats = [
    { label: "총 응답", value: `${summary.total}건`, sub: `18세 이상 · 동의한 응답 · 18세 미만 ${summary.under18_count}명 별도` },
    { label: "최근 7일", value: `${summary.recent_7d}건`, sub: "" },
    { label: "가장 많은 피부타입", value: topType ? SKIN[topType.skin_type].ko : "—", sub: topType ? `${topType.count}건 · ${share(topType.count)}` : "" },
  ];

  async function copyLink(path: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    } catch {
      // 브라우저가 막으면 주소를 직접 복사하도록 둔다
    }
    setCopied(path);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "min-h-9 rounded-md px-4 text-sm",
                tab === t.key ? "bg-background font-semibold shadow-sm" : "text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {refreshedAt && <span className="text-xs text-muted-foreground">{refreshedAt} 갱신</span>}
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} aria-hidden />
            {refreshing ? "불러오는 중" : "새로고침"}
          </Button>
        </div>
      </div>

      {tab === "summary" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{s.value}</p>
                  {s.sub && <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
          {insights.length > 0 && (
            <section className="space-y-3 rounded-xl bg-muted px-6 py-5">
              <h2 className="font-semibold">이번 설문에서 알 수 있는 것</h2>
              <ol className="space-y-3">
                {insights.map((ins, i) => (
                  <li key={ins.headline} className="grid grid-cols-[22px_minmax(0,1fr)] gap-y-0.5">
                    <span className="font-semibold text-muted-foreground">{i + 1}.</span>
                    <p className="font-semibold leading-relaxed">{ins.headline}</p>
                    <p className="col-start-2 text-sm leading-relaxed text-muted-foreground">{ins.evidence}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <Card>
            <CardHeader>
              <CardTitle>
                한눈에 보기{" "}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {summary.period && `기간 ${summary.period.from} ~ ${summary.period.to.slice(5)} · `}응답 {summary.total}건
                </span>
              </CardTitle>
            </CardHeader>
            {/* 칸마다 큰 숫자(1위) 하나 + 막대. 1위만 진하게 칠한다 */}
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Tile title="피부타입" note={`민감 경향 ${summary.sensitive_count}명 · ${share(summary.sensitive_count)}`}>
                {topType && <Hero value={share(topType.count)} label={SKIN[topType.skin_type].ko} />}
                <HBars items={bySkin.map((s) => ({ label: SKIN[s.skin_type].ko, value: s.count }))} total={summary.total} unit="명" />
              </Tile>
              <Tile title="고민 TOP 3" note="복수 선택">
                {concernTop3[0] && <Hero value={share(concernTop3[0].count)} label={CONCERN_KO[concernTop3[0].key] ?? concernTop3[0].key} />}
                <HBars items={concernTop3.map((c) => ({ label: CONCERN_KO[c.key] ?? c.key, value: c.count }))} total={summary.total} unit="명" />
                <p className="text-xs leading-relaxed text-muted-foreground">연령대별 1위: {topConcernByAge(summary)}</p>
              </Tile>
              <Tile title="라인별 반응" note="추천 본 사람 중">
                {topReaction && (
                  <Hero value={pct(topReaction.reacted ?? 0, topReaction.shown)} label={`${topReaction.name} ${topReaction.onSale ? "구매 클릭" : "출시 알림"}`} />
                )}
                <div className="flex flex-col gap-2.5">
                  {sortedReactions.map((r) => (
                    <div key={r.id} className="grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-2.5 text-[13px]">
                      <span>
                        {r.name}
                        <small className="block text-[11.5px] text-muted-foreground">
                          {r.onSale ? "판매 중 · 구매 클릭" : "개발 중 · 출시 알림"}
                        </small>
                      </span>
                      <Track ratio={r.reacted === null || !r.shown ? 0 : r.reacted / r.shown} strong />
                      <span className="text-right font-semibold tabular-nums">{r.reacted === null ? "—" : pct(r.reacted, r.shown)}</span>
                    </div>
                  ))}
                </div>
              </Tile>
              <Tile title="채널 TOP 3" note="응답 수">
                {bySource[0] && <Hero value={share(bySource[0].count)} label={SOURCE_KO[bySource[0].source]} />}
                <HBars items={bySource.slice(0, 3).map((s) => ({ label: SOURCE_KO[s.source], value: s.count }))} total={summary.total} unit="건" />
                {bySource[0] && (bySource[0].clicks !== undefined || bySource[0].notify !== undefined) && (
                  <p className="text-xs text-muted-foreground">
                    {SOURCE_KO[bySource[0].source]} 구매 클릭 {countOr(bySource[0].clicks, "회")} · 출시 알림 {countOr(bySource[0].notify, "명")}
                  </p>
                )}
              </Tile>
              {byAge.length > 0 && (
                <Tile title="연령대" note={summary.under18_count > 0 ? `18세 미만 ${summary.under18_count}명은 수만` : undefined}>
                  {topAge && <Hero value={share(topAge.count)} label={AGE_KO[topAge.age_group] ?? topAge.age_group} />}
                  <AgeColumns items={byAge.map((a) => ({ label: AGE_SHORT[a.age_group] ?? a.age_group, value: a.count }))} />
                </Tile>
              )}
              {summary.concern_other.length > 0 && (
                <Tile title="'기타' 고민" note={`직접 입력 ${summary.concern_other.length}건 중 ${Math.min(5, summary.concern_other.length)}건`}>
                  <ul className="flex flex-col gap-2">
                    {summary.concern_other.slice(0, 5).map((o) => (
                      <li key={`${o.date}-${o.text_ja}`}>
                        <JaKo ja={o.text_ja} ko={o.text_ko} />
                      </li>
                    ))}
                  </ul>
                </Tile>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === "channel" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>채널 성과</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>유입 경로</TableHead>
                    <TableHead className="text-right">응답</TableHead>
                    <TableHead>가장 많은 피부타입</TableHead>
                    <TableHead className="text-right">구매하기 클릭</TableHead>
                    <TableHead className="text-right">출시 알림 신청</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bySource.map((s) => (
                    <TableRow key={s.source}>
                      <TableCell className="font-medium">{SOURCE_KO[s.source]}</TableCell>
                      <TableCell className="text-right">
                        {s.count}건 <span className="text-muted-foreground">({share(s.count)})</span>
                      </TableCell>
                      <TableCell>{s.top_skin_type ? `${SKIN[s.top_skin_type].ko} ${s.top_skin_count ?? 0}명` : "—"}</TableCell>
                      <TableCell className="text-right">{countOr(s.clicks, "회")}</TableCell>
                      <TableCell className="text-right">{countOr(s.notify, "명")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">
                구매하기 클릭 · 출시 알림 신청은 결과 화면에서 추천을 본 뒤의 반응입니다. &apos;기타&apos;는 응답자가 직접 적은 경로입니다.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>채널별 공유 링크</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                채널마다 다른 링크를 쓰면 유입 경로가 자동으로 기록됩니다. 꼬리표 없는 링크로 들어오면 결과를 보기 전에 경로를 묻습니다.
              </p>
              <Table>
                <TableBody>
                  {SOURCE_LINKS.map((s) => {
                    const path = s.key ? `/survey?src=${s.key}` : "/survey";
                    return (
                      <TableRow key={path}>
                        <TableCell className="font-medium">{s.label}</TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 text-xs">{path}</code>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => copyLink(path)}>
                            {copied === path ? "복사됨" : "복사"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {tab === "skin" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>피부타입 분포</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topType && <Hero value={share(topType.count)} label={SKIN[topType.skin_type].ko} />}
              <HBars items={bySkin.map((s) => ({ label: SKIN[s.skin_type].ko, value: s.count }))} total={summary.total} unit="명" />
              <div className="border-t pt-3">
                <HBars items={[{ label: "민감 경향", value: summary.sensitive_count }]} total={summary.total} unit="명" muted />
              </div>
              <p className="text-xs text-muted-foreground">민감 경향은 피부타입과 따로 판정해요. 어느 피부타입에도 함께 나올 수 있어요.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>신경 쓰이는 피부 고민</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topConcern && <Hero value={share(topConcern.count)} label={CONCERN_KO[topConcern.key] ?? topConcern.key} />}
              <HBars items={concernTotals.map((c) => ({ label: CONCERN_KO[c.key] ?? c.key, value: c.count }))} total={summary.total} unit="명" />
              <p className="text-xs text-muted-foreground">복수 선택이라 %를 더하면 100%가 넘어요. %는 응답 {summary.total}건 중 고른 사람의 비율이에요.</p>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>연령대 × 피부 고민</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>연령대</TableHead>
                    {concernKeys.map((k) => (
                      <TableHead key={k} className="text-center">
                        {CONCERN_KO[k] ?? k}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ageRows.map((row) => (
                    <TableRow key={row.age_group}>
                      <TableCell>{AGE_KO[row.age_group] ?? row.age_group}</TableCell>
                      {concernKeys.map((k) => {
                        const v = row.counts[k] ?? 0;
                        return (
                          // 칸 진하기는 값 비율이라 인라인 스타일이 불가피하다
                          <TableCell
                            key={k}
                            className="text-center"
                            style={{ backgroundColor: `color-mix(in oklch, var(--chart-2) ${Math.round((v / cellMax) * 45)}%, transparent)` }}
                          >
                            {v}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-muted-foreground">칸이 진할수록 그 고민을 고른 사람이 많습니다.</p>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>&apos;기타&apos; 직접 입력</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {summary.concern_other.map((o) => (
                  <li key={`${o.date}-${o.text_ja}`} className="flex justify-between gap-4 py-2">
                    <JaKo ja={o.text_ja} ko={o.text_ko} />
                    <span className="text-xs text-muted-foreground">{o.date}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "product" && (
        <Card>
          <CardHeader>
            <CardTitle>제품 추천 · 출시 알림</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              결과 화면에서 추천을 본 사람과 반응 수입니다. 출시 알림 수는 개발 중인 라인의 수요를 보여 줍니다. 연락처는 따로 저장되어 이
              화면에는 숫자만 나옵니다.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>라인</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>추천 대상</TableHead>
                  <TableHead className="text-right">추천 본 사람</TableHead>
                  <TableHead>반응률</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedReactions.map((r) => {
                  const p = summary.product_lines.find((x) => x.line_id === r.id);
                  const line = lines.find((l) => l.id === r.id);
                  // 신청 수(이메일 · LINE)가 없으면(DB 모드) 알림 화면을 연 사람 수로 본다
                  const signedUp = p?.notify_email !== undefined || p?.notify_line !== undefined;
                  const detail = r.onSale
                    ? `구매하기 클릭 ${p?.clicks ?? 0}회`
                    : signedUp
                      ? `출시 알림 ${r.reacted ?? 0}명 (이메일 ${p?.notify_email ?? 0} · LINE ${p?.notify_line ?? 0})`
                      : `출시 알림 화면 연 사람 ${r.reacted ?? 0}명`;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="py-3">
                        <span className="block font-semibold">{lineName(line, r.id)}</span>
                        {line?.products_label && <span className="block text-xs text-muted-foreground">{line.products_label}</span>}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant={r.onSale ? "default" : "secondary"}>{r.onSale ? "판매 중" : "개발 중"}</Badge>
                      </TableCell>
                      <TableCell className="py-3">{line?.for_types.map((t) => SKIN[t].ko).join(", ")}</TableCell>
                      <TableCell className="py-3 text-right">{r.shown}명</TableCell>
                      <TableCell className="py-3">
                        <div className="grid w-56 grid-cols-[minmax(0,1fr)_3.2rem] items-center gap-2.5">
                          <Track ratio={r.shown ? (r.reacted ?? 0) / r.shown : 0} strong />
                          <span className="text-right font-semibold tabular-nums">{r.shown ? pct(r.reacted ?? 0, r.shown) : "—"}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{detail}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">
              판매 중 → 개발 중, 그 안에서는 추천 본 사람이 많은 순. 한 사람에게 여러 라인을 함께 추천하므로 &apos;추천 본 사람&apos;의 합은 응답
              수보다 많습니다. 예: 중성 결과({normalCount}명)에는 {normalLines.join(", ")}을 함께 추천합니다.
            </p>
          </CardContent>
        </Card>
      )}

      {tab === "all" && <AllResponses responses={summary.responses} concernKeys={concernKeys} />}

    </div>
  );
}

function Tile({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border px-[18px] py-4">
      <h3 className="flex justify-between gap-2 text-[13px] font-medium text-muted-foreground">
        {title} {note && <span>{note}</span>}
      </h3>
      {children}
    </section>
  );
}

/** 칸의 1위: 큰 비율 + 이름 */
function Hero({ value, label }: { value: string; label: string }) {
  return (
    <p className="flex items-baseline gap-2">
      <b className="text-[26px] font-bold tabular-nums">{value}</b>
      <span className="text-sm font-semibold">{label}</span>
    </p>
  );
}

// 막대 길이는 값 비율이라 인라인 스타일이 불가피하다
function Track({ ratio, strong }: { ratio: number; strong?: boolean }) {
  return (
    <span className="block h-2.5 overflow-hidden rounded-full bg-muted">
      <span
        className={cn("block h-full rounded-full", strong ? "bg-primary" : "bg-neutral-400 dark:bg-neutral-500")}
        style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
      />
    </span>
  );
}

/** 가로 막대 목록. 막대 길이는 1위 대비, 숫자는 "N명 · 전체 대비 %". 첫 줄(1위)만 진하게 */
function HBars({
  items,
  total,
  unit,
  muted,
}: {
  items: { label: string; value: number }[];
  total: number;
  unit: string;
  muted?: boolean;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-2 text-[13px]">
      {items.map((item, i) => {
        const top = i === 0 && !muted;
        return (
          <li key={item.label} className={cn("grid grid-cols-[6.5rem_minmax(0,1fr)_5.5rem] items-center gap-2.5", top && "font-semibold")}>
            <span>{item.label}</span>
            <Track ratio={muted ? item.value / Math.max(1, total) : item.value / max} strong={top} />
            <span className={cn("text-right tabular-nums", top ? "text-foreground" : "text-muted-foreground")}>
              {item.value}
              {unit} · {pct(item.value, total)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** 연령대 세로 막대. 가장 많은 연령대만 진하게 */
function AgeColumns({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="grid h-[120px] items-end gap-2.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => (
        <div key={item.label} className="flex h-full flex-col items-center justify-end gap-1 text-xs">
          <span className="font-semibold tabular-nums">{item.value}</span>
          <span
            className={cn("w-full max-w-[38px] rounded-t-md", item.value === max ? "bg-primary" : "bg-neutral-400 dark:bg-neutral-500")}
            style={{ height: `${Math.round((item.value / max) * 85)}%` }}
          />
          <span className="whitespace-nowrap text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/** '기타' 직접 입력: 일본어 원문 아래 연한 한국어. 번역 전이면 일본어만 */
function JaKo({ ja, ko }: { ja: string; ko?: string | null }) {
  return (
    <span className="flex flex-col gap-px text-[13px]">
      <span lang="ja">{ja}</span>
      {ko && <span className="text-xs text-muted-foreground">{ko}</span>}
    </span>
  );
}

const PAGE_SIZE = 15;
const selectClass = "h-9 rounded-md border bg-background px-2.5 text-[13px]";

/** 전체 응답: 15건씩 넘기기 + 필터 (피부타입 · 연령대 · 유입 경로 · 고민 · 민감 경향) */
function AllResponses({ responses, concernKeys }: { responses: SurveySummary["responses"]; concernKeys: string[] }) {
  const empty = { skin: "", age: "", source: "", concern: "", sensitive: false };
  const [filter, setFilter] = useState(empty);
  const [page, setPage] = useState(1);
  const update = (patch: Partial<typeof empty>) => {
    setFilter((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const list = responses
    .toSorted((a, b) => b.at.localeCompare(a.at))
    .filter(
      (r) =>
        (!filter.skin || r.skin_type === filter.skin) &&
        (!filter.age || r.age_group === filter.age) &&
        (!filter.source || (r.source ?? "") === filter.source) &&
        (!filter.concern || r.concerns.includes(filter.concern)) &&
        (!filter.sensitive || r.is_sensitive),
    );
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  // 쪽 번호는 지금 쪽 앞뒤로 최대 7개
  const first = Math.max(1, Math.min(current - 3, pages - 6));
  const numbers = Array.from({ length: Math.min(7, pages) }, (_, i) => first + i);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3">
          전체 응답
          <span className="text-xs font-normal text-muted-foreground">
            {responses.length}건 중 {list.length}건
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="피부타입" className={selectClass} value={filter.skin} onChange={(e) => update({ skin: e.target.value })}>
            <option value="">피부타입 전체</option>
            {Object.entries(SKIN).map(([k, v]) => (
              <option key={k} value={k}>
                {v.ko}
              </option>
            ))}
          </select>
          <select aria-label="연령대" className={selectClass} value={filter.age} onChange={(e) => update({ age: e.target.value })}>
            <option value="">연령대 전체</option>
            {AGE_ORDER.map((k) => (
              <option key={k} value={k}>
                {AGE_KO[k]}
              </option>
            ))}
          </select>
          <select aria-label="유입 경로" className={selectClass} value={filter.source} onChange={(e) => update({ source: e.target.value })}>
            <option value="">유입 경로 전체</option>
            {Object.entries(SOURCE_KO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select aria-label="고민" className={selectClass} value={filter.concern} onChange={(e) => update({ concern: e.target.value })}>
            <option value="">고민 전체</option>
            {concernKeys.map((k) => (
              <option key={k} value={k}>
                {CONCERN_KO[k] ?? k}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-[13px]">
            <Checkbox checked={filter.sensitive} onCheckedChange={(v) => update({ sensitive: v === true })} />
            민감 경향만
          </label>
          <Button variant="outline" size="sm" onClick={() => update(empty)}>
            필터 지우기
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>응답 시각</TableHead>
              <TableHead>연령대</TableHead>
              <TableHead>피부타입</TableHead>
              <TableHead>민감</TableHead>
              <TableHead>고민</TableHead>
              <TableHead>&apos;기타&apos; 입력</TableHead>
              <TableHead>유입 경로</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={`${r.at}-${i}`}>
                <TableCell className="whitespace-nowrap">{`${r.at.slice(0, 10)} ${r.at.slice(11, 16)}`}</TableCell>
                <TableCell className="whitespace-nowrap">{AGE_KO[r.age_group] ?? r.age_group}</TableCell>
                <TableCell className="whitespace-nowrap">{SKIN[r.skin_type].ko}</TableCell>
                <TableCell>{r.is_sensitive ? "있음" : "—"}</TableCell>
                <TableCell>{r.concerns.map((c) => CONCERN_KO[c] ?? c).join(", ")}</TableCell>
                <TableCell className="whitespace-normal">{r.concern_other ? <JaKo ja={r.concern_other} ko={r.concern_other_ko} /> : "—"}</TableCell>
                <TableCell>{r.source ? SOURCE_KO[r.source] : "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-xs text-muted-foreground">
                  조건에 맞는 응답이 없어요.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted-foreground">
          <span>
            {list.length > 0 && `${(current - 1) * PAGE_SIZE + 1}–${(current - 1) * PAGE_SIZE + rows.length} / ${list.length}건`}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" aria-label="이전 쪽" disabled={current === 1} onClick={() => setPage(current - 1)}>
              ‹
            </Button>
            {numbers.map((n) => (
              <Button
                key={n}
                variant={n === current ? "default" : "outline"}
                size="icon-sm"
                aria-current={n === current ? "page" : undefined}
                onClick={() => setPage(n)}
              >
                {n}
              </Button>
            ))}
            <Button variant="outline" size="icon-sm" aria-label="다음 쪽" disabled={current === pages} onClick={() => setPage(current + 1)}>
              ›
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
