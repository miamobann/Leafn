"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PromoEventView } from "@/lib/data/launch";
import { createPromoEvent } from "@/lib/data/launch-actions";
import { platformLabel } from "@/lib/platforms";
import { PromoEventInput } from "@/lib/schemas/promo";

export function NewEventForm({ platformKeys, onCreated }: { platformKeys: string[]; onCreated: (e: PromoEventView) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (form: FormData) => {
    const text = (k: string) => String(form.get(k) ?? "");
    const platform = text("platform") || null;
    const parsed = PromoEventInput.safeParse({
      platform,
      kind: platform ? "platform_event" : "own_campaign",
      title: text("title"),
      start_date: text("start_date"),
      end_date: text("end_date"),
      // 자사 캠페인은 팀이 날짜를 정하므로 늘 확정. 플랫폼 행사는 공지를 확인했을 때만 체크
      is_confirmed: !platform || form.get("is_confirmed") === "on",
      milestones: text("due_label") && text("due_date") ? [{ label: text("due_label"), due_date: text("due_date") }] : [],
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "입력을 확인해 주세요");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createPromoEvent(parsed.data);
      if (result.ok) onCreated(result.data);
      else setError(result.message);
    });
  };

  return (
    <form action={submit} className="mb-4 grid grid-cols-3 gap-2 rounded-lg border p-3 text-sm">
      <Input name="title" placeholder="행사 이름" aria-label="행사 이름" className="col-span-2" />
      <select name="platform" aria-label="플랫폼" className="rounded-md border bg-background px-2 py-1">
        <option value="">자사 캠페인 (플랫폼 없음)</option>
        {platformKeys.map((k) => (
          <option key={k} value={k}>
            {platformLabel(k)}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2">
        시작 <Input type="date" name="start_date" />
      </label>
      <label className="flex items-center gap-2">
        종료 <Input type="date" name="end_date" />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" name="is_confirmed" />
        확정 일정 (플랫폼 공지 확인)
      </label>
      <Input name="due_label" placeholder="첫 준비 마감 (예: 참가 신청)" aria-label="준비 마감 이름" />
      <Input type="date" name="due_date" aria-label="준비 마감 날짜" />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "추가 중…" : "추가"}
      </Button>
      {error && (
        <p role="alert" className="col-span-3 text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
