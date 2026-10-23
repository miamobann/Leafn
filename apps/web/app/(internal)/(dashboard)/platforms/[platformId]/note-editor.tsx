"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PlatformStatus } from "@/lib/data/launch";
import { updatePlatformNote } from "@/lib/data/launch-actions";
import { STATUS } from "../labels";

export function NoteEditor({ id, status, memo }: { id: string; status: PlatformStatus | null; memo: string | null }) {
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftMemo, setDraftMemo] = useState(memo ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      await updatePlatformNote(id, { status: draftStatus ?? undefined, memo: draftMemo.trim() || null });
      setSaved(true);
    });

  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-center gap-2">
        <span className="w-20 text-muted-foreground">우리 상태</span>
        <select
          className="rounded-md border bg-background px-2 py-1"
          value={draftStatus ?? ""}
          onChange={(e) => {
            setDraftStatus((e.target.value || null) as PlatformStatus | null);
            setSaved(false);
          }}
        >
          <option value="">아직 안 봄</option>
          {(Object.keys(STATUS) as PlatformStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS[s]}
            </option>
          ))}
        </select>
      </label>
      <Textarea
        aria-label="팀 메모"
        placeholder="팀 메모"
        value={draftMemo}
        onChange={(e) => {
          setDraftMemo(e.target.value);
          setSaved(false);
        }}
      />
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </Button>
        {saved && <span className="text-xs text-muted-foreground">반영했어요 · 샘플이라 새로고침하면 사라져요 (DB 연결 전)</span>}
      </div>
    </div>
  );
}
