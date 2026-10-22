"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { SurveyAnswer, SurveyQuestion } from "@/lib/schemas/survey";
import { isUnder18 } from "../_lib/judge";
import { saveSession } from "../_lib/session";
import { submitSurvey } from "../_lib/submit";

// 일본어 문구는 원어민 검수 전. 동의 문구는 개인정보 안내 v0.1과 맞춘다
const CONSENT_VERSION = "v0.1";
const COPY = {
  progress: (n: number, total: number) => `${n} / ${total}`,
  multiHint: "複数選択できます",
  back: "戻る",
  next: "次へ",
  finish: "結果を見る",
  otherLabel: "その他のお悩みをご記入ください",
  otherPlaceholder: "例：目の下のクマ",
  otherHint: "お名前や連絡先など、個人を特定できる内容は記入しないでください。（50文字まで）",
  consent: {
    title: "個人情報の取扱いについて",
    items: [
      { label: "収集する情報", text: "年代、肌質・肌の悩みに関するアンケート回答（氏名・メールアドレスなどは収集しません）" },
      { label: "利用目的", text: "診断結果とおすすめ製品の表示、個人を特定しない統計データとしての製品企画・マーケティング分析" },
      { label: "管理", text: "回答データは大韓民国の事業者（Leaf&）が管理します" },
    ],
    readAll: "全文を読む（新しいタブ）",
    checkbox: "[必須] 個人情報の取扱いについて同意します",
    next: "同意して次へ",
  },
};

type Step = { kind: "question"; index: number } | { kind: "consent" };

export function SurveyFlow({ questions }: { questions: SurveyQuestion[] }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});
  const [otherText, setOtherText] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [consentAt, setConsentAt] = useState<string | null>(null);
  const [pos, setPos] = useState(0);

  // 나이 → (18세 이상만) 동의 → 나머지 문항. 18세 미만은 저장하지 않으므로 동의를 받지 않는다
  const under18 = isUnder18(questions, answers);
  const steps: Step[] = [
    { kind: "question", index: 0 },
    ...(under18 ? [] : [{ kind: "consent" } as const]),
    ...questions.slice(1).map((_, i) => ({ kind: "question", index: i + 1 }) as const),
  ];
  const step = steps[Math.min(pos, steps.length - 1)];
  const isLast = pos >= steps.length - 1;

  const q = step.kind === "question" ? questions[step.index] : null;
  const picked = q ? answers[q.id] : undefined;
  const pickedList = picked === undefined ? [] : Array.isArray(picked) ? picked : [picked];
  const otherOption = q?.options.find((o) => o.is_other);
  const otherOn = !!otherOption && pickedList.includes(otherOption.value);

  const canNext =
    step.kind === "consent"
      ? agreed
      : pickedList.length > 0 && (!otherOn || otherText.trim() !== "");

  function pick(question: SurveyQuestion, value: string) {
    setAnswers((prev) => {
      if (!question.multi) return { ...prev, [question.id]: value };
      const current = prev[question.id];
      let list = Array.isArray(current) ? [...current] : [];
      const isNone = question.options.find((o) => o.value === value)?.is_none;
      if (isNone) {
        // "あてはまらない"는 다른 선택지와 같이 고를 수 없다
        list = list.includes(value) ? [] : [value];
      } else {
        list = list.filter((v) => !question.options.find((o) => o.value === v)?.is_none);
        list = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      }
      return { ...prev, [question.id]: list };
    });
  }

  async function goNext() {
    if (!canNext) return;
    if (step.kind === "consent" && !consentAt) setConsentAt(new Date().toISOString());
    if (!isLast) {
      setPos((p) => p + 1);
      return;
    }
    const session = {
      answers,
      other_text: otherOn ? otherText.trim().slice(0, 50) : "",
      consent_at: under18 ? null : (consentAt ?? new Date().toISOString()),
      consent_version: under18 ? null : CONSENT_VERSION,
    };
    saveSession(session);
    await submitSurvey(session, under18);
    router.push("/survey/result");
  }

  function goBack() {
    if (pos === 0) router.push("/survey");
    else setPos((p) => p - 1);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="space-y-2">
        <Progress value={((pos + 1) / steps.length) * 100} aria-label={COPY.progress(pos + 1, steps.length)} />
        <p className="text-right text-xs text-muted-foreground">{COPY.progress(pos + 1, steps.length)}</p>
      </div>

      {q && (
        <fieldset className="space-y-3">
          <legend className="mb-1 text-lg leading-relaxed font-semibold">{q.text_ja}</legend>
          {q.multi && <p className="text-sm text-muted-foreground">{COPY.multiHint}</p>}
          <div className="flex flex-col gap-2 pt-2">
            {q.options.map((o) => {
              const selected = pickedList.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pick(q, o.value)}
                  className={cn(
                    "min-h-12 rounded-lg border px-4 py-3 text-left text-sm leading-relaxed transition-colors",
                    selected ? "border-primary bg-muted font-semibold ring-2 ring-primary" : "hover:bg-muted",
                  )}
                >
                  {o.label_ja}
                </button>
              );
            })}
          </div>
          {otherOn && (
            <div className="space-y-1.5 pt-2">
              <label htmlFor="other-text" className="text-sm font-medium">
                {COPY.otherLabel}
              </label>
              <Input
                id="other-text"
                value={otherText}
                maxLength={50}
                placeholder={COPY.otherPlaceholder}
                onChange={(e) => setOtherText(e.target.value)}
                className="h-11"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">{COPY.otherHint}</p>
            </div>
          )}
        </fieldset>
      )}

      {step.kind === "consent" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{COPY.consent.title}</h2>
          <dl className="space-y-3 rounded-lg border p-4 text-sm">
            {COPY.consent.items.map((item) => (
              <div key={item.label}>
                <dt className="font-medium">{item.label}</dt>
                <dd className="leading-relaxed text-muted-foreground">{item.text}</dd>
              </div>
            ))}
          </dl>
          <Link href="/survey/privacy" target="_blank" className="inline-block text-sm underline underline-offset-4">
            {COPY.consent.readAll}
          </Link>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="size-5" />
            {COPY.consent.checkbox}
          </label>
        </section>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={goBack} className="h-12 flex-1">
          {COPY.back}
        </Button>
        <Button onClick={goNext} disabled={!canNext} className="h-12 flex-[2]">
          {step.kind === "consent" ? COPY.consent.next : isLast ? COPY.finish : COPY.next}
        </Button>
      </div>
    </div>
  );
}
