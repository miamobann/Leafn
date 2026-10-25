"use client";

import { useState, type ReactNode } from "react";
import { BarList } from "@/components/templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SurveyProductLine, SurveyQuestion, SurveySource, SurveySummary } from "@/lib/schemas/survey";
import {
  AGE_KO,
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
  { key: "recent", label: "최근 응답" },
] as const;
type Tab = (typeof TABS)[number]["key"];

// 설문 테이블 합의 전 제안안 (docs/db-frame.md "소비자 설문"과 함께 확정)
// "최근 응답"은 기간이 아니라 최신 건수로 보여 준다. 응답이 뜸해도 비지 않고, 방금 들어온 응답을 바로 확인할 수 있다
const RECENT_LIMIT = 10;

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
  const recent = summary.recent.toSorted((a, b) => b.at.localeCompare(a.at)).slice(0, RECENT_LIMIT);
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
            <CardContent className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
              <GlanceSection title="피부타입">
                <MiniTable
                  rows={[
                    ...bySkin.map((s) => [SKIN[s.skin_type].ko, `${s.count}명`, share(s.count)]),
                    ["민감 경향", `${summary.sensitive_count}명`, share(summary.sensitive_count)],
                  ]}
                  mutedLast
                />
              </GlanceSection>
              <GlanceSection title="고민 TOP 3" note="(복수 선택)">
                <MiniTable rows={concernTotals.filter((c) => c.key !== "other").slice(0, 3).map((c) => [CONCERN_KO[c.key] ?? c.key, `${c.count}명`, share(c.count)])} />
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">연령대별 1위: {topConcernByAge(summary)}</p>
              </GlanceSection>
              <GlanceSection title="라인별 반응">
                <MiniTable
                  head={["라인", "추천 본 사람", "반응"]}
                  rows={reactions.map((r) => [
                    <>
                      {r.name} <span className="text-muted-foreground">{r.onSale ? "판매 중" : "개발 중"}</span>
                    </>,
                    `${r.shown}명`,
                    `${r.onSale ? "구매 클릭" : "출시 알림"} ${r.reacted === null ? "—" : pct(r.reacted, r.shown)}`,
                  ])}
                />
              </GlanceSection>
              <GlanceSection title="채널 TOP 3">
                <MiniTable
                  head={["채널", "응답", "구매 클릭", "출시 알림"]}
                  rows={bySource.slice(0, 3).map((s) => [SOURCE_KO[s.source], `${s.count}건`, countOr(s.clicks, "회"), countOr(s.notify, "명")])}
                />
              </GlanceSection>
              {byAge.length > 0 && (
                <GlanceSection title="연령대">
                  <MiniTable rows={byAge.map((a) => [AGE_KO[a.age_group] ?? a.age_group, `${a.count}명`, share(a.count)])} />
                  {summary.under18_count > 0 && (
                    <p className="mt-1.5 text-xs text-muted-foreground">18세 미만 {summary.under18_count}명은 답을 저장하지 않고 수만 셌어요.</p>
                  )}
                </GlanceSection>
              )}
              {summary.concern_other.length > 0 && (
                <GlanceSection title={`'기타' 고민 (직접 입력 ${summary.concern_other.length}건 중)`}>
                  <ul className="list-disc space-y-1 pl-4 text-sm">
                    {summary.concern_other.slice(0, 5).map((o) => (
                      <li key={`${o.date}-${o.text_ja}`}>{o.text_ko || o.text_ja}</li>
                    ))}
                  </ul>
                </GlanceSection>
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
              <BarList items={bySkin.map((s) => ({ label: SKIN[s.skin_type].ko, value: s.count }))} />
              <p className="text-xs text-muted-foreground">
                민감 경향은 피부타입과 함께 따로 표시됩니다. {summary.total}건 중 {summary.sensitive_count}건.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>신경 쓰이는 피부 고민</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <BarList items={concernTotals.map((c) => ({ label: CONCERN_KO[c.key] ?? c.key, value: c.count }))} />
              <p className="text-xs text-muted-foreground">복수 선택이라 합계가 응답 수보다 많습니다. 가장 많은 고민: {topConcern ? CONCERN_KO[topConcern.key] : "—"}</p>
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
                    <span>
                      {o.text_ja} {o.text_ko && <span className="text-muted-foreground">({o.text_ko})</span>}
                    </span>
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
              결과 화면에서 추천을 본 사람과 반응 수입니다. 출시 알림 신청 수는 개발 중인 라인의 수요를 보여 줍니다. 연락처는 따로
              저장되어 이 화면에는 숫자만 나옵니다.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>라인</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>추천 대상</TableHead>
                  <TableHead className="text-right">추천 본 사람</TableHead>
                  <TableHead>반응</TableHead>
                  <TableHead className="text-right">반응률</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.product_lines.map((p) => {
                  const line = lines.find((l) => l.id === p.line_id);
                  const notify = (p.notify_email ?? 0) + (p.notify_line ?? 0);
                  const reacted = line?.status === "on_sale" ? (p.clicks ?? 0) : notify;
                  return (
                    <TableRow key={p.line_id}>
                      <TableCell>
                        <span className="font-medium">{lineName(line, p.line_id)}</span>
                        {line?.products_label && <span className="block text-xs text-muted-foreground">{line.products_label}</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={line?.status === "on_sale" ? "default" : "secondary"}>
                          {line?.status === "on_sale" ? "판매 중" : "개발 중"}
                        </Badge>
                      </TableCell>
                      <TableCell>{line?.for_types.map((t) => SKIN[t].ko).join(", ")}</TableCell>
                      <TableCell className="text-right">{p.shown}명</TableCell>
                      <TableCell>
                        {line?.status === "on_sale"
                          ? `구매하기 클릭 ${p.clicks ?? 0}회`
                          : `출시 알림 ${notify}명 (이메일 ${p.notify_email ?? 0} · LINE ${p.notify_line ?? 0})`}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {p.shown ? `${Math.round((reacted / p.shown) * 100)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">
              한 사람에게 여러 라인을 함께 추천하므로 &apos;추천 본 사람&apos;의 합은 응답 수보다 많습니다. 예: 중성 결과({normalCount}명)에는{" "}
              {normalLines.join(", ")}을 함께 추천합니다.
            </p>
          </CardContent>
        </Card>
      )}

      {tab === "recent" && (
        <Card>
          <CardHeader>
            <CardTitle>최근 응답 (최신 {RECENT_LIMIT}건까지)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>응답 시각</TableHead>
                  <TableHead>연령대</TableHead>
                  <TableHead>피부타입</TableHead>
                  <TableHead>민감</TableHead>
                  <TableHead>고민</TableHead>
                  <TableHead>유입 경로</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r) => (
                  <TableRow key={r.at}>
                    <TableCell className="whitespace-nowrap">{`${r.at.slice(0, 10)} ${r.at.slice(11, 16)}`}</TableCell>
                    <TableCell>{AGE_KO[r.age_group] ?? r.age_group}</TableCell>
                    <TableCell>{SKIN[r.skin_type].ko}</TableCell>
                    <TableCell>{r.is_sensitive ? "있음" : "—"}</TableCell>
                    <TableCell>{r.concerns.map((c) => CONCERN_KO[c] ?? c).join(", ")}</TableCell>
                    <TableCell>{r.source ? SOURCE_KO[r.source] : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

function GlanceSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">
        {title} {note && <span className="font-normal text-muted-foreground">{note}</span>}
      </h3>
      {children}
    </section>
  );
}

// 한눈에 보기의 작은 표: 첫 칸은 왼쪽, 나머지는 오른쪽 정렬
function MiniTable({ head, rows, mutedLast }: { head?: string[]; rows: ReactNode[][]; mutedLast?: boolean }) {
  return (
    <table className="w-full text-[13px] tabular-nums">
      {head && (
        <thead>
          <tr className="border-b text-[11px] text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} className={cn("py-1 font-medium", i === 0 ? "text-left" : "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className={cn("border-b", mutedLast && r === rows.length - 1 && "text-muted-foreground")}>
            {row.map((cell, i) => (
              <td key={i} className={cn("py-1.5", i === 0 ? "text-left" : "text-right")}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
