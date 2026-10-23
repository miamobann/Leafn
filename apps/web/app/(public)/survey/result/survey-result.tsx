"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Scores, SkinType, SurveyProductLine, SurveyQuestion } from "@/lib/schemas/survey";
import { calcScores, isUnder18, judge, maxScores } from "@/lib/survey/judge";
import { clearSession, parseSession, readSessionRaw, subscribeSession } from "../_lib/session";
import { trackReco } from "../_lib/submit";

// 일본어 문구는 원어민 검수 전. 결과 · 추천 문구는 약기법 기준 자료(knowledge/yakkiho)와 대조해 고침 (2026-10-23, 법률 판정 아님)
const TYPES: Record<SkinType, { name: string; desc: string; reason: string; tips: string[] }> = {
  dry: {
    name: "乾燥肌",
    desc: "皮脂も水分も少なめで、つっぱりや粉ふきが起こりやすいタイプです。",
    reason: "皮脂は少なく、乾燥のスコアが高いため、乾燥肌と判定しました。",
    tips: ["洗顔はぬるま湯でやさしく短めに", "洗顔後はすぐに化粧水と乳液でうるおいを与える", "エアコンの効いた室内や冬は保湿をていねいに"],
  },
  oily: {
    name: "脂性肌",
    desc: "顔全体に皮脂が多く、テカリや毛穴が気になりやすいタイプです。",
    reason: "頬まで皮脂が多く、乾燥のスコアは低いため、脂性肌と判定しました。",
    tips: ["朝晩の洗顔で余分な皮脂を落とす", "さっぱりした使い心地の保湿アイテムを選ぶ", "皮脂が多くても保湿は欠かさずに"],
  },
  combo: {
    name: "混合肌",
    desc: "Tゾーンはテカりやすく、頬はテカりにくいタイプです。",
    reason: "Tゾーンの皮脂は多く、頬の皮脂は少ないため、混合肌と判定しました。",
    tips: ["部位ごとに保湿の量を変える", "Tゾーンは軽めに、頬はしっかり保湿", "季節に合わせてアイテムを見直す"],
  },
  inner_dry: {
    name: "混合肌（インナードライ）",
    desc: "表面はテカるのに内側は乾燥しているタイプです。乾燥によって皮脂が多く出ることもあります。",
    reason: "頬まで皮脂が多く、乾燥のスコアも高いため、混合肌（インナードライ）と判定しました。",
    tips: ["皮脂をふき取るより、まず保湿を", "みずみずしい軽めの保湿アイテムを数回に分けて重ねる", "洗顔をしすぎない"],
  },
  normal: {
    name: "普通肌",
    desc: "水分と皮脂のバランスがとれたタイプです。",
    reason: "Tゾーン・頬の皮脂と乾燥のスコアがどれも基準未満のため、普通肌と判定しました。",
    tips: ["今のケアを続ける", "季節の変わり目は肌の変化に気をつける", "紫外線対策を忘れずに"],
  },
};

// MBTI처럼 반대되는 두 성향을 한 막대에 놓고 합 100점으로 나눈다 (팀 결정 2026-10-23)
type Pole = { code: string; label: string };
type Axis = { title: string; left: Pole; right: Pole; leftPoints: (sc: Scores, max: Scores) => number };

// 두 비율을 합 100점으로 나눈다. 둘 다 0이면 50 : 50
function split(a: number, b: number) {
  return a + b === 0 ? 50 : Math.round((a / (a + b)) * 100);
}

const AXES: Axis[] = [
  {
    title: "オイリー型 vs ドライ型",
    left: { code: "O", label: "オイリー" },
    right: { code: "D", label: "ドライ" },
    leftPoints: (sc, max) => split((sc.t + sc.c) / (max.t + max.c || 1), sc.d / (max.d || 1)),
  },
  {
    title: "敏感型 vs 安定型",
    left: { code: "S", label: "敏感" },
    right: { code: "R", label: "安定" },
    leftPoints: (sc, max) => Math.round((sc.s / (max.s || 1)) * 100),
  },
  {
    title: "Tゾーン型 vs 顔全体型（皮脂が出やすい場所）",
    left: { code: "T", label: "Tゾーン" },
    right: { code: "A", label: "顔全体" },
    leftPoints: (sc, max) => split(sc.t / (max.t || 1), sc.c / (max.c || 1)),
  },
];

const COPY = {
  lead: "あなたの肌タイプの目安は",
  sensitiveBadge: "敏感傾向あり",
  sensitiveReason: "敏感のスコアが基準以上のため、「敏感傾向あり」もあわせて表示しています。",
  sensitiveTips: ["新しいアイテムは腕の内側で試してから使う", "洗顔やタオルで肌をこすらない"],
  tabs: { reco: "おすすめ製品", detail: "くわしく", tips: "ケアのポイント" },
  detailTitle: "肌の状態をくわしく見る",
  reasonTitle: "判定の理由",
  points: (n: number) => `${n}点`,
  lean: (label: string) => `${label}寄り`,
  even: "どちらとも言えない",
  tipsTitle: "毎日のケアのポイント",
  concerns: "気になる悩み：",
  recoTitle: "この肌タイプにおすすめのLeaf&製品",
  poster: "広告ポスター（準備中）",
  productImage: "商品画像",
  ingredients: "保湿成分：",
  status: { on_sale: "発売中", in_development: "開発中" },
  buy: "購入する",
  buyDemo: "デモ版のため、実際のショップには移動しません。",
  notifyOpen: "発売のお知らせを受け取る",
  notifyMinor: "18歳未満の方はお申し込みいただけません",
  notifyDone: (via: string) => `発売のお知らせを申し込みました（${via}）`,
  noReco: "この肌タイプのおすすめ製品は準備中です。",
  sensitiveUse: "はじめて使うときは、腕の内側で試してからお使いください。",
  notify: {
    title: (name: string) => `「${name}」発売のお知らせ`,
    method: "お知らせの受け取り方法",
    email: "メール",
    line: "LINE",
    emailLabel: "メールアドレス",
    lineNote:
      "LINEはIDの入力は不要です。ボタンを押すとLeaf&公式アカウントの友だち追加画面が開き、追加が完了するとお知らせの対象として登録されます。（デモ版のため移動しません）",
    consent: "[必須] 新商品の発売案内など、Leaf&からのお知らせ（メール／LINE）の受信に同意します",
    separate: "連絡先は診断の回答とは別に保管し、診断結果とはひも付けません。配信はいつでも停止できます。",
    close: "閉じる",
    submitEmail: "申し込む",
    submitLine: "LINEで友だち追加して申し込む",
  },
  disclaimer: "本診断は、肌タイプに合わせたスキンケアの参考情報を提供するものであり、医師による診断や治療行為に代わるものではありません。",
  savedAdult: "※ 回答内容は個人を特定しない統計情報として安全に保管されます。",
  savedMinor: "※ 18歳未満のご利用であるため、入力された回答はデータベースに保存されておりません。",
  retry: "やり直す",
  missing: "診断の回答が見つかりません。はじめからお試しください。",
  start: "診断をはじめる",
};

type Tab = keyof typeof COPY.tabs;
type Via = "email" | "line";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SurveyResult({ questions, lines }: { questions: SurveyQuestion[]; lines: SurveyProductLine[] }) {
  // 서버 렌더에는 세션이 없으므로 undefined(불러오는 중)로 두고, 브라우저에서 읽는다
  const raw = useSyncExternalStore(subscribeSession, readSessionRaw, () => undefined);
  const [tab, setTab] = useState<Tab>("reco");
  const [bought, setBought] = useState(false);
  const [notifyLine, setNotifyLine] = useState<string | null>(null);
  const [via, setVia] = useState<Via>("email");
  const [email, setEmail] = useState("");
  const [notifyAgree, setNotifyAgree] = useState(false);
  const [done, setDone] = useState<Record<string, Via>>({});

  if (raw === undefined) return null;
  const session = parseSession(raw);
  if (!session) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-dashed p-8 text-center text-sm">
        <p className="text-muted-foreground">{COPY.missing}</p>
        <Link href="/survey" className={buttonVariants()}>
          {COPY.start}
        </Link>
      </div>
    );
  }

  const scores = calcScores(questions, session.answers);
  const max = maxScores(questions);
  const { skinType, isSensitive } = judge(scores);
  const type = TYPES[skinType];
  const under18 = isUnder18(questions, session.answers);
  const recos = lines.filter((l) => l.for_types.includes(skinType));
  const tips = isSensitive ? [...type.tips, ...COPY.sensitiveTips] : type.tips;

  const concernQuestion = questions.find((q) => q.options.some((o) => o.is_other));
  const concernAnswer = concernQuestion ? session.answers[concernQuestion.id] : undefined;
  const concernLabels = (Array.isArray(concernAnswer) ? concernAnswer : [])
    .map((v) => concernQuestion?.options.find((o) => o.value === v))
    .map((o) => (o?.is_other ? `その他（${session.other_text}）` : o?.label_ja))
    .filter(Boolean)
    .join("、");

  const openLine = lines.find((l) => l.id === notifyLine);
  const canSubmit = notifyAgree && (via === "line" || EMAIL_PATTERN.test(email.trim()));

  function openNotify(lineId: string) {
    trackReco({ event: "notify_open", lineId, skinType, under18 });
    setNotifyLine(lineId);
    setEmail("");
    setNotifyAgree(false);
  }

  function submitNotify() {
    if (!notifyLine || !canSubmit) return;
    // 실제로는 설문 응답과 다른 표(출시 알림 신청)에 저장한다. 표 추가는 팀 합의 후
    setDone((prev) => ({ ...prev, [notifyLine]: via }));
    setNotifyLine(null);
  }

  function retry() {
    clearSession();
  }

  // 휴대폰은 탭으로 하나씩, PC(lg 이상)는 세 칸을 나란히
  const panel = (key: Tab) => cn(tab === key ? "block" : "hidden", "lg:block");

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 lg:max-w-none">
      <Card>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{COPY.lead}</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold">{type.name}</h1>
            {isSensitive && <Badge variant="outline">{COPY.sensitiveBadge}</Badge>}
          </div>
          <p className="text-sm leading-relaxed">{type.desc}</p>
        </CardContent>
      </Card>

      <div role="tablist" className="flex gap-1 rounded-lg bg-muted p-1 lg:hidden">
        {(Object.keys(COPY.tabs) as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "min-h-11 flex-1 rounded-md text-sm",
              tab === key ? "bg-background font-semibold shadow-sm" : "text-muted-foreground",
            )}
          >
            {COPY.tabs[key]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <section className={panel("reco")} aria-label={COPY.tabs.reco}>
          <Card>
            <CardContent className="space-y-4">
              <h2 className="font-semibold">{COPY.recoTitle}</h2>
              <TrackShown lineIds={recos.map((l) => l.id)} skinType={skinType} under18={under18} />
              <div
                role="img"
                aria-label={COPY.poster}
                className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed bg-muted text-sm text-muted-foreground"
              >
                {COPY.poster}
              </div>
              {recos.length === 0 && <p className="text-sm text-muted-foreground">{COPY.noReco}</p>}
              {recos.map((line) => (
                <div key={line.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex gap-3">
                    {line.image_path ? (
                      <div className="relative size-20 shrink-0 overflow-hidden rounded-md border bg-muted">
                        <Image
                          src={line.image_path}
                          alt={`${line.name_ja} ${COPY.productImage}`}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        role="img"
                        aria-label={`${line.name_ja} ${COPY.productImage}`}
                        className="flex size-20 shrink-0 items-center justify-center rounded-md border border-dashed bg-muted text-xs text-muted-foreground"
                      >
                        {COPY.productImage}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{line.name_ja}</p>
                        <Badge variant={line.status === "on_sale" ? "default" : "secondary"}>{COPY.status[line.status]}</Badge>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {COPY.ingredients}
                        {line.ingredients_ja}
                      </p>
                    </div>
                  </div>
                  {line.status === "on_sale" && (
                    <Button
                      onClick={() => {
                        trackReco({ event: "buy_click", lineId: line.id, skinType, under18 });
                        setBought(true);
                      }}
                      className="h-11 w-full"
                    >
                      {COPY.buy}
                    </Button>
                  )}
                  {line.status === "in_development" && done[line.id] && (
                    <p className="rounded-md bg-muted px-3 py-2 text-sm">
                      {COPY.notifyDone(done[line.id] === "line" ? COPY.notify.line : COPY.notify.email)}
                    </p>
                  )}
                  {line.status === "in_development" && !done[line.id] && under18 && (
                    <p className="text-xs text-muted-foreground">{COPY.notifyMinor}</p>
                  )}
                  {line.status === "in_development" && !done[line.id] && !under18 && (
                    <Button variant="outline" onClick={() => openNotify(line.id)} className="h-11 w-full">
                      {COPY.notifyOpen}
                    </Button>
                  )}
                </div>
              ))}
              {bought && <p className="text-xs text-muted-foreground">{COPY.buyDemo}</p>}
              {openLine && (
                <div className="space-y-3 rounded-lg bg-muted p-4">
                  <p className="text-sm font-semibold">{COPY.notify.title(openLine.name_ja)}</p>
                  <p className="text-xs font-medium">{COPY.notify.method}</p>
                  <div className="flex gap-2">
                    {(["email", "line"] as Via[]).map((v) => (
                      <Button
                        key={v}
                        variant={via === v ? "default" : "outline"}
                        aria-pressed={via === v}
                        onClick={() => setVia(v)}
                        className="h-11 flex-1"
                      >
                        {COPY.notify[v]}
                      </Button>
                    ))}
                  </div>
                  {via === "email" ? (
                    <div className="space-y-1.5">
                      <label htmlFor="notify-email" className="text-xs font-medium">
                        {COPY.notify.emailLabel}
                      </label>
                      <Input
                        id="notify-email"
                        type="email"
                        value={email}
                        placeholder="example@mail.com"
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 bg-background"
                      />
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed">{COPY.notify.lineNote}</p>
                  )}
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={notifyAgree}
                      onChange={(e) => setNotifyAgree(e.target.checked)}
                      className="mt-0.5 size-5 shrink-0"
                    />
                    {COPY.notify.consent}
                  </label>
                  <p className="text-xs leading-relaxed text-muted-foreground">{COPY.notify.separate}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setNotifyLine(null)} className="h-11 flex-1 bg-background">
                      {COPY.notify.close}
                    </Button>
                    <Button onClick={submitNotify} disabled={!canSubmit} className="h-11 flex-[2]">
                      {via === "line" ? COPY.notify.submitLine : COPY.notify.submitEmail}
                    </Button>
                  </div>
                </div>
              )}
              {isSensitive && recos.length > 0 && <p className="text-xs text-muted-foreground">{COPY.sensitiveUse}</p>}
            </CardContent>
          </Card>
        </section>

        <section className={panel("detail")} aria-label={COPY.tabs.detail}>
          <Card>
            <CardContent className="space-y-4">
              <h2 className="font-semibold">{COPY.detailTitle}</h2>
              {AXES.map((axis) => {
                const left = axis.leftPoints(scores, max);
                const right = 100 - left;
                const leftWins = left > right;
                const rightWins = right > left;
                const pole = (p: Pole, wins: boolean) => (
                  <div className={cn("text-center", wins ? "text-primary" : "text-muted-foreground")}>
                    <p className={cn("text-2xl leading-none", wins ? "font-bold" : "font-semibold")}>{p.code}</p>
                    <p className="mt-1 text-xs">{p.label}</p>
                  </div>
                );
                return (
                  <div key={axis.title} className="space-y-2">
                    <p className="inline-block rounded bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
                      {axis.title}
                    </p>
                    <div className="grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-2">
                      {pole(axis.left, leftWins)}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className={leftWins ? "font-semibold" : "text-muted-foreground"}>{COPY.points(left)}</span>
                          <span className={rightWins ? "font-semibold" : "text-muted-foreground"}>{COPY.points(right)}</span>
                        </div>
                        <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                          {/* 이긴 쪽에서부터 채운다. 길이는 점수 비율이라 인라인 스타일이 불가피하다 */}
                          <div
                            className={cn("absolute inset-y-0 rounded-full bg-primary", rightWins ? "right-0" : "left-0")}
                            style={{ width: `${rightWins ? right : left}%` }}
                          />
                        </div>
                      </div>
                      {pole(axis.right, rightWins)}
                    </div>
                    <p className={cn("text-xs text-muted-foreground", rightWins && "text-right")}>
                      {leftWins ? COPY.lean(axis.left.label) : rightWins ? COPY.lean(axis.right.label) : COPY.even}
                    </p>
                  </div>
                );
              })}
              <div className="space-y-1 border-t pt-3">
                <p className="text-sm font-semibold">{COPY.reasonTitle}</p>
                <p className="text-sm leading-relaxed">
                  {type.reason}
                  {isSensitive && ` ${COPY.sensitiveReason}`}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className={panel("tips")} aria-label={COPY.tabs.tips}>
          <Card>
            <CardContent className="space-y-3">
              <h2 className="font-semibold">{COPY.tipsTitle}</h2>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
                {tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              {concernLabels && (
                <p className="border-t pt-3 text-sm">
                  <span className="text-muted-foreground">{COPY.concerns}</span>
                  {concernLabels}
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
        <p>{COPY.disclaimer}</p>
        <p>{under18 ? COPY.savedMinor : COPY.savedAdult}</p>
      </div>
      <Link href="/survey" onClick={retry} className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full lg:w-60")}>
        {COPY.retry}
      </Link>
    </div>
  );
}

/** 결과 화면에 추천이 보였을 때 한 번 기록한다 (연결 전이라 지금은 보내지 않음) */
function TrackShown({ lineIds, skinType, under18 }: { lineIds: string[]; skinType: SkinType; under18: boolean }) {
  const key = lineIds.join(",");
  useEffect(() => {
    for (const lineId of key.split(",").filter(Boolean)) trackReco({ event: "shown", lineId, skinType, under18 });
  }, [key, skinType, under18]);
  return null;
}
