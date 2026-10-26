"use client";

// 멤버별 담당 탭 표 (docs/team-approval-ai-analysis.md 2장 "탭 담당"). 팀원은 체크된 탭에만 시안을 올린다.
// 팀장만 체크를 바꿀 수 있고, 팀장 줄은 항상 모든 탭이다 (DB의 has_tab()과 같은 규칙).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setMemberTab } from "@/lib/data/member-tab-actions";
import { SUBMISSION_TAB_LABELS, SubmissionTab } from "@/lib/schemas/submission";

const TEXT = {
  name: "이름",
  ownerAllTabs: "팀장 · 모든 탭",
  saving: "저장 중…",
};

export type MemberTabsRow = {
  userId: string;
  name: string;
  isOwner: boolean;
  tabs: SubmissionTab[];
};

const keyOf = (userId: string, tab: SubmissionTab) => `${userId}:${tab}`;

function withKey(set: Set<string>, key: string, on: boolean) {
  const next = new Set(set);
  if (on) next.add(key);
  else next.delete(key);
  return next;
}

export function MemberTabsTable({ rows, canEdit }: { rows: MemberTabsRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [granted, setGranted] = useState(() => new Set(rows.flatMap((r) => r.tabs.map((tab) => keyOf(r.userId, tab)))));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(userId: string, tab: SubmissionTab, on: boolean) {
    const key = keyOf(userId, tab);
    setError(null);
    setGranted((prev) => withKey(prev, key, on));
    startTransition(async () => {
      const result = await setMemberTab(userId, tab, on);
      if (!result.ok) {
        setGranted((prev) => withKey(prev, key, !on));
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{TEXT.name}</TableHead>
            {SubmissionTab.options.map((tab) => (
              <TableHead key={tab} className="text-center">
                {SUBMISSION_TAB_LABELS[tab]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.userId}>
              <TableCell>
                {r.name}
                {r.isOwner && <span className="ml-2 text-xs text-muted-foreground">{TEXT.ownerAllTabs}</span>}
              </TableCell>
              {SubmissionTab.options.map((tab) => (
                <TableCell key={tab}>
                  <div className="flex justify-center">
                    <Checkbox
                      aria-label={`${r.name} ${SUBMISSION_TAB_LABELS[tab]}`}
                      checked={r.isOwner || granted.has(keyOf(r.userId, tab))}
                      disabled={!canEdit || r.isOwner || pending}
                      onCheckedChange={(on) => toggle(r.userId, tab, on)}
                    />
                  </div>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pending && <p className="mt-2 text-sm text-muted-foreground">{TEXT.saving}</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
