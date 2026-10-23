"use client";

import Link from "next/link";
import { useState } from "react";
import { BarList } from "@/components/templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SkinType, SurveyProductLine, SurveyQuestion, SurveySource, SurveySummary } from "@/lib/schemas/survey";

const SKIN: Record<SkinType, { ko: string; ja: string }> = {
  dry: { ko: "건성", ja: "乾燥肌" },
  oily: { ko: "지성", ja: "脂性肌" },
  combo: { ko: "복합성", ja: "混合肌" },
  inner_dry: { ko: "복합성(속건조)", ja: "インナードライ" },
  normal: { ko: "중성", ja: "普通肌" },
};
const AGE_KO: Record<string, string> = {
  under18: "17세 이하",
  "18-19": "18~19세",
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
  "50plus": "50대 이상",
};
const CONCERN_KO: Record<string, string> = {
  dryness: "건조·당김",
  shine: "번들거림·모공",
  acne: "여드름·트러블",
  dullness: "칙칙함",
  redness: "붉어짐·자극",
  firmness: "탄력·잔주름",
  other: "기타",
};

const SOURCE_KO: Record<SurveySource, string> = {
  instagram: "Instagram",
  x: "X",
  line: "LINE",
  rakuten: "라쿠텐",
  qoo10: "Qoo10",
  friend: "지인 소개",
  search: "검색",
  other: "기타",
};
// 공유 링크: 채널별 꼬리표(?src=). 마지막 줄은 꼬리표 없는 기본 링크
const SOURCE_LINKS: { key: SurveySource | null; label: string }[] = [
  ...(["rakuten", "qoo10", "instagram", "x", "line"] as const).map((key) => ({ key, label: SOURCE_KO[key] })),
  { key: null, label: "기본 (경로를 묻는 링크)" },
];

const TABS = [
  { key: "summary", label: "요약" },
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
  const concernTotals = concernKeys.map((key) => ({
    key,
    count: summary.age_by_concern.reduce((sum, row) => sum + (row.counts[key] ?? 0), 0),
  }));
  const topType = summary.by_skin_type.toSorted((a, b) => b.count - a.count)[0];
  const topConcern = concernTotals.toSorted((a, b) => b.count - a.count)[0];
  const cellMax = Math.max(1, ...summary.age_by_concern.flatMap((row) => Object.values(row.counts)));
  const normalCount = summary.by_skin_type.find((s) => s.skin_type === "normal")?.count ?? 0;
  const recent = summary.recent.toSorted((a, b) => b.at.localeCompare(a.at)).slice(0, RECENT_LIMIT);
  const share = (n: number) => `${Math.round((n / summary.total) * 100)}%`;

  const stats = [
    { label: "총 응답", value: `${summary.total}건`, sub: "18세 이상 · 동의한 응답" },
    { label: "최근 7일", value: `${summary.recent_7d}건`, sub: "" },
    { label: "가장 많은 피부타입", value: topType ? SKIN[topType.skin_type].ko : "—", sub: topType ? `${topType.count}건 · ${share(topType.count)}` : "" },
    { label: "민감 경향 있음", value: `${summary.sensitive_count}건`, sub: `피부타입과 별도 표시 · ${share(summary.sensitive_count)}` },
    { label: "18세 미만 참여", value: `${summary.under18_count}건`, sub: "숫자만 기록 · 총 응답에 미포함" },
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
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
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>채널별 공유 링크</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  채널마다 다른 링크를 쓰면 유입 경로가 자동으로 기록됩니다. 꼬리표 없는 링크로 들어오면 설문 시작 전에 경로를 묻습니다.
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
                <Link href="/survey" target="_blank" className="inline-block text-sm underline-offset-4 hover:underline">
                  공개 설문 열기 ↗
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>유입 경로</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <BarList items={summary.by_source.map((s) => ({ label: SOURCE_KO[s.source], value: s.count }))} />
                <p className="text-xs text-muted-foreground">링크 꼬리표 또는 시작 전 선택 기준. &apos;기타&apos;는 응답자가 직접 적은 내용입니다.</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {tab === "skin" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>피부타입 분포</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <BarList items={summary.by_skin_type.map((s) => ({ label: SKIN[s.skin_type].ko, value: s.count }))} />
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
              <BarList items={concernTotals.toSorted((a, b) => b.count - a.count).map((c) => ({ label: CONCERN_KO[c.key] ?? c.key, value: c.count }))} />
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
                  {summary.age_by_concern.map((row) => (
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
                      {o.text_ja} <span className="text-muted-foreground">({o.text_ko})</span>
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
                  <TableHead>라인 (가칭)</TableHead>
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
                      <TableCell className="font-medium">{line?.name_ko ?? p.line_id}</TableCell>
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
              모이스처 스킨 · 에센스는 같은 사람에게 함께 추천되므로 한 줄로 셉니다. 중성 결과({normalCount}명)에는 모이스처 스킨과 지성 라인(출시
              알림)을 추천합니다. 실제 수치는 survey_reco_events 기록이 연결되면 보입니다.
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
                  <TableHead>동의 문구</TableHead>
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
                    <TableCell>{r.consent_version}</TableCell>
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
