"use client";

import { Pencil, Trash2 } from "lucide-react";
import { type ReactNode, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MilestoneView, PromoEventView } from "@/lib/data/launch";
import { addMilestone, deleteMilestone, deletePromoEvent, type LaunchResult, updateMilestone, updatePromoEvent } from "@/lib/data/launch-actions";
import { MilestoneInput, PromoEventPatch } from "@/lib/schemas/promo";

// 전체보기(/calendar) 일정 패널의 수정 · 삭제 (calendar-edit 제안, 2026-10-26). 홈 캘린더는 체크만 하고 고치기는 여기서 한다
const TEXT = {
  edit: "수정",
  delete: "삭제",
  save: "저장",
  saving: "저장 중…",
  cancel: "취소",
  confirmed: "확정 일정 (플랫폼 공지 확인)",
  addMilestone: "마감 추가",
  milestoneLabel: "마감 이름 (예: 참가 신청)",
  deleteEvent: (e: PromoEventView) =>
    [
      `「${e.title}」 행사를 지울까요?`,
      e.milestones.length > 0 ? `준비 마감 ${e.milestones.length}개도 함께 지워져요.` : "",
      e.linkedAdChecks > 0 ? `이 행사에 연결된 광고 검토 ${e.linkedAdChecks}건은 남고, 행사 연결만 끊겨요.` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  deleteMilestone: (m: MilestoneView) => `준비 마감 「${m.label}」을 지울까요?`,
};

/** 서버 결과를 확인하고, 실패면 문구를 돌려준다 */
function useSave() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = <T,>(call: () => Promise<LaunchResult<T>>, onOk: (data: T) => void) => {
    setError(null);
    startTransition(async () => {
      const result = await call();
      if (result.ok) onOk(result.data);
      else setError(result.message);
    });
  };
  return { pending, error, setError, run };
}

function ErrorLine({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  ) : null;
}

/** 행사 이름 · 날짜 · 확정 여부 수정과 행사 삭제 */
export function EventEditor({
  event,
  onChange,
  onDeleted,
}: {
  event: PromoEventView;
  onChange: (patch: Partial<PromoEventView>) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { pending, error, setError, run } = useSave();

  const submit = (form: FormData) => {
    const parsed = PromoEventPatch.safeParse({
      title: String(form.get("title") ?? ""),
      start_date: String(form.get("start_date") ?? ""),
      end_date: String(form.get("end_date") ?? ""),
      // 자사 캠페인은 팀이 날짜를 정하므로 늘 확정
      is_confirmed: event.kind === "own_campaign" || form.get("is_confirmed") === "on",
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "입력을 확인해 주세요");
      return;
    }
    const p = parsed.data;
    run(
      () => updatePromoEvent(event.id, p),
      () => {
        onChange({ title: p.title, startDate: p.start_date, endDate: p.end_date, isConfirmed: p.is_confirmed });
        setEditing(false);
      },
    );
  };

  const remove = () => {
    if (!window.confirm(TEXT.deleteEvent(event))) return;
    run(() => deletePromoEvent(event.id), onDeleted);
  };

  if (!editing) {
    return (
      <div className="space-y-1">
        <div className="flex gap-2">
          <Button size="xs" variant="outline" onClick={() => setEditing(true)} disabled={pending}>
            <Pencil aria-hidden />
            {TEXT.edit}
          </Button>
          <Button size="xs" variant="outline" onClick={remove} disabled={pending} className="text-destructive">
            <Trash2 aria-hidden />
            {TEXT.delete}
          </Button>
        </div>
        <ErrorLine message={error} />
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-2 rounded-lg border p-3">
      <Input name="title" defaultValue={event.title} aria-label="행사 이름" />
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" name="start_date" defaultValue={event.startDate} aria-label="시작일" />
        <Input type="date" name="end_date" defaultValue={event.endDate} aria-label="종료일" />
      </div>
      {event.kind === "platform_event" && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="is_confirmed" defaultChecked={event.isConfirmed} />
          {TEXT.confirmed}
        </label>
      )}
      <ErrorLine message={error} />
      <div className="flex gap-2">
        <Button type="submit" size="xs" disabled={pending}>
          {pending ? TEXT.saving : TEXT.save}
        </Button>
        <Button type="button" size="xs" variant="ghost" onClick={() => (setEditing(false), setError(null))}>
          {TEXT.cancel}
        </Button>
      </div>
    </form>
  );
}

/** 준비 마감 한 줄의 수정 · 삭제 버튼과 수정 칸 */
export function MilestoneEditor({
  milestone,
  onChange,
  onDeleted,
  children,
}: {
  milestone: MilestoneView;
  onChange: (patch: Partial<MilestoneView>) => void;
  onDeleted: () => void;
  /** 수정 중이 아닐 때 보일 한 줄 (체크 · 이름 · 날짜) */
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const { pending, error, setError, run } = useSave();

  const submit = (form: FormData) => {
    const parsed = MilestoneInput.safeParse({ label: String(form.get("label") ?? ""), due_date: String(form.get("due_date") ?? "") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "입력을 확인해 주세요");
      return;
    }
    const m = parsed.data;
    run(
      () => updateMilestone(milestone.id, m),
      () => {
        onChange({ label: m.label, dueDate: m.due_date });
        setEditing(false);
      },
    );
  };

  const remove = () => {
    if (!window.confirm(TEXT.deleteMilestone(milestone))) return;
    run(() => deleteMilestone(milestone.id), onDeleted);
  };

  if (editing) {
    return (
      <li>
        <form action={submit} className="grid grid-cols-[1fr_auto] gap-1">
          <Input name="label" defaultValue={milestone.label} aria-label="마감 이름" className="col-span-2 h-7" />
          <Input type="date" name="due_date" defaultValue={milestone.dueDate} aria-label="마감 날짜" className="h-7" />
          <span className="flex gap-1">
            <Button type="submit" size="xs" disabled={pending}>
              {TEXT.save}
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => (setEditing(false), setError(null))}>
              {TEXT.cancel}
            </Button>
          </span>
          <div className="col-span-2">
            <ErrorLine message={error} />
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="space-y-0.5">
      <div className="flex items-center gap-1">
        {children}
        <Button size="icon-xs" variant="ghost" aria-label={`${milestone.label} ${TEXT.edit}`} onClick={() => setEditing(true)} disabled={pending}>
          <Pencil aria-hidden />
        </Button>
        <Button size="icon-xs" variant="ghost" aria-label={`${milestone.label} ${TEXT.delete}`} onClick={remove} disabled={pending}>
          <Trash2 aria-hidden />
        </Button>
      </div>
      <ErrorLine message={error} />
    </li>
  );
}

/** 준비 마감 추가 (행사를 만든 뒤에도 몇 개든) */
export function NewMilestoneForm({ eventId, onAdded }: { eventId: string; onAdded: (m: MilestoneView) => void }) {
  const [key, setKey] = useState(0);
  const { pending, error, setError, run } = useSave();

  const submit = (form: FormData) => {
    const parsed = MilestoneInput.safeParse({ label: String(form.get("label") ?? ""), due_date: String(form.get("due_date") ?? "") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "입력을 확인해 주세요");
      return;
    }
    run(
      () => addMilestone(eventId, parsed.data),
      (m) => {
        onAdded(m);
        setKey((k) => k + 1);
      },
    );
  };

  return (
    <form key={key} action={submit} className="grid grid-cols-[1fr_auto] gap-1">
      <Input name="label" placeholder={TEXT.milestoneLabel} aria-label="새 마감 이름" className="col-span-2 h-7" />
      <Input type="date" name="due_date" aria-label="새 마감 날짜" className="h-7" />
      <Button type="submit" size="xs" variant="outline" disabled={pending}>
        {TEXT.addMilestone}
      </Button>
      <div className="col-span-2">
        <ErrorLine message={error} />
      </div>
    </form>
  );
}
